import os
import math
import logging
from typing import List
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
EMBEDDING_DIM = 384

# Cache for sentence-transformers model instance
_st_model = None
_st_model_failed = False

def _get_sentence_transformer_model():
    global _st_model, _st_model_failed
    if _st_model is not None:
        return _st_model
    if _st_model_failed:
        return None
    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Initializing local SentenceTransformer model 'all-MiniLM-L6-v2' (dim=384)...")
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        return _st_model
    except Exception as e:
        logger.warning(f"Could not load SentenceTransformer ('all-MiniLM-L6-v2'): {e}. Falling back to local deterministic embedding.")
        _st_model_failed = True
        return None

def _deterministic_fallback_vector(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """
    Generates a deterministic, normalized embedding vector of the target dimension.
    Ensures graceful, offline operation without external API calls or large model downloads.
    """
    if not text:
        return [0.0] * dim

    vec = [0.0] * dim
    words = text.lower().split()
    
    # Hash tokens and character n-grams into vector space
    for i, word in enumerate(words):
        h = hash(word)
        idx = abs(h) % dim
        weight = 1.0 / (1.0 + math.log(1.0 + i))
        vec[idx] += weight

        # Subword n-grams for semantic stability
        for n in range(2, min(5, len(word) + 1)):
            ngram = word[:n]
            n_idx = abs(hash(ngram)) % dim
            vec[n_idx] += (weight * 0.3)

    # Normalize vector to unit length (L2 norm)
    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    else:
        vec[0] = 1.0

    return vec[:dim]

def get_embedding(text: str) -> List[float]:
    """
    Generate a 384-dimensional embedding vector for the provided text.
    Uses local sentence-transformers if available, otherwise deterministic local vector.
    """
    text = (text or "").strip()
    if not text:
        return [0.0] * EMBEDDING_DIM

    # 1. Try local SentenceTransformer (all-MiniLM-L6-v2, native dim=384)
    model = _get_sentence_transformer_model()
    if model:
        try:
            raw_emb = model.encode(text, convert_to_numpy=True).tolist()
            if len(raw_emb) >= EMBEDDING_DIM:
                return raw_emb[:EMBEDDING_DIM]
            return raw_emb + [0.0] * (EMBEDDING_DIM - len(raw_emb))
        except Exception as err:
            logger.warning(f"SentenceTransformer encoding failed: {err}. Using local deterministic vector.")

    # 2. Deterministic local embedding fallback
    return _deterministic_fallback_vector(text, dim=EMBEDDING_DIM)

def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Generate 384-dimensional embedding vectors for a list of texts.
    """
    if not texts:
        return []

    model = _get_sentence_transformer_model()
    if model:
        try:
            raw_embs = model.encode(texts, convert_to_numpy=True).tolist()
            results = []
            for emb in raw_embs:
                if len(emb) >= EMBEDDING_DIM:
                    results.append(emb[:EMBEDDING_DIM])
                else:
                    results.append(emb + [0.0] * (EMBEDDING_DIM - len(emb)))
            return results
        except Exception as err:
            logger.warning(f"Batch SentenceTransformer encoding failed: {err}. Using local deterministic vectors.")

    return [get_embedding(t) for t in texts]
