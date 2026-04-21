# Evil Jeopardy

## Project Overview

Evil Jeopardy is a game project. Update this section with the full project description, tech stack, and architecture as the project develops.

## Tech Stack

<!-- Update as project develops -->
- **TBD**

## Common Commands

```bash
# Add your commands here as the project develops
```

## Directory Structure

```
├── .claude/          # Claude Code AI configuration
├── .github/          # GitHub Copilot AI configuration
├── knowledge_base/   # Vector knowledge base (Qdrant)
├── scripts/          # Utility scripts (kb.py, venv_helper.py)
├── artifacts/        # Temporary AI workspace files
├── docs/             # Project documentation
└── ...               # Project files
```

## AI Agent Notes

- Use the knowledge base (`python scripts/kb.py`) to search for project-specific knowledge before investigating files.
- The knowledge base auto-extracts facts from conversations and injects relevant context on each prompt.
- Run `python scripts/kb.py status` to see KB health.
- Run `python scripts/kb.py ingest` to index project files into the document collection.
