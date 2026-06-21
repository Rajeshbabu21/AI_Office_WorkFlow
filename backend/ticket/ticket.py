import os
import logging
import google.generativeai as genai
from fastapi import FastAPI, Depends, HTTPException, status
from ticket.ticketschema import InsertTicket
from database.db import supabase
from ticket.ticketaiservice import classify_ticket, generate_ticket_response

# Setup basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
            
            # Format context with metadata according to prompt requirements:
            # SOP Document: ...
            # Department: ...
            # Relevant Content: ...
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

    # 5. Formulate and return API response
    return {
        "ticket": final_ticket,
        "retrieved_sops": retrieved_sops,
        "retrieved_chunks": retrieved_chunks_texts,
        "ai_response": ai_response
    }