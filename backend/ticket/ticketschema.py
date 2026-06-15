from pydantic import BaseModel,EmailStr
from typing import List,Optional
from datetime import date,time

class InsertTicket(BaseModel):
    title: str
    description: str
    category: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None




    


