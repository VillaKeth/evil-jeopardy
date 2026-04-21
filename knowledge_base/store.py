"""Core knowledge store — add, search, update, list, stats, migrate."""

import json
import logging
import uuid
from datetime import datetime, timezone

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from .categories import CategorizedEntry, is_valid_category
from .client import get_client
from .config import (
    COLLECTION_NAME,
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_SEARCH_LIMIT,
    DOCUMENTS_COLLECTION_NAME,
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    FALLBACK_JSONL_PATH,
    OLD_COLLECTION_NAMES,
)
from .dedup import find_duplicate

logger = logging.getLogger(__name__)


def _ensure_collection(client: QdrantClient) -> bool:
    """Check if the knowledge collection exists. Returns True if it does.
    
    Note: We do NOT pre-create the collection here. The first call to
    client.add() will auto-create it with the correct vector config
    matching fastembed's default model. This avoids vector name mismatches.
    """
    try:
        collections = [c.name for c in client.get_collections().collections]
        return COLLECTION_NAME in collections
    except Exception as e:
        logger.error("Failed to check collection: %s", e)
        return False


def _write_fallback(entry: dict) -> None:
    """Write an entry to the fallback JSONL file when Qdrant is unavailable."""
    try:
        entry["_pending"] = True
        entry["_fallback_time"] = datetime.now(timezone.utc).isoformat()
        with open(FALLBACK_JSONL_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        logger.info("Wrote entry to fallback JSONL")
    except Exception as e:
        logger.error("Fallback write failed: %s", e)


def flush_fallback() -> int:
    """Flush pending entries from fallback JSONL into Qdrant. Returns count flushed."""
    import os
    if not os.path.exists(FALLBACK_JSONL_PATH):
        return 0

    entries = []
    try:
        with open(FALLBACK_JSONL_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    entries.append(json.loads(line))
    except Exception as e:
        logger.error("Failed to read fallback file: %s", e)
        return 0

    if not entries:
        return 0

    flushed = 0
    for entry in entries:
        entry.pop("_pending", None)
        entry.pop("_fallback_time", None)
        result = add(
            text=entry.get("text", ""),
            category=entry.get("category", "lesson_learned"),
            tags=entry.get("tags", []),
            references=entry.get("references", []),
            source=entry.get("source", "fallback"),
        )
        if result:
            flushed += 1

    if flushed == len(entries):
        try:
            os.remove(FALLBACK_JSONL_PATH)
        except OSError:
            pass

    return flushed


def add(
    text: str,
    category: str,
    confidence: float = 0.80,
    tags: list[str] | None = None,
    references: list[str] | None = None,
    source: str = "session",
    session_id: str | None = None,
    subcategory: str | None = None,
    _client: QdrantClient | None = None,
) -> dict | None:
    """
    Add a knowledge entry. Deduplicates automatically.

    Returns the stored payload dict on success, None on failure.
    If a duplicate is found (>80% similarity), the existing entry is updated instead.
    Pass _client to reuse an existing connection (e.g. during migration).
    """
    if not text or not text.strip():
        return None

    if not is_valid_category(category):
        logger.warning("Invalid category '%s', defaulting to lesson_learned", category)
        category = "lesson_learned"

    owns_client = _client is None
    client = _client or get_client()
    if client is None:
        _write_fallback({"text": text, "category": category, "tags": tags or [], "source": source})
        return None

    try:
        # Check for duplicates (only if collection exists)
        existing = None
        if _ensure_collection(client):
            existing = find_duplicate(client, text)
        now = datetime.now(timezone.utc).isoformat()

        if existing:
            # Update existing entry
            existing_payload = existing["payload"]
            existing_text = existing_payload.get("document", existing_payload.get("text", ""))

            # Keep the longer/richer text
            final_text = text if len(text) > len(existing_text) else existing_text

            updated_payload = {
                "document": final_text,
                "text": final_text,
                "category": category,
                "subcategory": subcategory,
                "source": source,
                "confidence": max(confidence, existing_payload.get("confidence", 0)),
                "created_at": existing_payload.get("created_at", now),
                "updated_at": now,
                "session_id": session_id,
                "tags": list(set((tags or []) + existing_payload.get("tags", []))),
                "references": list(set((references or []) + existing_payload.get("references", []))),
                "supersedes": None,
                "access_count": existing_payload.get("access_count", 0),
                "last_accessed": existing_payload.get("last_accessed"),
            }

            client.set_payload(
                collection_name=COLLECTION_NAME,
                payload=updated_payload,
                points=[existing["id"]],
            )
            logger.info("Updated existing knowledge entry (similarity: %.2f)", existing["score"])
            return updated_payload

        # Create new entry
        point_id = str(uuid.uuid4())
        payload = {
            "document": text,
            "text": text,
            "category": category,
            "subcategory": subcategory,
            "source": source,
            "confidence": confidence,
            "created_at": now,
            "updated_at": now,
            "session_id": session_id,
            "tags": tags or [],
            "references": references or [],
            "supersedes": None,
            "access_count": 0,
            "last_accessed": None,
        }

        client.add(
            collection_name=COLLECTION_NAME,
            documents=[text],
            metadata=[payload],
            ids=[point_id],
        )
        logger.info("Added new knowledge entry: %s [%s]", text[:60], category)
        return payload

    except Exception as e:
        logger.error("Failed to add knowledge: %s", e)
        _write_fallback({"text": text, "category": category, "tags": tags or [], "source": source})
        return None
    finally:
        if owns_client:
            try:
                client.close()
            except Exception:
                pass


def update_entry(
    point_id: str,
    text: str | None = None,
    category: str | None = None,
    tags: list[str] | None = None,
) -> dict | None:
    """Update an existing knowledge entry by ID. Only provided fields are changed."""
    client = get_client()
    if client is None:
        return None

    try:
        # Fetch existing entry using the same client connection
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            return None

        results, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=False,
        )

        existing = None
        for point in results:
            if str(point.id) == point_id:
                existing = point.payload or {}
                break

        if existing is None:
            return None

        existing_text = existing.get("document", existing.get("text", ""))
        now = datetime.now(timezone.utc).isoformat()

        updated_payload = {
            "document": text if text else existing_text,
            "text": text if text else existing_text,
            "category": category if category else existing.get("category"),
            "subcategory": existing.get("subcategory"),
            "source": existing.get("source", "manual"),
            "confidence": existing.get("confidence", 1.0),
            "created_at": existing.get("created_at", now),
            "updated_at": now,
            "session_id": existing.get("session_id"),
            "tags": tags if tags is not None else existing.get("tags", []),
            "references": existing.get("references", []),
            "supersedes": None,
            "access_count": existing.get("access_count", 0),
            "last_accessed": existing.get("last_accessed"),
        }

        # Re-embed if text changed
        if text:
            client.add(
                collection_name=COLLECTION_NAME,
                documents=[text],
                metadata=[updated_payload],
                ids=[point_id],
            )
        else:
            client.set_payload(
                collection_name=COLLECTION_NAME,
                payload=updated_payload,
                points=[point_id],
            )

        logger.info("Updated knowledge entry %s", point_id)
        return updated_payload
    except Exception as e:
        logger.error("Failed to update entry: %s", e)
        return None
    finally:
        try:
            client.close()
        except Exception:
            pass


def delete_entry(point_id: str) -> bool:
    """Delete a knowledge entry by ID. Returns True on success."""
    client = get_client()
    if client is None:
        return False

    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=[point_id],
        )
        logger.info("Deleted knowledge entry %s", point_id)
        return True
    except Exception as e:
        logger.error("Failed to delete entry: %s", e)
        return False
    finally:
        try:
            client.close()
        except Exception:
            pass


def search(
    query: str,
    limit: int = DEFAULT_SEARCH_LIMIT,
    category: str | None = None,
    min_confidence: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> list[dict]:
    """
    Search knowledge entries semantically.

    Returns list of dicts with keys: id, score, text, category, confidence, tags.
    Updates access_count and last_accessed for returned entries.
    """
    if not query or not query.strip():
        return []

    client = get_client()
    if client is None:
        return []

    try:
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            return []

        query_filter = None
        if category and is_valid_category(category):
            query_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=category))]
            )

        results = client.query(
            collection_name=COLLECTION_NAME,
            query_text=query,
            query_filter=query_filter,
            limit=limit * 2,  # Over-fetch to allow confidence filtering
        )

        entries = []
        ids_to_update = []
        now = datetime.now(timezone.utc).isoformat()

        for point in results:
            payload = {}
            if hasattr(point, "metadata") and point.metadata:
                payload = point.metadata
            elif hasattr(point, "payload") and point.payload:
                payload = point.payload

            conf = payload.get("confidence", 0.5)
            if conf < min_confidence:
                continue

            text = payload.get("document", payload.get("text", ""))
            if not text:
                continue

            point_id = point.id if hasattr(point, "id") else None
            score = point.score if hasattr(point, "score") else 0

            entries.append({
                "id": point_id,
                "score": round(score, 4),
                "text": text,
                "category": payload.get("category", "unknown"),
                "confidence": conf,
                "tags": payload.get("tags", []),
            })

            if point_id:
                ids_to_update.append((point_id, payload.get("access_count", 0)))

            if len(entries) >= limit:
                break

        # Update access counts
        for pid, current_count in ids_to_update:
            try:
                client.set_payload(
                    collection_name=COLLECTION_NAME,
                    payload={
                        "access_count": current_count + 1,
                        "last_accessed": now,
                    },
                    points=[pid],
                )
            except Exception:
                pass  # Non-critical

        return entries

    except Exception as e:
        logger.error("Search failed: %s", e)
        return []
    finally:
        try:
            client.close()
        except Exception:
            pass


def list_entries(
    category: str | None = None,
    limit: int = 50,
) -> list[dict]:
    """List knowledge entries, optionally filtered by category."""
    client = get_client()
    if client is None:
        return []

    try:
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            return []

        scroll_filter = None
        if category and is_valid_category(category):
            scroll_filter = Filter(
                must=[FieldCondition(key="category", match=MatchValue(value=category))]
            )

        results, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=scroll_filter,
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        entries = []
        for point in results:
            payload = point.payload or {}
            text = payload.get("document", payload.get("text", ""))
            entries.append({
                "id": str(point.id),
                "text": text,
                "category": payload.get("category", "unknown"),
                "confidence": payload.get("confidence", 0),
                "access_count": payload.get("access_count", 0),
                "created_at": payload.get("created_at", ""),
                "tags": payload.get("tags", []),
            })

        return entries

    except Exception as e:
        logger.error("List failed: %s", e)
        return []
    finally:
        try:
            client.close()
        except Exception:
            pass


def stats() -> dict:
    """Get knowledge base statistics."""
    client = get_client()
    if client is None:
        return {"error": "Could not connect to Qdrant"}

    try:
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            return {"collection": COLLECTION_NAME, "exists": False, "total": 0}

        info = client.get_collection(COLLECTION_NAME)
        total = info.points_count or 0

        # Count by category
        category_counts = {}
        all_entries, _ = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=10000,
            with_payload=True,
            with_vectors=False,
        )
        for point in all_entries:
            cat = (point.payload or {}).get("category", "unknown")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {
            "collection": COLLECTION_NAME,
            "exists": True,
            "total": total,
            "by_category": category_counts,
            "old_collections": {
                name: (
                    client.get_collection(name).points_count
                    if name in collections
                    else 0
                )
                for name in OLD_COLLECTION_NAMES
            },
        }

    except Exception as e:
        logger.error("Stats failed: %s", e)
        return {"error": str(e)}
    finally:
        try:
            client.close()
        except Exception:
            pass


def list_documents(
    file_path: str | None = None,
    cursor: str | None = None,
    limit: int = 50,
) -> dict:
    """Export document chunks with cursor-based pagination.

    Returns dict with keys: total, limit, next_cursor, chunks (list of dicts).
    Each chunk: {id, text, source, chunk_index, metadata}.
    Pass next_cursor as cursor to get the next page.
    """
    client = get_client()
    if client is None:
        return {"total": 0, "limit": limit, "next_cursor": None, "chunks": []}

    try:
        collections = [c.name for c in client.get_collections().collections]
        if DOCUMENTS_COLLECTION_NAME not in collections:
            return {"total": 0, "limit": limit, "next_cursor": None, "chunks": []}

        scroll_filter = None
        if file_path:
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            scroll_filter = Filter(
                must=[FieldCondition(key="file_path", match=MatchValue(value=file_path))]
            )

        offset_param = cursor if cursor else None

        results, next_cursor = client.scroll(
            collection_name=DOCUMENTS_COLLECTION_NAME,
            scroll_filter=scroll_filter,
            limit=limit,
            offset=offset_param,
            with_payload=True,
            with_vectors=False,
        )

        chunks = []
        for point in results:
            payload = point.payload or {}
            # Use file_path as the primary source field
            source = payload.get("file_path", payload.get("source", ""))
            chunks.append({
                "id": str(point.id),
                "text": payload.get("text", payload.get("document", "")),
                "source": source,
                "chunk_index": payload.get("chunk_index", 0),
                "metadata": {
                    k: v for k, v in payload.items()
                    if k not in ("text", "document", "file_path", "chunk_index")
                },
            })

        info = client.get_collection(DOCUMENTS_COLLECTION_NAME)
        total = info.points_count or 0

        return {
            "total": total,
            "limit": limit,
            "next_cursor": str(next_cursor) if next_cursor else None,
            "chunks": chunks,
        }

    except Exception as e:
        logger.error("list_documents failed: %s", e)
        return {"error": str(e)}
    finally:
        try:
            client.close()
        except Exception:
            pass


def list_document_tree() -> list[dict]:
    """Return file tree of indexed documents grouped by directory.

    Returns list of dicts: {source, chunk_count, directory}.
    """
    client = get_client()
    if client is None:
        return []

    try:
        collections = [c.name for c in client.get_collections().collections]
        if DOCUMENTS_COLLECTION_NAME not in collections:
            return []

        file_counts: dict[str, int] = {}
        offset = None
        while True:
            results, next_offset = client.scroll(
                collection_name=DOCUMENTS_COLLECTION_NAME,
                scroll_filter=None,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            if not results:
                break
            for point in results:
                payload = point.payload or {}
                # Use file_path as the primary source field
                source = payload.get("file_path", payload.get("source", "unknown"))
                file_counts[source] = file_counts.get(source, 0) + 1
            offset = next_offset
            if offset is None:
                break

        tree = []
        for source, count in sorted(file_counts.items()):
            parts = source.replace("\\", "/").split("/")
            directory = "/".join(parts[:-1]) if len(parts) > 1 else "."
            tree.append({
                "source": source,
                "chunk_count": count,
                "directory": directory,
            })
        return tree

    except Exception as e:
        logger.error("list_document_tree failed: %s", e)
        return []
    finally:
        try:
            client.close()
        except Exception:
            pass


def migrate() -> dict:
    """
    Migrate entries from old collections (memory, wellnessscape_memory)
    into the new 'knowledge' collection with proper categorization.

    Returns migration summary.
    """
    from .categories import categorize_text

    client = get_client()
    if client is None:
        return {"error": "Could not connect to Qdrant"}

    try:
        # Collection will be auto-created by first client.add() call
        collections = [c.name for c in client.get_collections().collections]
        summary = {"migrated": 0, "skipped": 0, "duplicates": 0, "errors": 0}

        for old_name in OLD_COLLECTION_NAMES:
            if old_name not in collections:
                continue

            results, _ = client.scroll(
                collection_name=old_name,
                limit=10000,
                with_payload=True,
                with_vectors=False,
            )

            for point in results:
                payload = point.payload or {}
                text = payload.get("document", payload.get("text", ""))
                if not text or len(text.strip()) < 10:
                    summary["skipped"] += 1
                    continue

                # Auto-categorize
                cat_result = categorize_text(text)
                category = cat_result.category if cat_result else "lesson_learned"
                confidence = cat_result.confidence if cat_result else 0.60

                result = add(
                    text=text,
                    category=category,
                    confidence=confidence,
                    source=f"migrated_from_{old_name}",
                    tags=payload.get("tags", []),
                    _client=client,
                )

                if result:
                    summary["migrated"] += 1
                else:
                    summary["errors"] += 1

        return summary

    except Exception as e:
        logger.error("Migration failed: %s", e)
        return {"error": str(e)}
    finally:
        try:
            client.close()
        except Exception:
            pass


# --- Document Store (documents collection) ---


def add_document_chunk(text: str, metadata: dict, _client: QdrantClient | None = None) -> str | None:
    """Add a document chunk to the documents collection. Returns chunk ID or None."""
    client = _client or get_client()
    if client is None:
        return None

    try:
        chunk_id = str(uuid.uuid4())
        payload = {
            "text": text,
            "document": text,
            **metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        client.add(
            collection_name=DOCUMENTS_COLLECTION_NAME,
            documents=[text],
            metadata=[payload],
            ids=[chunk_id],
        )
        return chunk_id
    except Exception as e:
        logger.error("Failed to add document chunk: %s", e)
        return None
    finally:
        if _client is None:
            try:
                client.close()
            except Exception:
                pass


def search_documents(query: str, limit: int = DEFAULT_SEARCH_LIMIT) -> list[dict]:
    """Search the documents collection. Returns list of {id, score, text, file_path, section_path}."""
    client = get_client()
    if client is None:
        return []

    try:
        collections = [c.name for c in client.get_collections().collections]
        if DOCUMENTS_COLLECTION_NAME not in collections:
            return []

        results = client.query(
            collection_name=DOCUMENTS_COLLECTION_NAME,
            query_text=query,
            limit=limit,
        )

        entries = []
        for r in results:
            payload = r.metadata if hasattr(r, "metadata") else {}
            entries.append({
                "id": str(r.id) if hasattr(r, "id") else "",
                "score": r.score if hasattr(r, "score") else 0.0,
                "text": payload.get("text", payload.get("document", "")),
                "file_path": payload.get("file_path", ""),
                "section_path": payload.get("section_path", ""),
                "file_type": payload.get("file_type", ""),
            })
        return entries
    except Exception as e:
        logger.error("Document search failed: %s", e)
        return []
    finally:
        try:
            client.close()
        except Exception:
            pass


def delete_document_chunks(file_path: str) -> int:
    """Delete all chunks for a given file_path from the documents collection. Returns count deleted."""
    client = get_client()
    if client is None:
        return 0

    try:
        collections = [c.name for c in client.get_collections().collections]
        if DOCUMENTS_COLLECTION_NAME not in collections:
            return 0

        points_to_delete = []
        offset = None
        while True:
            results, next_offset = client.scroll(
                collection_name=DOCUMENTS_COLLECTION_NAME,
                scroll_filter=Filter(must=[
                    FieldCondition(key="file_path", match=MatchValue(value=file_path))
                ]),
                limit=100,
                offset=offset,
                with_payload=False,
            )
            points_to_delete.extend([p.id for p in results])
            if next_offset is None:
                break
            offset = next_offset

        if points_to_delete:
            from qdrant_client.models import PointIdsList
            client.delete(
                collection_name=DOCUMENTS_COLLECTION_NAME,
                points_selector=PointIdsList(points=points_to_delete),
            )

        return len(points_to_delete)
    except Exception as e:
        logger.error("Failed to delete chunks for %s: %s", file_path, e)
        return 0
    finally:
        try:
            client.close()
        except Exception:
            pass


def document_stats() -> dict:
    """Get document collection stats: total chunks, files indexed, chunks per file."""
    client = get_client()
    if client is None:
        return {"exists": False, "total_chunks": 0, "files": {}}

    try:
        collections = [c.name for c in client.get_collections().collections]
        if DOCUMENTS_COLLECTION_NAME not in collections:
            return {"exists": False, "total_chunks": 0, "files": {}}

        files: dict[str, int] = {}
        offset = None
        total = 0
        while True:
            results, next_offset = client.scroll(
                collection_name=DOCUMENTS_COLLECTION_NAME,
                limit=100,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            for p in results:
                total += 1
                fp = p.payload.get("file_path", "unknown") if p.payload else "unknown"
                files[fp] = files.get(fp, 0) + 1
            if next_offset is None:
                break
            offset = next_offset

        return {"exists": True, "total_chunks": total, "files": files}
    except Exception as e:
        logger.error("Document stats failed: %s", e)
        return {"exists": False, "total_chunks": 0, "files": {}}
    finally:
        try:
            client.close()
        except Exception:
            pass


def unified_search(query: str, limit: int = DEFAULT_SEARCH_LIMIT, min_score: float = 0.65) -> list[dict]:
    """Search both knowledge and documents collections. Returns merged, scored, deduped results.

    Each result has: id, score, text, source ("knowledge" or "documents"), and source-specific metadata.
    Session memory results get a 10% multiplicative boost (capped at 1.0).
    Cross-store dedup: if two results have >85% word overlap, keep higher-scored.
    """
    kb_results = search(query, limit=limit, min_confidence=0.0)
    doc_results = search_documents(query, limit=limit)

    merged = []

    for r in kb_results:
        score = min(r["score"] * 1.10, 1.0)
        if score >= min_score:
            merged.append({
                "id": r["id"],
                "score": score,
                "text": r["text"],
                "source": "knowledge",
                "category": r.get("category", ""),
                "label": f"[KB  {score:.2f}] {r.get('category', '')}",
            })

    for r in doc_results:
        if r["score"] >= min_score:
            section = f" § {r['section_path']}" if r.get("section_path") else ""
            merged.append({
                "id": r["id"],
                "score": r["score"],
                "text": r["text"],
                "source": "documents",
                "file_path": r.get("file_path", ""),
                "section_path": r.get("section_path", ""),
                "label": f"[DOC {r['score']:.2f}] {r.get('file_path', '')}{section}",
            })

    merged.sort(key=lambda x: x["score"], reverse=True)

    deduped = []
    for item in merged:
        item_words = set(item["text"].lower().split())
        is_dup = False
        for kept in deduped:
            kept_words = set(kept["text"].lower().split())
            if not item_words or not kept_words:
                continue
            overlap = len(item_words & kept_words) / min(len(item_words), len(kept_words))
            if overlap > 0.85:
                is_dup = True
                break
        if not is_dup:
            deduped.append(item)

    return deduped[:limit]
