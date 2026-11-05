import os
import time
import logging
from database.db import supabase
from rag.embeddings import get_embeddings

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def chunk_text(text: str, chunk_size: int = 500) -> list:
    chunks = []
    if not text:
        logger.warning("[RAG-INGEST WARNING] Empty text received for chunking.")
        return chunks

    logger.info(f"[RAG-INGEST] Splitting document text ({len(text):,} characters) into chunks of size={chunk_size}...")
    for i in range(0, len(text), chunk_size):
        chunk = text[i:i + chunk_size]
        chunks.append(chunk)

    logger.info(f"[RAG-INGEST] Chunking completed: {len(chunks)} chunks created (avg length: {sum(len(c) for c in chunks) // len(chunks)} chars)")
    return chunks

def store_chunks(sop_id: int, chunks: list):
    try:
        if not chunks:
            logger.warning(f"[RAG-INGEST WARNING] No chunks available to store for SOP ID #{sop_id}")
            return None

        logger.info(f"[RAG-INGEST] Generating vector embeddings for {len(chunks)} chunks for SOP ID #{sop_id}...")
        t0 = time.perf_counter()
        # Generate 384-dimensional embeddings using local embedding service
        embeddings = get_embeddings(chunks)
        emb_duration = time.perf_counter() - t0
        emb_dim = len(embeddings[0]) if embeddings else 384
        logger.info(f"[RAG-INGEST] Successfully generated {len(embeddings)} embeddings (dim={emb_dim}) in {emb_duration:.2f}s")

        logger.info(f"[RAG-INGEST] Preparing payload and inserting {len(chunks)} records into 'sop_chunks' table for SOP ID #{sop_id}...")
        t_db = time.perf_counter()
        
        # Prepare bulk insert payload
        payload = []
        for chunk, emb in zip(chunks, embeddings):
            payload.append({
                "sop_id": sop_id,
                "chunk_text": chunk,
                "embedding": emb
            })
        
        res = supabase.table("sop_chunks").insert(payload).execute()
        db_duration = time.perf_counter() - t_db
        logger.info(f"[RAG-INGEST] Successfully stored {len(chunks)} chunks and vector embeddings in database for SOP ID #{sop_id} in {db_duration:.2f}s")
        return res
    except Exception as e:
        logger.error(f"[RAG-INGEST ERROR] Failed to store chunks/embeddings in database for SOP ID #{sop_id}: {e}")
        raise e

def process_and_store_chunks(sop_id: int, text: str, chunk_size: int = 500):
    chunks = chunk_text(text, chunk_size)
    return store_chunks(sop_id, chunks)