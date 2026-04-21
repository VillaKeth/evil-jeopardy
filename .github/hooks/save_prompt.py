#!/usr/bin/env python3
"""
Hook: UserPromptSubmit — save user prompts to weekly log files.

Receives JSON on stdin with { "user_prompt": "..." }.
Appends the prompt to prompts/<M-D-YYYY>.prompt.md (weekly, starting Monday).
"""

import sys
import os
import json
from datetime import datetime, timedelta

project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def get_week_start(dt: datetime) -> datetime:
    """Get Monday of the current week."""
    return dt - timedelta(days=dt.weekday())


def main():
    try:
        input_data = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
    except (json.JSONDecodeError, Exception):
        input_data = {}

    prompt = input_data.get("user_prompt", "").strip()
    if not prompt:
        return

    now = datetime.now()
    week_start = get_week_start(now)
    filename = f"{week_start.month}-{week_start.day}-{week_start.year}.prompt.md"
    prompts_dir = os.path.join(project_root, "prompts")
    os.makedirs(prompts_dir, exist_ok=True)
    filepath = os.path.join(prompts_dir, filename)

    # Create file with frontmatter if it doesn't exist
    if not os.path.exists(filepath):
        week_end = week_start + timedelta(days=6)
        header = (
            f"---\n"
            f"week: '{week_start.strftime('%m/%d/%Y')} - {week_end.strftime('%m/%d/%Y')}'\n"
            f"---\n\n"
        )
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(header)

    # Append the prompt with timestamp
    timestamp = now.strftime("%Y-%m-%d %H:%M")
    entry = f"**[{timestamp}]**\n\n{prompt}\n\n---\n\n"

    with open(filepath, "a", encoding="utf-8") as f:
        f.write(entry)


if __name__ == "__main__":
    main()
