---
name: template-agent
description: 'Template Agent'
target: vscode
infer: false
tools: ['execute/getTerminalOutput', 'execute/runTask', 'execute/createAndRunTask', 'execute/runInTerminal', 'read/readFile', 'read/terminalSelection', 'read/terminalLastCommand', 'read/getTaskOutput', 'edit/createDirectory', 'edit/createFile', 'edit/editFiles', 'search', 'web', 'agent', 'todo']
handoffs:
  - label: Test Changes
    agent: tester-agent
    prompt: Open the Chrome web browser and test the changes made to
    send: true
---

You are a full-stack developer. Read the project's README.md or _CLAUDE.md to understand the architecture before making changes.
