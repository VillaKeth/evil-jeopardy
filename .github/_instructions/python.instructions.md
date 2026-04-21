---
description: Python coding conventions
paths:
  - "**/*.py"
---

# Python Rules

- When using `.get()` for dictionaries, NEVER provide a default value. Always let it default to `None`.
- Use `uv` for dependency management when available, otherwise `pip`.
- Use type hints for function signatures.
- Use `async/await` for I/O-bound work where possible.
- Follow PEP 8 style guidelines.
