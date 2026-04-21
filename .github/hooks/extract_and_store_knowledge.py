#!/usr/bin/env python3
"""
Hook: PreCompact / SubagentStop / SessionEnd — extract and store knowledge directly.

Receives JSON on stdin with session context (transcript_path or raw text).
Extracts key facts, deduplicates, and stores DIRECTLY to Qdrant.
No MCP server dependency.
"""

import sys
import os
import json

# Add project root to path so we can import knowledge_base
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
sys.path.insert(0, PROJECT_ROOT)

from knowledge_base import store, extractor


def read_transcript(input_data: dict) -> str:
    """Read conversation transcript from various sources."""
    # 1. Try transcript_path from hook input
    transcript_path = input_data.get("transcript_path", "")
    if transcript_path and os.path.exists(transcript_path):
        try:
            with open(transcript_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except IOError:
            pass

    # 2. Try conversation field
    conversation = input_data.get("conversation", "")
    if conversation:
        return conversation

    # 3. Try CLI argument
    if len(sys.argv) > 1:
        path = sys.argv[1]
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()
            except IOError:
                pass

    return ""


def main():
    input_data = {}
    transcript_text = ""

    # Read hook input from stdin
    try:
        if not sys.stdin.isatty():
            stdin_text = sys.stdin.read()
            if stdin_text.strip():
                try:
                    input_data = json.loads(stdin_text)
                except json.JSONDecodeError:
                    transcript_text = stdin_text
    except IOError:
        pass

    if not transcript_text:
        transcript_text = read_transcript(input_data)

    if not transcript_text:
        sys.exit(0)

    # Extract knowledge entries
    entries = extractor.extract_from_text(transcript_text)
    if not entries:
        sys.exit(0)

    # Store each entry directly to Qdrant
    stored = 0
    updated = 0
    failed = 0

    for entry in entries:
        result = store.add(
            text=entry.text,
            category=entry.category,
            confidence=entry.confidence,
            source="auto_extraction",
        )
        if result:
            if result.get("updated_at") != result.get("created_at"):
                updated += 1
            else:
                stored += 1
        else:
            failed += 1

    # Output summary (visible in hook output)
    total = stored + updated
    print(f"Knowledge extraction complete: {total} entries ({stored} new, {updated} updated, {failed} failed)")


if __name__ == "__main__":
    main()
