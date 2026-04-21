"""Extract knowledge from conversation transcripts."""

import re
from .categories import categorize_text, CategorizedEntry
from .dedup import deduplicate_batch
from .config import MAX_MEMORIES_PER_EXTRACTION, MAX_CONTEXT_LENGTH, MIN_LINE_LENGTH


def extract_from_text(text: str) -> list[CategorizedEntry]:
    """
    Extract categorized knowledge entries from transcript text.

    Returns deduplicated, categorized entries ready for storage.
    """
    if not text or not text.strip():
        return []

    lines = text.split("\n")
    raw_entries: list[str] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped or len(stripped) < MIN_LINE_LENGTH:
            continue

        result = categorize_text(stripped)
        if result is None:
            continue

        # Grab surrounding context (1 line before, current, 1 after)
        start = max(0, i - 1)
        end = min(len(lines), i + 2)
        context_lines = [l.strip() for l in lines[start:end] if l.strip()]
        context = " ".join(context_lines)

        if len(context) > MAX_CONTEXT_LENGTH:
            context = context[:MAX_CONTEXT_LENGTH] + "..."

        raw_entries.append(context)

    # Deduplicate within batch
    unique_texts = deduplicate_batch(raw_entries)[:MAX_MEMORIES_PER_EXTRACTION]

    # Re-categorize the deduplicated entries
    entries = []
    for text_entry in unique_texts:
        cat_result = categorize_text(text_entry)
        if cat_result:
            entries.append(cat_result)
        else:
            entries.append(CategorizedEntry(
                text=text_entry,
                category="lesson_learned",
                confidence=0.60,
            ))

    return entries
