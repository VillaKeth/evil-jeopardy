---
name: audit-instructions
description: >
  Audit all instruction, rule, agent, command, and skill files for conflicting
  or duplicate content across .claude/ and .github/ directories.
---

# Audit Instructions

Scan all AI configuration files and report:
1. **Conflicts** — Rules that contradict each other across different files
2. **Duplicates** — Same instruction repeated in multiple files
3. **Gaps** — Important areas not covered by any instruction
4. **Staleness** — References to files, directories, or features that no longer exist

## Files to Audit

- `.claude/_CLAUDE.md`
- `.claude/_rules/*.md`
- `.claude/commands/*.md`
- `.claude/skills/*/SKILL.md`
- `.github/copilot-instructions.md`
- `.github/agents/*.md`
- `.github/_instructions/*.md`
- `.github/skills/*/SKILL.md`

## Output

Generate a report listing each finding with:
- **Severity**: Critical / Warning / Info
- **File(s)**: Which files are affected
- **Description**: What the issue is
- **Recommendation**: How to fix it
