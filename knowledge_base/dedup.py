"""Deduplication logic for knowledge entries using cosine similarity."""

import logging
from qdrant_client import QdrantClient

from .config import COLLECTION_NAME, DEDUP_SIMILARITY_THRESHOLD

logger = logging.getLogger(__name__)


def find_duplicate(
    client: QdrantClient,
    text: str,
    threshold: float = DEDUP_SIMILARITY_THRESHOLD,
) -> dict | None:
    """
    Search for an existing entry that is semantically similar to the given text.

    Returns the matching point's payload + id if found, None otherwise.
    Uses qdrant-client's built-in query_text which handles embedding internally.
    """
    try:
        # Check if collection exists
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            return None

        results = client.query(
            collection_name=COLLECTION_NAME,
            query_text=text,
            limit=1,
        )

        if not results:
            return None

        top = results[0]
        score = top.score if hasattr(top, "score") else 0

        if score >= threshold:
            payload = {}
            if hasattr(top, "metadata") and top.metadata:
                payload = top.metadata
            elif hasattr(top, "payload") and top.payload:
                payload = top.payload

            point_id = top.id if hasattr(top, "id") else None
            return {"id": point_id, "score": score, "payload": payload}

        return None
    except Exception as e:
        logger.debug("Dedup search failed: %s", e)
        return None


def deduplicate_batch(items: list[str]) -> list[str]:
    """
    Remove near-duplicate entries within a batch using word overlap.

    This is a fast pre-filter before Qdrant similarity check.
    Uses 75% word overlap threshold.
    """
    unique = []
    for item in items:
        words = set(item.lower().split())
        is_dup = False
        for existing in unique:
            existing_words = set(existing.lower().split())
            if not words or not existing_words:
                continue
            overlap = len(words & existing_words) / min(len(words), len(existing_words))
            if overlap > 0.75:
                is_dup = True
                break
        if not is_dup:
            unique.append(item)
    return unique
