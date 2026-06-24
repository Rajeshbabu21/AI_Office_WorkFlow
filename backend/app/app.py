import os
import requests
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"


from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile


from auth.auth import create_access_token,current_user,get_password_hash,verify_password,ACCESS_TOKEN_EXPIRE_MINUTES,verify_google_token
from auth.authschema import UserLogin,CreateUsers,Token,GoogleLoginRequest



from database.db import supabase

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from ticket.ticketschema import InsertTicket
from ticket.ticket import create_ticket, escalate_ticket_by_id
from ticket.ticketaiservice import classify_ticket
from rag.sop_service import process_sop_pdf
from rag.SOPschema import SOPCreate



from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,

    allow_origins=[
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "https://ai-office-work-flow.vercel.app",
    "https://ai-office-work-flow-backend.onrender.com="
    ],
    
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/ping")
def read_root():
    return {"ping": "pong"}


@app.post("/register_users")
def create_user(users: CreateUsers):
    try:
        # 1. Verify Google access token
        google_res = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {users.google_access_token}"}
        )
        if google_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Google authentication failed. Invalid token.")
            
        google_info = google_res.json()
        google_email = google_info.get("email")
        
        if not google_email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from Google.")
            
        if google_email.lower().strip() != users.email.lower().strip():
            raise HTTPException(
                status_code=400,
                detail="The Google account email does not match the email entered in the registration form."
            )
            
        # 2. Validate that Email is unique
        email_check = supabase.table("users").select("email").eq("email", users.email).execute()
        if email_check.data:
            raise HTTPException(status_code=400, detail="Email is already registered.")
            
        # 3. Validate that Employee ID is unique
        emp_check = supabase.table("users").select("employee_id").eq("employee_id", users.employee_id).execute()
        if emp_check.data:
            raise HTTPException(status_code=400, detail="Employee ID is already in use.")

        # 4. Hash password securely
        users.password_hash = get_password_hash(users.password_hash)
        
        # 5. Insert in database (excluding google_access_token)
        user_data = users.dict()
        user_data.pop("google_access_token", None)
        
        response = supabase.table("users").insert(user_data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="User not created")
            
        # 6. Generate JWT access token and return to log the user in immediately
        access_token = create_access_token(
            data={"sub": users.email},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "message": "User registered successfully"
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/user_login")
def login_users(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        response = (
            supabase
            .table("users")
            .select("*")
            .eq("email", form_data.username)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        user = response.data[0]

        if not verify_password(form_data.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        access_token = create_access_token(
            data={"sub": user["email"]},
            expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        )

        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    except Exception as e:
        print("LOGIN ERROR:", e)
        raise HTTPException(status_code=500, detail="Login failed")


@app.post("/auth/google")
def google_login(payload: GoogleLoginRequest):
    try:
        idinfo = verify_google_token(payload.token)
        email = idinfo.get("email")
        
        # Check if user already exists
        response = supabase.table("users").select("*").eq("email", email).execute()
        
        if response.data:
            user = response.data[0]
            # Log in the user and generate a JWT access token
            access_token = create_access_token(
                data={"sub": user["email"]},
                expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            )
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "registered": True
            }
        else:
            # User doesn't exist, tell frontend they need to register
            return {
                "registered": False,
                "email": email,
                "full_name": idinfo.get("name", ""),
                "message": "User not registered in the system. Please complete registration."
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@app.post("/insert_ticket")
def app_insert_ticket(
    ticket: InsertTicket,
    user: dict = Depends(current_user)
):
    return create_ticket(
        ticket=ticket,
        user_id=user["id"]
    )



@app.post("/upload_sop")
async def upload_sop(
    title: str = Form(...),
    department: str = Form(None),
    file: UploadFile = File(...),
    user: dict = Depends(current_user)
):
    try:
        # 1. Read file bytes
        file_bytes = await file.read()
        file_name = file.filename
        
        # 2. Upload file to Supabase Storage bucket 'sop-documents'
        storage_path = f"{user['id']}/{file_name}"
        
        upload_res = supabase.storage.from_("sop-documents").upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": "application/pdf", "x-upsert": "true"}
        )
        
        file_url = f"sop-documents/{storage_path}"
        
        # 3. Register SOP document in database
        sop_data = {
            "title": title,
            "department": department,
            "file_url": file_url,
            "uploaded_by": user["id"]
        }
        response = supabase.table("sop_documents").insert(sop_data).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to register SOP document in database"
            )
            
        created_sop = response.data[0]
        sop_id = created_sop["id"]
        
        # 4. Trigger processing of the PDF (download, parse, chunk, store)
        success = process_sop_pdf(sop_id=sop_id, file_url=created_sop["file_url"])
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="SOP document registered, but PDF text extraction/chunking failed."
            )
            
        return {
            "message": "SOP uploaded and processed successfully",
            "sop_document": created_sop
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )





@app.get("/ticket/{ticket_id}/assignee")
def get_ticket_assignee(ticket_id: int):
    # 1. Fetch ticket to check assigned_to
    ticket_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
    if not ticket_res.data:
        raise HTTPException(status_code=404, detail=f"Ticket with ID {ticket_id} not found")
    
    ticket_data = ticket_res.data[0]
    assigned_to = ticket_data.get("assigned_to")
    
    if not assigned_to:
        return {
            "ticket_id": ticket_id,
            "assigned_to": None,
            "agent_name": None,
            "agent_email": None,
            "department": None
        }
        
    # 2. Fetch agent details from users table
    user_res = supabase.table("users").select("*").eq("id", assigned_to).execute()
    if not user_res.data:
        return {
            "ticket_id": ticket_id,
            "assigned_to": assigned_to,
            "agent_name": "Unknown",
            "agent_email": None,
            "department": None
        }
        
    agent = user_res.data[0]
    return {
        "ticket_id": ticket_id,
        "assigned_to": assigned_to,
        "agent_name": agent.get("full_name"),
        "agent_email": agent.get("email"),
        "department": agent.get("department")
    }


@app.post("/ticket/{ticket_id}/escalate")
def escalate_ticket(ticket_id: int, reason: str = "User marked as not resolved"):
    return escalate_ticket_by_id(ticket_id, reason)

@app.get("/tickets")
def get_tickets(user: dict = Depends(current_user)):
    try:
        if user["role"] in ["admin", "support", "agent", "Support", "Admin", "Agent"]:
            response = (
                supabase
                .table("tickets")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
        else:
            response = (
                supabase
                .table("tickets")
                .select("*")
                .eq("user_id", user["id"])
                .order("created_at", desc=True)
                .execute()
            )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ticket/{ticket_id}")
def get_ticket_detail(ticket_id: int, user: dict = Depends(current_user)):
    try:
        ticket_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
        if not ticket_res.data:
            raise HTTPException(status_code=404, detail="Ticket not found")
        ticket = ticket_res.data[0]
        
        if ticket["user_id"] != user["id"] and user["role"] not in ["admin", "support", "agent", "Support", "Admin", "Agent"]:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        messages_res = supabase.table("ticket_messages").select("*").eq("ticket_id", ticket_id).order("created_at", asc=True).execute()
        history_res = supabase.table("ticket_history").select("*").eq("ticket_id", ticket_id).order("created_at", desc=True).execute()
        
        escalation_res = supabase.table("escalations").select("*").eq("ticket_id", ticket_id).order("escalated_at", desc=True).execute()
        escalation = escalation_res.data[0] if escalation_res.data else None
        
        jira_res = supabase.table("jira_tickets").select("*").eq("ticket_id", ticket_id).execute()
        jira_ticket = jira_res.data[0] if jira_res.data else None
        
        return {
            "ticket": ticket,
            "messages": messages_res.data or [],
            "history": history_res.data or [],
            "escalation": escalation,
            "jira_ticket": jira_ticket
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ticket/{ticket_id}/message")
def add_ticket_message(ticket_id: int, message: str = Form(...), user: dict = Depends(current_user)):
    try:
        ticket_res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
        if not ticket_res.data:
            raise HTTPException(status_code=404, detail="Ticket not found")
        ticket = ticket_res.data[0]
        
        if ticket["user_id"] != user["id"] and user["role"] not in ["admin", "support", "agent", "Support", "Admin", "Agent"]:
            raise HTTPException(status_code=403, detail="Forbidden")
            
        msg_res = supabase.table("ticket_messages").insert({
            "ticket_id": ticket_id,
            "sender_id": user["id"],
            "message": message
        }).execute()
        
        return msg_res.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

