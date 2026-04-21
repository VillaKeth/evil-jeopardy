---
name: knowledge-base
description: >
  Use when the agent needs to search, add, update, summarize, or manage knowledge base entries.
  The knowledge base stores architecture decisions, bug fixes, conventions, lessons learned,
  configuration details, user preferences, API knowledge, and troubleshooting notes across sessions.
  Also use when the user asks for a "summary" or "overview" of what the KB contains.

  IMPORTANT: The knowledge base MUST be searched at the START of every question before any other
  work is done. Run: python scripts/kb.py search "<user topic>" --unified --limit 25
  This applies to ALL AI harnesses (Copilot CLI, Claude Code, Cursor, etc.).

  EFFICIENCY RULE: If the KB search returns sufficient information to answer the question,
  STOP and use that information. Do NOT follow up with expensive tools like grep, glob, or
  file reads on large directories. Only use those tools if the KB results are missing, incomplete,
  or too vague to answer the question. When you DO use expensive tools to fill a KB gap, ADD the
  new information back to the knowledge base so future queries are answered from the KB directly.
---

# Knowledge Base Management

Semantic vector database (Qdrant embedded, bge-base-en-v1.5 768-dim) with two collections:
- **Session memory** — curated entries (architecture decisions, bug fixes, conventions, etc.)
- **Document chunks** — auto-indexed project files

Entries are auto-deduplicated at 0.92 cosine similarity.

## Commands

All commands use `scripts/kb.py` which auto-activates the project venv via `scripts/venv_helper.py`.
No need to activate the venv manually.

```bash
# Search session memory only
python scripts/kb.py search "your query"
python scripts/kb.py search "some topic" --category bug_fix --limit 10

# Unified search (both session memory + document chunks) — RECOMMENDED
python scripts/kb.py search "your query" --unified
python scripts/kb.py search "your query" --unified --limit 15

# Add a new entry to session memory
python scripts/kb.py add --text "Description of what you learned" --category CATEGORY
python scripts/kb.py add --text "Important config detail" --category configuration --tags config,setup

# Update an existing entry by ID (re-embeds if text changes)
python scripts/kb.py update <point_id> --text "New corrected text"
python scripts/kb.py update <point_id> --category api_knowledge --tags new,tags

# Delete an entry by ID
python scripts/kb.py delete <point_id>
python scripts/kb.py delete <point_id> --force

# List entries
python scripts/kb.py list
python scripts/kb.py list --category architecture_decision --limit 20

# Show statistics
python scripts/kb.py stats

# Show a specific entry
python scripts/kb.py show <point_id>

# Export knowledge base
python scripts/kb.py export --format md
python scripts/kb.py export --format json --output kb_export.json

# Browse entries by category
python scripts/kb.py browse

# Ingest project documents into document collection
python scripts/kb.py ingest
python scripts/kb.py ingest --changed    # Only re-index changed files
python scripts/kb.py ingest --path src   # Index specific path

# Show document index
python scripts/kb.py docs
python scripts/kb.py docs --search "query"
python scripts/kb.py docs --tree

# Full dashboard
python scripts/kb.py status
```

## Valid Categories

| Category | Use For |
|----------|---------|
| `architecture_decision` | Design choices, patterns, structural decisions |
| `bug_fix` | Bug root causes, fixes, workarounds |
| `convention` | Coding standards, naming rules, process rules |
| `lesson_learned` | Discoveries, gotchas, non-obvious behaviors |
| `configuration` | Ports, paths, env vars, settings |
| `preference` | User preferences, style choices |
| `api_knowledge` | API behaviors, endpoints, return values |
| `troubleshooting` | Debug steps, diagnostic procedures |

## How It Works

### Auto-Extraction (Hooks)
- **On session end / compact / subagent stop**: Extracts facts from conversation transcript
- **On user prompt**: Searches KB and injects relevant context automatically

### Document Ingestion
- Configurable via `kb_sources.json` in project root (optional)
- Auto-detects common project directories if no config file exists
- SHA-256 change detection for incremental re-indexing

### Deduplication
- Cosine similarity ≥ 0.92 → merge (keep longer text, merge tags, higher confidence)
- Word overlap ≥ 0.75 → pre-filter within batch

## Customizing Ingestion Sources

Create `kb_sources.json` in your project root:

```json
[
  {"dir": "src", "pattern": "**/*.py"},
  {"dir": "docs", "pattern": "**/*.md"},
  {"dir": "frontend/src", "pattern": "**/*.{ts,tsx}"},
  {"dir": ".", "pattern": "README.md"},
  {"dir": ".", "pattern": "TODO.md"}
]
```

If this file doesn't exist, the KB auto-detects common directories (src, lib, app, frontend, backend, docs).
