---
description: TypeScript coding conventions
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Rules

- Always use `async/await` for asynchronous code. Never use `.then()` or callbacks.
- Use `const` by default, `let` only when reassignment is needed. Never use `var`.
- Use strict TypeScript settings (`strict: true` in tsconfig).
- Prefer interfaces over type aliases for object shapes.
