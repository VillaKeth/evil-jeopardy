---
description: JavaScript coding conventions
paths:
  - "**/*.js"
  - "**/*.jsx"
---

# JavaScript Rules

- Use `const` by default, `let` only when reassignment is needed. Never use `var`.
- Always use `async/await` for asynchronous code. Never use `.then()` or callbacks.
- Use strict equality (`===`) instead of loose equality (`==`).
- Handle all promise rejections — never leave `.catch()` empty.
