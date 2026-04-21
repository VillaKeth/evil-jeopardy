---
paths:
  - "**/*"
---

# Development Process

## Rule 1: Never Say "It Works" Without Evidence

**You may not declare success without evidence.**

- ✅ "It works — terminal output shows all assertions passed"
- ✅ "It works — browser shows correct UI with no console errors"
- ❌ "It should work" — this is speculation, not verification
- ❌ "It works" without showing output — this is lying by omission

If you can't produce a log or output showing the system actually ran and produced correct
output, you have not tested it. Do not close the task.

---

## Rule 2: Engineer for Self-Testability

**Every piece of work must be testable, with visible output.**

When designing a feature or fix, ask: *Can I run this myself and see the result?*

- Write tests or scripts that produce observable output
- Console output, test results, screenshots — all acceptable proof
- If something is not self-testable, make it self-testable before writing it

---

## Rule 3: Always Verify Both Sides

For any client/server or multi-component system:
- Start the server first, confirm it is listening
- Run the client against it, capture the exchange
- Check BOTH sides produced correct output

Partial verification (only one side shows output) is not verification.

---

## Summary Checklist Before Declaring Done

```
[ ] Terminal/browser output shows the code actually ran
[ ] No "it should work" — only "output shows X"
[ ] User can reproduce this test without AI help
[ ] All error paths considered and handled
```

**If any box is unchecked — the task is not done.**
