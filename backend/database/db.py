import os
from supabase import create_client,Client
from dotenv import load_dotenv

load_dotenv()
supabse_url=os.getenv("SUPABASE_URL")
supabase_key=os.getenv("SUPABASE_KEY")

supabase=create_client(supabse_url,supabase_key)