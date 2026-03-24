---
description: Run all quality checks — typecheck, tests, lint, security
---

## Purpose
Comprehensive quality gate that blocks commit if critical issues are found.

## Steps
1. Typecheck: `npx tsc --noEmit`
2. Tests: `npx vitest run`
3. Lint: check for any BLOCK-level issues
4. Security: scan for exposed secrets, unsafe patterns
5. Report per gate: PASS / FAIL

## Output
Pass/fail per gate. If any FAIL: "Quality gate FAILED — fix before commit."

## Example
```
Typecheck:  PASS
Tests:      PASS (63/63)
Lint:       PASS
Security:   PASS
Result:     Quality gate PASSED
```