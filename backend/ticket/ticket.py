import os
import logging
from typing import Optional
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException, status
from ticket.ticketschema import InsertTicket
from database.db import supabase
from ticket.ticketaiservice import classify_ticket, generate_ticket_response

# Setup basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def assign_ticket_to_agent(ticket_id: int, department: str) -> Optional[int]:
    """
    Finds a user in the classified department with the role ('admin', 'support', 'agent').
    Case 1: No agent found -> leave assigned_to as NULL, insert ticket_history "No department agent found".
    Case 2: One agent found -> update tickets (assigned_to, status = 'ASSIGNED'), insert ticket_history "Ticket Assigned To Department Agent".
    Case 3: Multiple agents found -> assign to user with fewest active tickets (status NOT IN ('RESOLVED', 'CLOSED')), update tickets (assigned_to, status = 'ASSIGNED'), insert ticket_history "Ticket Assigned To Least Loaded Agent".
    """
    logger.info("===== DEPARTMENT ASSIGNMENT START =====")
    logger.info(f"Ticket ID: {ticket_id}")
    logger.info(f"Department detected: {department}")
    
    try:
        logger.info("Querying department agents")
        # 1. Fetch eligible agents
        users_res = (
            supabase
            .table("users")
            .select("*")
            .eq("department", department)
            .in_("role", ["admin", "support", "agent"])
            .execute()
        )
        matching_users = users_res.data or []
        matching_emails = [u["email"] for u in matching_users]
        logger.info(f"Matching agents found: {matching_emails}")
        
        # CASE 1: No agent found
        if not matching_users:
            logger.info(f"Department identified: {department}")
            logger.info("No matching agents found")
            logger.info("Assignment skipped")
            
            # Create ticket_history entry
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "No department agent found",
                "performed_by": None
            }).execute()
            
            logger.info("===== DEPARTMENT ASSIGNMENT END =====")
            return None
            
        selected_user = None
        
        # CASE 2: One agent found
        if len(matching_users) == 1:
            selected_user = matching_users[0]
            logger.info(f"Department identified: {department}")
            logger.info(f"Matching users found: {matching_emails}")
            logger.info(f"Assigned user ID: {selected_user['id']}")
            logger.info(f"Assigned user Name: {selected_user['full_name']}")
            logger.info(f"Assigned user Email: {selected_user['email']}")
            logger.info(f"Selected agent: {selected_user['email']}")
            
            logger.info("Updating assigned_to field")
            # Update tickets table
            supabase.table("tickets").update({
                "assigned_to": selected_user["id"],
                "status": "ASSIGNED"
            }).eq("id", ticket_id).execute()
            
            # Create ticket_history record
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "Ticket Assigned To Department Agent",
                "performed_by": None
            }).execute()
            
            logger.info("Assignment successful")
            logger.info("===== DEPARTMENT ASSIGNMENT END =====")
            return selected_user["id"]
            
        # CASE 3: Multiple agents found
        logger.info(f"Department identified: {department}")
        logger.info("Multiple agents found")
        logger.info("Calculating ticket load")
        
        user_ids = [u["id"] for u in matching_users]
        
        # Query active tickets (status NOT IN ('RESOLVED', 'resolved', 'CLOSED', 'closed'))
        tickets_res = (
            supabase
            .table("tickets")
            .select("id, assigned_to")
            .in_("assigned_to", user_ids)
            .neq("status", "RESOLVED")
            .neq("status", "resolved")
            .neq("status", "CLOSED")
            .neq("status", "closed")
            .execute()
        )
        active_tickets = tickets_res.data or []
        
        # Count active tickets per agent
        ticket_counts = {uid: 0 for uid in user_ids}
        for ticket in active_tickets:
            uid = ticket.get("assigned_to")
            if uid in ticket_counts:
                ticket_counts[uid] += 1
                
        logger.info(f"Agent active ticket counts: {ticket_counts}")
        logger.info(f"Active ticket counts: {ticket_counts}")
        
        # Select agent with minimum active tickets
        selected_user = min(matching_users, key=lambda u: ticket_counts[u["id"]])
        logger.info(f"Selected least loaded agent: {selected_user['email']}")
        logger.info(f"Selected agent: {selected_user['email']}")
        
        logger.info("Updating assigned_to field")
        # Update tickets table
        supabase.table("tickets").update({
            "assigned_to": selected_user["id"],
            "status": "ASSIGNED"
        }).eq("id", ticket_id).execute()
        
        # Create ticket_history record
        supabase.table("ticket_history").insert({
            "ticket_id": ticket_id,
            "action": "Ticket Assigned To Least Loaded Agent",
            "performed_by": None
        }).execute()
        
        logger.info("Assignment successful")
        logger.info("===== DEPARTMENT ASSIGNMENT END =====")
        return selected_user["id"]
        
    except Exception as e:
        logger.error(f"Error in automatic ticket assignment: {e}")
        try:
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "No department agent found",
                "performed_by": None
            }).execute()
        except Exception:
            pass
        logger.info("===== DEPARTMENT ASSIGNMENT END =====")
        return None

def escalate_ticket_by_id(ticket_id: int, reason: str = "User marked as not resolved"):
    """
    Escalates a ticket by creating a Jira issue, recording details in jira_tickets and escalations tables,
    and updating the ticket status to 'ESCALATED'.
    """
    try:
        logger.info(f"Starting ticket escalation for ticket ID: {ticket_id}")
        
        # 1. Fetch ticket details
        ticket_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
        if not ticket_res.data:
            raise HTTPException(status_code=404, detail=f"Ticket with ID {ticket_id} not found")
        ticket_data = ticket_res.data[0]
        
        # 2. Fetch assigned agent details if exists
        assigned_to = ticket_data.get("assigned_to")
        agent_name = "Unassigned"
        agent_email = "N/A"
        agent_dept = "N/A"
        
        if assigned_to:
            user_res = supabase.table("users").select("*").eq("id", assigned_to).execute()
            if user_res.data:
                agent = user_res.data[0]
                agent_name = agent.get("full_name") or "N/A"
                agent_email = agent.get("email") or "N/A"
                agent_dept = agent.get("department") or "N/A"
                
        # 3. Build Jira description including agent info
        jira_desc = (
            f"{ticket_data.get('description', '')}\n\n"
            f"Assigned Agent:\n{agent_name}\n\n"
            f"Agent Email:\n{agent_email}\n\n"
            f"Department:\n{agent_dept}"
        )
        
        # 4. Create Jira Issue using existing service
        from jira.jira_service import create_jira_ticket
        logger.info(f"Creating Jira ticket with description: {jira_desc}")
        jira_res = create_jira_ticket(
            title=ticket_data.get("title") or f"Escalated Ticket #{ticket_id}",
            description=jira_desc
        )
        
        jira_issue_key = jira_res.get("key")
        jira_issue_id = jira_res.get("id")
        jira_status = "To Do"
        
        logger.info(f"Jira issue created: key={jira_issue_key}, id={jira_issue_id}")
        
        # 5. Insert row into escalations table
        supabase.table("escalations").insert({
            "ticket_id": ticket_id,
            "escalated_to": "Jira",
            "reason": reason
        }).execute()
        
        # 6. Insert row into jira_tickets table
        supabase.table("jira_tickets").insert({
            "ticket_id": ticket_id,
            "jira_issue_key": jira_issue_key,
            "jira_issue_id": jira_issue_id,
            "jira_status": jira_status
        }).execute()
        
        # 7. Update tickets.status = 'ESCALATED'
        supabase.table("tickets").update({"status": "ESCALATED"}).eq("id", ticket_id).execute()
        
        # Create ticket history log
        supabase.table("ticket_history").insert({
            "ticket_id": ticket_id,
            "action": "Ticket Escalated to Jira",
            "performed_by": None
        }).execute()
        
        return {
            "status": "success",
            "message": "Ticket escalated successfully",
            "jira_issue_key": jira_issue_key,
            "jira_issue_id": jira_issue_id,
            "jira_status": jira_status
        }
        
    except Exception as e:
        logger.error(f"Failed to escalate ticket {ticket_id}: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Failed to escalate ticket: {str(e)}")


def validate_ticket_columns() -> bool:
    """
    Checks whether the required AI columns ('category', 'priority', 'department', 'ai_response')
    exist in the 'tickets' table schema cache.
    """
    try:
        # Dry-run selection with limit 0 to verify column existence
        supabase.table("tickets").select("category,priority,department,ai_response").limit(0).execute()
        return True
    except Exception as e:
        logger.error(
            "SCHEMA VALIDATION ERROR: Required AI columns (category, priority, department, ai_response) "
            "do not all exist in the 'tickets' table schema cache. Please apply the database migration script "
            "and refresh the Supabase schema cache (e.g. run 'NOTIFY pgrst, ''reload schema'';' in the SQL editor). "
            f"Error details: {e}"
        )
        return False

def retrieve_relevant_chunks(category: str, title: str, description: str, limit: int = 5):
    try:
        # STEP 2: Generating Query Embedding
        logger.info("STEP 2: Generating Query Embedding")
        
        # Configure genai key
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
        else:
            logger.error("GEMINI_API_KEY not found in environment variables.")
            
        query_text = f"Category: {category}\nTitle: {title}\nDescription: {description}"
        
        # Generate embedding using Gemini's gemini-embedding-001 model
        embed_res = genai.embed_content(
            model="models/gemini-embedding-001",
            content=query_text,
            task_type="retrieval_query"
        )
        # Sliced to 384 dimensions to match target vector database size
        query_embedding = embed_res["embedding"][:384]
        
        # STEP 3: Vector Similarity Search
        logger.info("STEP 3: Vector Similarity Search")
        
        # Query Supabase RPC match_sop_chunks
        rpc_res = supabase.rpc("match_sop_chunks", {
            "query_embedding": query_embedding,
            "match_threshold": 0.0, # Retrieve closest matches regardless of threshold
            "match_count": limit
        }).execute()
        
        matched_chunks = rpc_res.data or []
        return matched_chunks
        
    except Exception as e:
        logger.error(f"Vector similarity search failed: {e}")
        # Return empty list if search fails to proceed gracefully
        return []

def create_ticket(ticket: InsertTicket, user_id: int):
    # 1. Ticket Insertion (First step, never block ticket creation if AI fails)
    try:
        data = ticket.dict(exclude_none=True)
        data["user_id"] = user_id

        if "status" not in data:
            data["status"] = "Open"

        # Sanitize assigned_to: if 0, treat as unassigned (NULL)
        if data.get("assigned_to") == 0:
            data.pop("assigned_to", None)

        logger.info(f"Inserting ticket into database for user_id: {user_id} with title: {ticket.title}")

        ticket_response = (
            supabase
            .table("tickets")
            .insert(data)
            .execute()
        )

        if not ticket_response.data:
            logger.error("Ticket insertion failed - no data returned from database")
            raise HTTPException(
                status_code=500,
                detail="Ticket insertion failed: database did not return created record."
            )

        created_ticket = ticket_response.data[0]
        ticket_id = created_ticket["id"]
        logger.info(f"Ticket inserted successfully with ID: {ticket_id}")

    except Exception as insert_err:
        logger.error(f"Ticket insertion failure: {insert_err}")
        # Re-raise standard FastAPI HTTPException or general exception
        if isinstance(insert_err, HTTPException):
            raise insert_err
        raise HTTPException(
            status_code=500,
            detail=f"Failed to insert ticket: {str(insert_err)}"
        )

    # Check column validation beforehand
    columns_exist = validate_ticket_columns()

    # RAG PIPELINE START
    logger.info("========== RAG PIPELINE START ==========")
    logger.info(f"Ticket ID: {ticket_id}")

    # 2. Insert record into ticket_history (action = "Ticket Created", performed_by = user_id)
    try:
        logger.info("Inserting ticket_history 'Ticket Created'")
        supabase.table("ticket_history").insert({
            "ticket_id": ticket_id,
            "action": "Ticket Created",
            "performed_by": user_id
        }).execute()
        logger.info("Successfully logged history 'Ticket Created'")
    except Exception as history_err:
        logger.error(f"Failed to insert ticket_history 'Ticket Created' for ticket ID {ticket_id}: {history_err}")

    # AI Workflow (Classify -> Retrieve -> Generate Response -> Update DB)
    # This must be wrapped so errors do not block returning the created ticket or throw HTTP exceptions.
    category = "General"
    priority = "Medium"
    department = "Support"
    sentiment = "Neutral"
    confidence = 0.8
    ai_response = "AI assistance is currently unavailable. Please wait for manual support."
    assigned_user_id = None

    # Initialize debugging lists
    retrieved_sops = []
    retrieved_chunks_texts = []

    try:
        # 3a. Gemini Classification
        try:
            logger.info("Starting Gemini classification...")
            ai_result = classify_ticket(
                title=ticket.title,
                description=ticket.description
            )
            category = ai_result.get("category") or "General"
            priority = ai_result.get("priority") or "Medium"
            department = ai_result.get("department") or "Support"
            sentiment = ai_result.get("sentiment") or "Neutral"
            confidence = ai_result.get("confidence") or 0.8
        except Exception as class_err:
            logger.error(f"Gemini classification failed for ticket ID {ticket_id}: {class_err}. Using fallbacks.")
            category = "General"
            priority = "Medium"
            department = "Support"
            sentiment = "Neutral"
            confidence = 0.5

        # STEP 1: Classification Complete
        logger.info("STEP 1: Classification Complete")
        logger.info(f"Category: {category}")
        logger.info(f"Priority: {priority}")
        logger.info(f"Department: {department}")

        # 3b. Insert record into ai_classifications
        try:
            logger.info(f"Inserting record into ai_classifications for ticket ID {ticket_id}")
            supabase.table("ai_classifications").insert({
                "ticket_id": ticket_id,
                "category": category,
                "priority": priority,
                "sentiment": sentiment,
                "confidence": confidence
            }).execute()
            logger.info(f"Successfully inserted ai_classifications for ticket ID {ticket_id}")
        except Exception as ai_class_err:
            logger.error(f"Failed to insert ai_classifications for ticket ID {ticket_id}: {ai_class_err}")

        # 3c. Update tickets table (category, priority, department)
        try:
            if columns_exist:
                logger.info(f"Updating ticket ID {ticket_id} with category, priority, department")
                supabase.table("tickets").update({
                    "category": category,
                    "priority": priority,
                    "department": department
                }).eq("id", ticket_id).execute()
                logger.info(f"Successfully updated classification columns in tickets table for ticket ID {ticket_id}")
        except Exception as upd_err:
            logger.error(f"Failed to update tickets classification columns for ticket ID {ticket_id}: {upd_err}")

        # 3d. Insert record into ticket_history (action = "Ticket Classified", performed_by = None)
        try:
            logger.info(f"Inserting ticket_history 'Ticket Classified' for ticket ID {ticket_id}")
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "Ticket Classified",
                "performed_by": None
            }).execute()
            logger.info(f"Successfully inserted history 'Ticket Classified' for ticket ID {ticket_id}")
        except Exception as history_err:
            logger.error(f"Failed to insert ticket_history 'Ticket Classified' for ticket ID {ticket_id}: {history_err}")

        # 3e. Retrieve SOP Chunks
        try:
            logger.info(f"Starting SOP retrieval for category '{category}', title '{ticket.title}'")
            retrieved_chunks = retrieve_relevant_chunks(
                category=category,
                title=ticket.title,
                description=ticket.description,
                limit=5
            )
            
            # Print STEP 3 Retrieved Chunks Count log
            logger.info(f"Retrieved {len(retrieved_chunks)} chunks")
            
            # Map retrieved chunks to format results list for step 3 printing
            results_list = []
            for doc in retrieved_chunks:
                results_list.append({
                    "title": doc.get("sop_title"),
                    "department": doc.get("sop_department"),
                    "file_url": doc.get("sop_file_url"),
                    "similarity": doc.get("similarity"),
                    "chunk_text": doc.get("chunk_text")
                })
                
            for i, chunk in enumerate(results_list, start=1):
                logger.info(f"""
    Chunk #{i}

    SOP Title:
    {chunk['title']}

    Department:
    {chunk['department']}

    File URL:
    {chunk['file_url']}

    Similarity:
    {chunk['similarity']}

    Chunk Content:
    {chunk['chunk_text']}
                """)
                
            # If no chunks were found, print a clear log
            if not retrieved_chunks:
                logger.warning("No SOP chunks matched the query embedding.")
                
            # Populate debugging info lists
            seen_sops = set()
            for doc in retrieved_chunks:
                sop_id = doc.get("sop_id")
                if sop_id not in seen_sops:
                    seen_sops.add(sop_id)
                    retrieved_sops.append({
                        "sop_id": sop_id,
                        "title": doc.get("sop_title"),
                        "department": doc.get("sop_department"),
                        "file_url": doc.get("sop_file_url")
                    })
                retrieved_chunks_texts.append({
                    "chunk_text": doc.get("chunk_text"),
                    "similarity": doc.get("similarity")
                })
                
        except Exception as ret_err:
            logger.error(f"SOP retrieval failed for ticket ID {ticket_id}: {ret_err}")
            # Raise exception to skip next steps and hit the AI workflow failure fallback block
            raise ret_err

        # 3f. Build Context & Generate response
        try:
            # STEP 4: Building RAG Context
            logger.info("STEP 4: Building RAG Context")
            
            
            context_blocks = []
            for doc in retrieved_chunks:
                block = f"SOP Document:\n{doc.get('sop_title')}\n\nDepartment:\n{doc.get('sop_department')}\n\nRelevant Content: {doc.get('chunk_text')}"
                context_blocks.append(block)
            context = "\n\n".join(context_blocks) if context_blocks else "No relevant SOP chunks found."
            
            # STEP 5: Sending Context to Gemini
            logger.info("STEP 5: Sending Context to Gemini")
            ai_response = generate_ticket_response(
                category=category,
                title=ticket.title,
                description=ticket.description,
                priority=priority,
                department=department,
                retrieved_chunks=context
            )
            # STEP 6: Gemini Response Generated
            logger.info("STEP 6: Gemini Response Generated")
            logger.info(f"AI Response:\n{ai_response}")
            
        except Exception as gen_err:
            logger.error(f"Gemini answer generation failed for ticket ID {ticket_id}: {gen_err}")
            raise gen_err

        # 3g. Insert AI response into ticket_messages (sender_id = user_id)
        try:
            logger.info(f"Inserting AI response into ticket_messages for ticket ID {ticket_id}")
            supabase.table("ticket_messages").insert({
                "ticket_id": ticket_id,
                "sender_id": user_id,
                "message": ai_response
            }).execute()
            logger.info(f"Successfully inserted ticket_messages for ticket ID {ticket_id}")
        except Exception as msg_err:
            logger.error(f"Failed to insert ticket_messages for ticket ID {ticket_id}: {msg_err}")

        # 3h. Update tickets.ai_response
        try:
            if columns_exist:
                logger.info(f"Updating tickets.ai_response for ticket ID {ticket_id}")
                update_res = (
                    supabase
                    .table("tickets")
                    .update({
                        "ai_response": ai_response
                    })
                    .eq("id", ticket_id)
                    .execute()
                )
                if not update_res.data:
                    raise Exception("Update query returned no data.")
                final_ticket = update_res.data[0]
                logger.info(f"Successfully updated tickets.ai_response for ticket ID {ticket_id}")
            else:
                final_ticket = created_ticket.copy()
                final_ticket["category"] = category
                final_ticket["priority"] = priority
                final_ticket["department"] = department
                final_ticket["ai_response"] = ai_response
        except Exception as upd_ai_err:
            logger.error(f"Failed to update tickets.ai_response for ticket ID {ticket_id}: {upd_ai_err}")
            raise upd_ai_err

        # Verify retrieved chunks exist in the database and are not empty
        has_valid_chunks = False
        if retrieved_chunks:
            try:
                chunk_ids = [c.get("id") for c in retrieved_chunks if c.get("id")]
                if chunk_ids:
                    logger.info(f"Verifying {len(chunk_ids)} chunk IDs in sop_chunks table...")
                    db_chunks_res = supabase.table("sop_chunks").select("id, chunk_text").in_("id", chunk_ids).execute()
                    db_chunks = db_chunks_res.data or []
                    valid_chunks = [ch for ch in db_chunks if ch.get("chunk_text") and ch.get("chunk_text").strip()]
                    if valid_chunks:
                        has_valid_chunks = True
                        logger.info(f"Verified: {len(valid_chunks)} chunks exist and are not empty in sop_chunks.")
                else:
                    # Fallback to verify by text match
                    chunk_texts = [c.get("chunk_text") for c in retrieved_chunks if c.get("chunk_text")]
                    if chunk_texts:
                        logger.info("Verifying chunks in sop_chunks table by text match...")
                        db_chunks_res = supabase.table("sop_chunks").select("id, chunk_text").in_("chunk_text", chunk_texts).execute()
                        db_chunks = db_chunks_res.data or []
                        valid_chunks = [ch for ch in db_chunks if ch.get("chunk_text") and ch.get("chunk_text").strip()]
                        if valid_chunks:
                            has_valid_chunks = True
                            logger.info(f"Verified: {len(valid_chunks)} chunks exist and are not empty in sop_chunks by text match.")
            except Exception as verify_err:
                logger.error(f"Error verifying chunks in sop_chunks table: {verify_err}")
                has_valid_chunks = False

        # Decide whether to assign the ticket or set it to RESOLVED
        is_resolved_by_ai = False
        if ai_response and ai_response != "AI assistance is currently unavailable. Please wait for manual support.":
            if "The required information was not found in the available SOP documents." not in ai_response:
                if has_valid_chunks:
                    is_resolved_by_ai = True

        if is_resolved_by_ai:
            logger.info("AI resolution successful with verified SOP chunks. Setting ticket status to RESOLVED and skipping assignment.")
            status_update_res = supabase.table("tickets").update({"status": "RESOLVED"}).eq("id", ticket_id).execute()
            if status_update_res.data:
                final_ticket = status_update_res.data[0]
            else:
                final_ticket["status"] = "RESOLVED"
            assigned_user_id = None
        else:
            logger.info("AI resolution failed or no valid SOP chunks found. Triggering automatic ticket assignment.")
            assigned_user_id = assign_ticket_to_agent(ticket_id, department)
            ticket_after_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
            if ticket_after_res.data:
                final_ticket = ticket_after_res.data[0]
            else:
                final_ticket["assigned_to"] = assigned_user_id
                if assigned_user_id:
                    final_ticket["status"] = "ASSIGNED"

        # 3i. Insert record into ticket_history (action = "AI Response Generated", performed_by = None)
        try:
            logger.info(f"Inserting ticket_history 'AI Response Generated' for ticket ID {ticket_id}")
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "AI Response Generated",
                "performed_by": None
            }).execute()
            logger.info(f"Successfully inserted history 'AI Response Generated' for ticket ID {ticket_id}")
        except Exception as history_err:
            logger.error(f"Failed to insert ticket_history 'AI Response Generated' for ticket ID {ticket_id}: {history_err}")

    except Exception as ai_workflow_err:
        logger.error(f"AI workflow failed for ticket ID {ticket_id}: {ai_workflow_err}")
        ai_response = "AI assistance is currently unavailable. Please wait for manual support."
        
        # 4a. Try to store fallback classification and default AI response in ticket messages if it failed before
        try:
            logger.info(f"Inserting fallback ticket_messages for ticket ID {ticket_id}")
            supabase.table("ticket_messages").insert({
                "ticket_id": ticket_id,
                "sender_id": user_id,
                "message": ai_response
            }).execute()
        except Exception as msg_err:
            logger.error(f"Fallback insert ticket_messages failed for ticket ID {ticket_id}: {msg_err}")

        # Auto assign ticket since AI failed
        assigned_user_id = assign_ticket_to_agent(ticket_id, department)

        # 4b. Update tickets table with fallback classification and default ai_response
        if columns_exist:
            try:
                logger.info(f"Attempting fallback tickets table update for ticket ID {ticket_id}")
                update_res = (
                    supabase
                    .table("tickets")
                    .update({
                        "category": category,
                        "priority": priority,
                        "department": department,
                        "ai_response": ai_response
                    })
                    .eq("id", ticket_id)
                    .execute()
                )
                if update_res.data:
                    final_ticket = update_res.data[0]
                else:
                    final_ticket = created_ticket.copy()
                    final_ticket["category"] = category
                    final_ticket["priority"] = priority
                    final_ticket["department"] = department
                    final_ticket["ai_response"] = ai_response
            except Exception as fallback_update_err:
                logger.error(f"Fallback ticket update failed: {fallback_update_err}")
                final_ticket = created_ticket.copy()
                final_ticket["category"] = category
                final_ticket["priority"] = priority
                final_ticket["department"] = department
                final_ticket["ai_response"] = ai_response
        else:
            final_ticket = created_ticket.copy()
            final_ticket["category"] = category
            final_ticket["priority"] = priority
            final_ticket["department"] = department
            final_ticket["ai_response"] = ai_response

        # 4c. Insert record into ticket_history (action = "AI Response Generated" fallback, performed_by = None)
        try:
            logger.info(f"Inserting fallback ticket_history 'AI Response Generated' for ticket ID {ticket_id}")
            supabase.table("ticket_history").insert({
                "ticket_id": ticket_id,
                "action": "AI Response Generated",
                "performed_by": None
            }).execute()
        except Exception as history_err:
            logger.error(f"Failed to insert fallback ticket_history 'AI Response Generated' for ticket ID {ticket_id}: {history_err}")

    # RAG PIPELINE END
    logger.info("========== RAG PIPELINE END ==========")

    # Build response: make sure all classification info is in final_ticket even if DB update didn't run
    if "category" not in final_ticket:
        final_ticket["category"] = category
    if "priority" not in final_ticket:
        final_ticket["priority"] = priority
    if "department" not in final_ticket:
        final_ticket["department"] = department
    if "ai_response" not in final_ticket:
        final_ticket["ai_response"] = ai_response
    if "assigned_to" not in final_ticket or final_ticket["assigned_to"] is None:
        final_ticket["assigned_to"] = assigned_user_id

    # 5. Formulate and return API response
    return {
        "ticket": final_ticket,
        "retrieved_sops": retrieved_sops,
        "retrieved_chunks": retrieved_chunks_texts,
        "ai_response": ai_response
    }