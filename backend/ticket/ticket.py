import logging
from fastapi import FastAPI,Depends,HTTPException, status,Form, File, UploadFile
from ticket.ticketschema import InsertTicket
from database.db import supabase
from ticket.ticketaiservice import classify_ticket

# Setup basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_ticket(ticket, user_id):

    try:
        data = ticket.dict(exclude_none=True)
        data["user_id"] = user_id

        logger.info(f"Inserting ticket for user_id: {user_id} with title: {ticket.title}")

        ticket_response = (
            supabase
            .table("tickets")
            .insert(data)
            .execute()
        )

        if not ticket_response.data:
            logger.error("Ticket insertion failed - no data returned from database")
            raise HTTPException(
                status_code=400,
                detail="Ticket not created"
            )

        created_ticket = ticket_response.data[0]
        ticket_id = created_ticket["id"]
        logger.info(f"Ticket inserted successfully with ID: {ticket_id}")

        # AI Classification
        logger.info(f"Starting AI classification for ticket ID: {ticket_id}")
        ai_result = classify_ticket(
            title=ticket.title,
            description=ticket.description
        )
        logger.info(f"AI classification completed for ticket ID: {ticket_id}. Result: {ai_result}")

        # Save AI Result
        logger.info(f"Saving AI classification result for ticket ID: {ticket_id}")
        supabase.table("ai_classifications").insert({
            "ticket_id": ticket_id,
            "category": ai_result["category"],
            "priority": ai_result["priority"],
            "sentiment": ai_result["sentiment"],
            "confidence": ai_result["confidence"]
        }).execute()
        logger.info(f"AI classification result saved successfully for ticket ID: {ticket_id}")

        # Update Ticket
        logger.info(f"Updating ticket ID: {ticket_id} with category '{ai_result['category']}' and priority '{ai_result['priority']}'")
        supabase.table("tickets").update({
            "category": ai_result["category"],
            "priority": ai_result["priority"]
        }).eq("id", ticket_id).execute()
        logger.info(f"Ticket ID: {ticket_id} updated successfully with classification")

        updated_ticket = (
            supabase
            .table("tickets")
            .select("*")
            .eq("id", ticket_id)
            .execute()
        )

        return {
            "message": "Ticket created and classified successfully",
            "ticket": updated_ticket.data[0],
            "ai_result": ai_result
        }

    except Exception as e:
        logger.error(f"Error during ticket creation/classification for user_id {user_id}: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )