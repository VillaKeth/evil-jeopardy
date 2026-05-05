# TIER 1 — NEVER VIOLATE

1. **Never modify `.github/copilot-instructions.md`** — This file is managed by the user only.
2. **Search the knowledge base FIRST** — Before ANY work (reading files, writing code, answering questions), use the `knowledge-base` skill. The knowledge base contains hard-won project-specific knowledge that supersedes general knowledge. Never skip this step.
3. **Never simulate or fabricate values.** If a value cannot be obtained from configuration or a real request, raise an error. No mocks, no stubs, no made-up data.

---

## Personality & Session Management
- **ALWAYS provide dropdown menu at end of EVERY response** - User wants to stay in dropdown mode for entire session
- **NEVER dismiss or kick user out** unless they explicitly select "dismiss" or similar option
- **Always include freeform option** - Use `allow_freeform: true` so user can type custom instructions
- **Be concise but helpful** - Short responses when possible, but always implement actual changes

## Dropdown Menu Format — Invocation Contract

Every response must end with an **actual invocation of the `ask_user` tool** (a real function_calls block that the runtime executes). Never write XML or pseudo-XML describing the call in the response body — the UI only renders a dropdown when the tool fires, so any "example" pasted inline breaks the UX.

Rules for every `ask_user` call:
- `allow_freeform` is always `true`
- `choices` is a JSON array of 3–5 short, context-specific options, with `"Dismiss"` as the last entry
- `question` is one short sentence (no bullet lists, no multi-part questions)
- The call is the **last tool call of the turn**, issued in the same function_calls block as any final `report_intent` / `store_memory` if present

Hard stops — if any are true, the turn is broken; fix before sending:
1. The word `ask_user` appears in the visible response text (excluding within actual tool-call output).
2. Any `<ask_user>`, `<parameter`, or similar angle-bracket tag appears in the visible response text.
3. The turn ended without firing the `ask_user` tool at all.

Self-check before every send: *"Did I just invoke `ask_user` as a tool (not describe it in prose)?"* If uncertain, the answer is no — invoke it now.

---

# TIER 2 — ALWAYS DO

4. **Use superpowers skills** You should use the superpowers skills for feature work. All of the superpowers skills begin with the phrase "superpowers:". The portion after ":" is the actual skill. Begin with the superpowers:brainstorming skill for and then move on to the other superpowers skills as needed.
5. **Git worktrees for all code changes.** Create a worktree before modifying code. After finishing, merge back into the current branch (never into `main` or `master`), then remove the worktree.
6. **Update `TODO.md`** — Append new `- [ ]` items for any work done or discovered. Read the existing file first. Keep entries as simple, single-line items.
7. **Test thoroughly after every change.** Do not declare success without evidence. Spend as much time as needed to verify the application works perfectly.
8. **Store discoveries in the knowledge base.** When you learn something important about the project, immediately store it in the knowledge base using the `knowledge-base` skill.

---

# TIER 3 — CONVENTIONS

- **Browser tools:** Use `playwright-mcp` or `chrome-devtools` MCP tools. NEVER open `chrome.exe` directly. Close the browser after testing to prevent memory leaks.
- **Screenshots:** Save to `artifacts/` with descriptive names.
- **Temporary files and scripts:** Save to `artifacts/`. This directory acts as your workspace where you can do anything you want without affecting the main codebase.
- **User-facing documentation:** Create `.md` files in `docs/`.
- **AI context files:** Keep `.claude/` files up to date when you add new conventions, fix major bugs, or change architecture.
- **KB operations:** Use the `knowledge-base` skill. See `.github/skills/knowledge-base/SKILL.md` for commands.