---
description: Node.js conventions
paths:
  - "**/*.js"
  - "**/*.ts"
  - "package.json"
---

# Node.js Rules

- Use `npm` or the project's configured package manager for dependency management.
- Never commit `node_modules/` — it should be in `.gitignore`.
- Use environment variables for configuration, not hardcoded values.
