---
description: Python coding conventions
paths:
  - "**/*.py"
---

# Python Rules

- When using `.get()` for dictionaries, NEVER provide a default value. Always let it default to `None`.
- Use `uv` for dependency management, not raw pip.
- Use `async/await` for I/O-bound work. All network and file handling should be non-blocking where possible.
- Use type hints for function signatures.
