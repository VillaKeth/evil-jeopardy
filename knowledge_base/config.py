"""Knowledge base configuration — paths, collection names, model settings."""

import os
import json

# Resolve project root from this file's location
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.environ.get("KB_PROJECT_ROOT", os.path.abspath(os.path.join(_THIS_DIR, "..")))

# Qdrant database
QDRANT_PATH = os.path.join(PROJECT_ROOT, "qdrant.db")

# Collection names
COLLECTION_NAME = "knowledge"
OLD_COLLECTION_NAMES = []

# Embedding model (must match what qdrant-client/fastembed expects)
EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
EMBEDDING_DIM = 768
DISTANCE_METRIC = "Cosine"

# Retry settings for locked database
MAX_RETRIES = 5
BASE_DELAY_S = 0.1  # 100ms, doubles each retry

# Deduplication
DEDUP_SIMILARITY_THRESHOLD = 0.92

# Search defaults
DEFAULT_SEARCH_LIMIT = 5
DEFAULT_CONFIDENCE_THRESHOLD = 0.5

# Extraction limits
MAX_MEMORIES_PER_EXTRACTION = 25
MAX_CONTEXT_LENGTH = 400
MIN_LINE_LENGTH = 30

# Fallback file for when Qdrant is unavailable
FALLBACK_JSONL_PATH = os.path.join(_THIS_DIR, "fallback.jsonl")

# Archival
ARCHIVE_DAYS = 30

# Document collection (separate from session memory)
DOCUMENTS_COLLECTION_NAME = "documents"

# Ingestion sources — loaded from kb_sources.json if it exists, otherwise sensible defaults
_SOURCES_FILE = os.path.join(PROJECT_ROOT, "kb_sources.json")

def _load_ingestion_sources():
    """Load ingestion sources from kb_sources.json or use auto-detection defaults."""
    if os.path.isfile(_SOURCES_FILE):
        with open(_SOURCES_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [(entry["dir"], entry["pattern"]) for entry in raw]

    # Auto-detect common project patterns
    sources = []
    common_dirs = {
        "docs": "**/*.md",
        "src": "**/*.{py,ts,js,tsx,jsx}",
        "lib": "**/*.{py,ts,js}",
        "app": "**/*.{py,ts,js,tsx,jsx}",
        "frontend": "**/*.{ts,tsx,js,jsx}",
        "backend": "**/*.{py,ts,js}",
        "server": "**/*.{py,ts,js}",
        "api": "**/*.{py,ts,js}",
    }
    for dirname, pattern in common_dirs.items():
        if os.path.isdir(os.path.join(PROJECT_ROOT, dirname)):
            sources.append((dirname, pattern))

    # Always include root docs
    sources.append((".", "README.md"))
    sources.append((".", "TODO.md"))
    sources.append((".github", "copilot-instructions.md"))

    return sources

INGESTION_SOURCES = _load_ingestion_sources()

FILE_HASHES_PATH = os.path.join(_THIS_DIR, "file_hashes.json")
MAX_CHUNK_TOKENS = 500
MIN_CHUNK_TOKENS = 50

# Agent hook settings
HOOK_RELEVANCE_THRESHOLD = 0.65
HOOK_TOKEN_BUDGET = 2000
HOOK_SESSION_BOOST = 1.10
HOOK_CROSS_DEDUP_THRESHOLD = 0.85
