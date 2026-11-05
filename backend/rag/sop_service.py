import os
import io
import time
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
        logger.info(f"[RAG-INGEST] Fetching PDF from Supabase Storage: bucket='{bucket}', path='{path}'")
        t0 = time.perf_counter()
        pdf_bytes = supabase.storage.from_(bucket).download(path)
        logger.info(f"[RAG-INGEST] PDF downloaded successfully ({len(pdf_bytes):,} bytes) in {time.perf_counter() - t0:.2f}s")
        return pdf_bytes
    except Exception as e:
        logger.error(f"[RAG-INGEST ERROR] Supabase Storage access failure for bucket '{bucket}', path '{path}': {e}")
        raise e

def download_pdf_from_url(url: str) -> bytes:
    try:
        logger.info(f"[RAG-INGEST] Downloading PDF from external URL: {url}")
        t0 = time.perf_counter()
        res = requests.get(url)
        res.raise_for_status()
        logger.info(f"[RAG-INGEST] PDF downloaded successfully ({len(res.content):,} bytes) in {time.perf_counter() - t0:.2f}s")
        return res.content
    except Exception as e:
        logger.error(f"[RAG-INGEST ERROR] Failed to download PDF from URL: {e}")
        raise e

def process_sop_pdf(sop_id: int, file_url: str) -> bool:
    start_time = time.perf_counter()
    try:
        logger.info(f"[RAG-INGEST] Starting document processing for SOP ID #{sop_id} | Resource: '{file_url}'")
        
        # 1. Parse and retrieve PDF bytes from Supabase Storage or external URL
        bucket, path = parse_supabase_path(file_url)
        
        pdf_bytes = None
        if bucket and path:
            try:
                pdf_bytes = download_pdf_from_storage(bucket, path)
            except Exception as storage_err:
                logger.error(f"[RAG-INGEST ERROR] Storage download failure for SOP ID #{sop_id}: {storage_err}")
                return False
        else:
            try:
                pdf_bytes = download_pdf_from_url(file_url)
            except Exception as http_err:
                logger.error(f"[RAG-INGEST ERROR] External URL download failure for SOP ID #{sop_id}: {http_err}")
                return False
                
        if not pdf_bytes:
            logger.error(f"[RAG-INGEST ERROR] Empty PDF payload received for SOP ID #{sop_id}")
            return False
            
        # 2. Extract text from PDF using pypdf
        try:
            logger.info(f"[RAG-INGEST] Extracting text from PDF for SOP ID #{sop_id}...")
            t_extract = time.perf_counter()
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = ""
            total_pages = len(reader.pages)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if not text.strip():
                logger.warning(f"[RAG-INGEST WARNING] PDF parsing resulted in 0 characters across {total_pages} pages for SOP ID #{sop_id}")
                raise ValueError("PDF parsing resulted in empty text content")
                
            extract_duration = time.perf_counter() - t_extract
            logger.info(f"[RAG-INGEST] Text extraction complete: {total_pages} pages, {len(text):,} characters extracted in {extract_duration:.2f}s")
        except Exception as pdf_err:
            logger.error(f"[RAG-INGEST ERROR] PDF parsing failure for SOP ID #{sop_id}: {pdf_err}")
            return False
            
        # 3. Chunk and store in database
        try:
            logger.info(f"[RAG-INGEST] Initiating text chunking and vector storage for SOP ID #{sop_id}...")
            process_and_store_chunks(sop_id=sop_id, text=text)
        except Exception as db_err:
            logger.error(f"[RAG-INGEST ERROR] Chunk creation or database insertion failed for SOP ID #{sop_id}: {db_err}")
            return False
            
        total_duration = time.perf_counter() - start_time
        logger.info(f"[RAG-INGEST] Successfully processed, chunked, and embedded SOP ID #{sop_id} in {total_duration:.2f}s")
        return True
    except Exception as e:
        logger.error(f"[RAG-INGEST ERROR] Unexpected failure in process_sop_pdf for SOP ID #{sop_id}: {e}")
        return False