from passlib.context import CryptContext
from database.db import supabase
from fastapi import HTTPException, status,FastAPI,Depends
from fastapi.security import OAuth2PasswordBearer   
from typing import Optional
from auth.authschema import CreateUsers,TokenData,Token,UserLogin
from dotenv import load_dotenv
import os
from datetime import datetime, timedelta
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from pathlib import Path
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("secret_key") or "supersecretkey"
ALGORITHM = os.getenv("ALGORITHM") or os.getenv("algorithm") or "HS256"
_token_expire = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or os.getenv("access_token_expire_minutes") or "30"
ACCESS_TOKEN_EXPIRE_MINUTES = int(_token_expire)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user_login")

def verify_password(plain_password:str, password: str)->bool:
    return pwd_context.verify(plain_password[:72], password)

def get_password_hash(password: str)->str:
    password = password[:72]
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verfiy_token(token:str)->TokenData:
    credentials_exception = HTTPException(
        status_code=401,
        detail="could not validate",
        headers={"WWW-Authenticate":"Bearer"}
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = TokenData(email=email)
    except jwt.PyJWTError:
        raise credentials_exception
    return token_data

def current_user(token:str=Depends(oauth2_scheme)):
    token_data = verfiy_token(token)
    response = supabase.table("users").select("*").eq("email",token_data.email).execute()
    user = response.data
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user[0]

def get_current_active_user(current_user: dict = Depends(current_user)):
    return current_user

def verify_google_token(token: str) -> dict:
    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    try:
        # Verify Google token. Allow empty GOOGLE_CLIENT_ID for easier developer onboarding/local sandbox testing.
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            audience=google_client_id if google_client_id else None
        )
        return idinfo
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google token: {str(e)}"
        )