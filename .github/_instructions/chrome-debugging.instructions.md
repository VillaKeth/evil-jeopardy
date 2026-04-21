---
description: Chrome DevTools debugging guidelines
paths:
  - "**/*"
---

# Chrome Debugging

- Always use MCP tools (`chrome-devtools` or `playwright-mcp`) to interact with the browser. NEVER launch `chrome.exe` directly.
- Close browser pages after testing to prevent memory leaks.
- Save screenshots to `artifacts/` with descriptive filenames.
- Check console for errors after every navigation.
