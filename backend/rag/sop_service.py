import os
import io
import logging
import requests
from pypdf import PdfReader
from database.db import supabase
from rag.pdfprocessor import extract_text_from_pdf
from rag.chuncker import process_and_store_chunks

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def parse_supabase_path(file_url: str):
    if not file_url:
        return None, None
        
    file_url = file_url.replace("\\", "/")
    
    # Check if it is a full URL
    if file_url.startswith("http://") or file_url.startswith("https://"):
        for marker in ["/storage/v1/object/public/", "/storage/v1/object/authenticated/", "/storage/v1/object/sign/"]:
            if marker in file_url:
                parts = file_url.split(marker)[1].split("?")[0].split("/")
                if len(parts) >= 2:
                    bucket = parts[0]
                    path = "/".join(parts[1:])
                    return bucket, path
        
        if "/storage/v1/object/" in file_url:
            parts = file_url.split("/storage/v1/object/")[1].split("?")[0].split("/")
            if parts[0] in ["public", "authenticated", "sign"] and len(parts) >= 3:
                bucket = parts[1]
                path = "/".join(parts[2:])
                return bucket, path
            elif len(parts) >= 2:
                bucket = parts[0]
                path = "/".join(parts[1:])
                return bucket, path
                
        # External URL
        return None, None
    
    # If it is a relative path (e.g. 'bucket/path/to/file.pdf')
    parts = [p for p in file_url.split("/") if p]
    if len(parts) >= 2:
        bucket = parts[0]
        path = "/".join(parts[1:])
        return bucket, path
        
    # Fallback to 'sop-documents' bucket if no bucket structure is detected
    return "sop-documents", file_url

def download_pdf_from_storage(bucket: str, path: str) -> bytes:
    try:
        logger.info(f"Downloading PDF from Supabase Storage: bucket={bucket}, path={path}")
        pdf_bytes = supabase.storage.from_(bucket).download(path)
        return pdf_bytes
    except Exception as e:
        logger.error(f"Supabase Storage access failure for bucket '{bucket}', path '{path}': {e}")
        raise e

def download_pdf_from_url(url: str) -> bytes:
    try:
        logger.info(f"Downloading PDF from external URL: {url}")
        res = requests.get(url)
        res.raise_for_status()
        return res.content
    except Exception as e:
        logger.error(f"Failed to download PDF from URL: {e}")
        raise e

def process_sop_pdf(sop_id: int, file_url: str) -> bool:
    try:
        logger.info(f"Starting process_sop_pdf for SOP ID: {sop_id}, URL/Path: {file_url}")
        
        # 1. Parse and retrieve PDF bytes from Supabase Storage or external URL
        bucket, path = parse_supabase_path(file_url)
        
        pdf_bytes = None
        if bucket and path:
            try:
                pdf_bytes = download_pdf_from_storage(bucket, path)
            except Exception as storage_err:
                logger.error(f"Supabase Storage access failure for SOP ID {sop_id}: {storage_err}")
                return False
        else:
            try:
                pdf_bytes = download_pdf_from_url(file_url)
            except Exception as http_err:
                logger.error(f"External URL download failure for SOP ID {sop_id}: {http_err}")
                return False
                
        if not pdf_bytes:
            logger.error(f"Could not retrieve PDF bytes for SOP ID {sop_id}")
            return False
            
        # 2. Extract text from PDF using pypdf
        try:
            logger.info(f"Extracting text from PDF bytes for SOP ID: {sop_id}")
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = ""
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if not text.strip():
                raise ValueError("PDF parsing resulted in empty text content")
                
            logger.info(f"Extracted {len(text)} characters for SOP ID: {sop_id}")
        except Exception as pdf_err:
            logger.error(f"PDF parsing failure for SOP ID {sop_id}: {pdf_err}")
            return False
            
        # 3. Chunk and store in database
        try:
            logger.info(f"Chunking and storing text in database for SOP ID: {sop_id}")
            process_and_store_chunks(sop_id=sop_id, text=text)
        except Exception as db_err:
            logger.error(f"Chunk creation/database insertion failure for SOP ID {sop_id}: {db_err}")
            return False
            
        logger.info(f"Successfully processed and stored SOP PDF for ID: {sop_id}")
        return True
    except Exception as e:
        logger.error(f"Unexpected error in process_sop_pdf for SOP ID {sop_id}: {e}")
        return False