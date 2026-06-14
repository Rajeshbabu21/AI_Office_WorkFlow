from fastapi import FastAPI, Depends, HTTPException, status, Form, File, UploadFile


from auth.auth import create_access_token,current_user,get_password_hash,verify_password,ACCESS_TOKEN_EXPIRE_MINUTES
from auth.authschema import UserLogin,CreateUsers,Token

from database.db import supabase

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta



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