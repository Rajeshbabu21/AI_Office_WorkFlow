import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

supabse_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if not supabse_url or not supabase_key:
    raise ValueError(f"Supabase credentials missing. Ensure SUPABASE_URL and SUPABASE_KEY are configured in {env_path}")

supabase = create_client(supabse_url, supabase_key)