from pydantic import BaseModel,EmailStr
from typing import List,Optional
from datetime import date,time

class CreateUsers(BaseModel):
    full_name:str
    email:str
    employee_id:str
    department:str
    role:str
    password_hash:str

class UserLogin(BaseModel):
    email:str
    password:str

class Token(BaseModel):
    access_token:str
    token_type:str



class TokenData(BaseModel):
    email: Optional[str] = None
    


