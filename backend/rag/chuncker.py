import os
import logging
from database.db import supabase
import google.generativeai as genai

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def chunk_text(text: str, chunk_size: int = 500) -> list:
    chunks = []
    if not text:
        return chunks

    for i in range(0, len(text), chunk_size):
        chunk = text[i:i + chunk_size]
        chunks.append(chunk)

    return chunks

def store_chunks(sop_id: int, chunks: list):
    try:
        if not chunks:
            logger.warning(f"No chunks provided to store for SOP ID: {sop_id}")
            return None

        logger.info(f"Generating embeddings for {len(chunks)} chunks for SOP ID {sop_id}")
        
        # Configure genai key
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
        else:
            logger.error("GEMINI_API_KEY not found in environment variables.")
            
        # Try to generate embeddings in batch
        try:
            embed_res = genai.embed_content(
                model="models/gemini-embedding-001",
                content=chunks,
                task_type="retrieval_document"
            )
            # Truncate each embedding vector to 384 dimensions
            embeddings = [emb[:384] for emb in embed_res["embedding"]]
            logger.info("Batch embedding generation successful")
        except Exception as embed_err:
            logger.warning(f"Batch embedding generation failed: {embed_err}. Falling back to sequential generation.")
            embeddings = []
            for chunk in chunks:
                single_res = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=chunk,
                    task_type="retrieval_document"
                )
                embeddings.append(single_res["embedding"][:384])
            logger.info("Sequential embedding generation successful")

        logger.info(f"Storing {len(chunks)} chunks with embeddings for SOP ID {sop_id} in database")
        
        # Prepare bulk insert payload
        payload = []
        for chunk, emb in zip(chunks, embeddings):
            payload.append({
                "sop_id": sop_id,
                "chunk_text": chunk,
                "embedding": emb
            })
        
        res = supabase.table("sop_chunks").insert(payload).execute()
        logger.info(f"Successfully stored chunks and embeddings in database for SOP ID {sop_id}")
        return res
    except Exception as e:
        logger.error(f"Failed to store chunks and embeddings in database for SOP ID {sop_id}: {e}")
        raise e

def process_and_store_chunks(sop_id: int, text: str, chunk_size: int = 500):
    chunks = chunk_text(text, chunk_size)
    return store_chunks(sop_id, chunks)