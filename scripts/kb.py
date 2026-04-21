#!/usr/bin/env python3
"""
Cross-platform knowledge base CLI wrapper.

Automatically activates the project's venv and forwards all arguments
to `python -m knowledge_base`.

Usage:
    python scripts/kb.py search "your query"
    python scripts/kb.py add --text "entry" --category bug_fix
    python scripts/kb.py list
    python scripts/kb.py stats
    python scripts/kb.py show <point_id>
    python scripts/kb.py export [--format md|json] [--output FILE]
"""

import os
import sys

# Ensure scripts/ is on sys.path so venv_helper can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from venv_helper import ensure_venv, find_project_root

ensure_venv()

import subprocess


def main():
    project_root = find_project_root()

    if len(sys.argv) < 2:
        print("Usage: python scripts/kb.py <command> [args...]")
        print()
        print("Commands:")
        print("  search <query> [--category CAT] [--limit N] [--unified]  Search the knowledge base")
        print("  add --text \"...\" --category CAT [--tags t1,t2]           Add an entry")
        print("  update <ID> [--text \"...\"] [--category CAT] [--tags t]    Update an entry by ID")
        print("  delete <ID> [--force]                                     Delete an entry by ID")
        print("  list [--category CAT] [--limit N]                        List entries")
        print("  stats                                                    Show statistics")
        print("  show <point_id>                                          Show a specific entry")
        print("  export [--format md|json] [--output FILE]                Export all entries")
        print("  browse                                                   Browse by category")
        print("  ingest [--changed] [--path PATH]                         Ingest project docs")
        print("  docs [--search QUERY] [--limit N]                        Show document index")
        print("  status                                                   Full KB dashboard")
        sys.exit(0)

    cmd = [sys.executable, "-m", "knowledge_base"] + sys.argv[1:]
    result = subprocess.run(cmd, cwd=project_root)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
