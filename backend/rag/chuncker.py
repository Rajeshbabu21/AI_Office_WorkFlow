import os
import logging
from database.db import supabase
from rag.embeddings import get_embeddings

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

        logger.info(f"Generating local embeddings for {len(chunks)} chunks for SOP ID {sop_id}")
        
        # Generate 384-dimensional embeddings using local embedding service
        embeddings = get_embeddings(chunks)
        logger.info(f"Successfully generated {len(embeddings)} local embeddings (dim=384)")

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