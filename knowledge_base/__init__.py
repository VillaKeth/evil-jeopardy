"""
Knowledge Base — structured, categorized, searchable project knowledge.

Usage:
    from knowledge_base import store, extractor

    # Add knowledge
    store.add(text="...", category="bug_fix")

    # Search knowledge
    results = store.search("your query")

    # Extract from transcript
    entries = extractor.extract_from_text(transcript)
    for entry in entries:
        store.add(text=entry.text, category=entry.category, confidence=entry.confidence)
"""

from . import store, extractor, categories, config, backends, chunker, ingestion

__all__ = ["store", "extractor", "categories", "config", "backends", "chunker", "ingestion"]
