#!/usr/bin/env python3
"""
Hook: UserPromptSubmit — search knowledge base for context relevant to user's prompt.

Receives JSON on stdin with { "user_prompt": "..." }.
Outputs relevant knowledge entries to stdout (injected as conversation context).
Source-attributed, relevance-filtered, token-budgeted.
"""

import sys
import os
import json

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from knowledge_base import store
from knowledge_base.config import HOOK_RELEVANCE_THRESHOLD, HOOK_TOKEN_BUDGET


def estimate_tokens(text: str) -> int:
    return len(text) // 4


def main():
    try:
        input_data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, Exception):
        input_data = {}

    query = input_data.get("user_prompt", "")
    if not query and len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])

    if not query or not query.strip():
        return

    try:
        results = store.unified_search(
            query,
            limit=10,
            min_score=HOOK_RELEVANCE_THRESHOLD,
        )
    except Exception:
        return

    if not results:
        return

    output_lines = ["=== Relevant KB Context ==="]
    tokens_used = estimate_tokens(output_lines[0])

    for r in results:
        text_preview = r["text"][:300].replace("\n", " ").strip()
        if r["source"] == "knowledge":
            line = f"[Session: {r.get('category', 'unknown')}] {text_preview} ({r['score']:.2f})"
        else:
            section = f" § {r.get('section_path', '')}" if r.get("section_path") else ""
            line = f"[Doc: {r.get('file_path', '')}{section}] {text_preview} ({r['score']:.2f})"

        line_tokens = estimate_tokens(line)
        if tokens_used + line_tokens > HOOK_TOKEN_BUDGET:
            break
        output_lines.append(line)
        tokens_used += line_tokens

    output_lines.append("=== End KB Context ===")
    print("\n".join(output_lines))


if __name__ == "__main__":
    main()
