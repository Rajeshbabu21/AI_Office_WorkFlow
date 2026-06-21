from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile


from auth.auth import create_access_token,current_user,get_password_hash,verify_password,ACCESS_TOKEN_EXPIRE_MINUTES
from auth.authschema import UserLogin,CreateUsers,Token

from database.db import supabase

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from ticket.ticketschema import InsertTicket
from ticket.ticket import create_ticket
from ticket.ticketaiservice import classify_ticket
from rag.sop_service import process_sop_pdf
from rag.SOPschema import SOPCreate


app = FastAPI()

@app.get("/ping")
def read_root():
    return {"ping": "pong"}


@app.post("/register_users")
def create_user(users: CreateUsers):
    try:
        users.password_hash = get_password_hash(users.password_hash)
        data = users.dict()
        response = supabase.table("users").insert(data).execute()
        if not response.data:
            raise HTTPException(status_code=400, detail="User not created")
        return {
            "message": "User created successfully",
            "data": response.data
        }
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