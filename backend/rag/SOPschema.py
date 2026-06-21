
from pydantic import BaseModel


class SOPCreate(BaseModel):
    title: str
    file_url: str