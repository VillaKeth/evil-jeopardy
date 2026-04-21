"""Document ingestion pipeline with file-hash change detection."""
from __future__ import annotations
import glob as glob_module
import hashlib
import json
import logging
import os
from .backends import Chunk
from .config import MAX_CHUNK_TOKENS, MIN_CHUNK_TOKENS, FILE_HASHES_PATH

logger = logging.getLogger(__name__)

# Lazy-init chunkers so the module loads even if chunker.py isn't created yet
_md_chunker = None
_code_chunker = None


def _get_chunkers():
    global _md_chunker, _code_chunker
    if _md_chunker is None:
        from .chunker import MarkdownChunker, CodeChunker
        _md_chunker = MarkdownChunker(max_tokens=MAX_CHUNK_TOKENS, min_tokens=MIN_CHUNK_TOKENS)
        _code_chunker = CodeChunker(min_tokens=MIN_CHUNK_TOKENS)
    return _md_chunker, _code_chunker

LANGUAGE_MAP = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".drl": "drl",
    ".md": "markdown",
}


def get_language_for_file(filepath: str) -> str | None:
    ext = os.path.splitext(filepath)[1].lower()
    return LANGUAGE_MAP.get(ext)


EXCLUDED_DIRS = {"node_modules", ".git", "__pycache__", ".venv", "venv", ".tox", "dist", "build"}


def discover_files(project_root: str, sources: list[tuple[str, str]]) -> list[str]:
    """Walk configured source paths and return matching file paths (relative to project_root)."""
    found = []
    for base_dir, pattern in sources:
        abs_base = os.path.join(project_root, base_dir)
        if not os.path.isdir(abs_base) and not os.path.isfile(abs_base):
            direct = os.path.join(project_root, base_dir, pattern)
            if os.path.isfile(direct):
                found.append(os.path.relpath(direct, project_root).replace("\\", "/"))
            continue

        full_pattern = os.path.join(abs_base, pattern)
        for filepath in glob_module.glob(full_pattern, recursive=True):
            if os.path.isfile(filepath):
                rel = os.path.relpath(filepath, project_root).replace("\\", "/")
                parts = rel.replace("\\", "/").split("/")
                if any(p in EXCLUDED_DIRS for p in parts):
                    continue
                found.append(rel)

    return sorted(set(found))


def compute_file_hash(filepath: str) -> str:
    """Compute SHA-256 hash of file contents."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for block in iter(lambda: f.read(8192), b""):
            h.update(block)
    return f"sha256:{h.hexdigest()}"


def load_file_hashes(path: str = FILE_HASHES_PATH) -> dict[str, str]:
    """Load stored file hashes from JSON."""
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_file_hashes(hashes: dict[str, str], path: str = FILE_HASHES_PATH) -> None:
    """Save file hashes to JSON."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(hashes, f, indent=2, sort_keys=True)


def detect_changes(
    current_hashes: dict[str, str], stored_hashes: dict[str, str]
) -> tuple[list[str], list[str], list[str]]:
    """Compare current vs stored hashes. Returns (added, changed, removed) file lists."""
    added = [f for f in current_hashes if f not in stored_hashes]
    changed = [f for f in current_hashes if f in stored_hashes and current_hashes[f] != stored_hashes[f]]
    removed = [f for f in stored_hashes if f not in current_hashes]
    return added, changed, removed


def chunk_file(project_root: str, rel_path: str) -> list[Chunk]:
    """Read and chunk a single file based on its type."""
    abs_path = os.path.join(project_root, rel_path)
    language = get_language_for_file(rel_path)

    if language is None:
        logger.debug("Skipping unsupported file type: %s", rel_path)
        return []

    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except (OSError, IOError) as e:
        logger.warning("Failed to read %s: %s", rel_path, e)
        return []

    if not text.strip():
        return []

    file_hash = compute_file_hash(abs_path)
    metadata = {
        "file_path": rel_path,
        "file_hash": file_hash,
        "file_type": language,
    }

    md_chunker, code_chunker = _get_chunkers()
    if language == "markdown":
        return md_chunker.chunk_markdown(text, metadata)
    else:
        return code_chunker.chunk_code(text, language, metadata)
