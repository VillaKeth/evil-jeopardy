"""Qdrant client wrapper with retry/lock handling and graceful degradation."""

import time
import logging

from qdrant_client import QdrantClient
from qdrant_client.http.exceptions import ResponseHandlingException

from .config import QDRANT_PATH, MAX_RETRIES, BASE_DELAY_S, EMBEDDING_MODEL

logger = logging.getLogger(__name__)


def get_client(max_retries: int = MAX_RETRIES, base_delay: float = BASE_DELAY_S) -> QdrantClient | None:
    """
    Create a QdrantClient with retry logic for locked databases.

    Returns None if all retries fail (graceful degradation).
    Caller is responsible for calling client.close() when done.
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            client = QdrantClient(path=QDRANT_PATH)
            client.set_model(EMBEDDING_MODEL)
            return client
        except (RuntimeError, ResponseHandlingException, OSError) as e:
            last_error = e
            err_str = str(e).lower()
            if "locked" in err_str or "busy" in err_str:
                if attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    logger.debug(
                        "Qdrant locked (attempt %d/%d), retrying in %.1fs",
                        attempt + 1, max_retries, delay,
                    )
                    time.sleep(delay)
                    continue
            logger.warning("Qdrant client error: %s", e)
            return None
        except Exception as e:
            logger.warning("Unexpected Qdrant error: %s", e)
            return None

    logger.warning(
        "Qdrant locked after %d retries (last error: %s)", max_retries, last_error
    )
    return None
