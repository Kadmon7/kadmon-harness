---
description: Run full verification loop — typecheck, tests, lint
---

## Purpose
Multi-step verification that catches issues before they reach the repository. Run before every commit.

## Steps
1. Build: `npm run build`
2. Typecheck: `npx tsc --noEmit`
3. Run tests: `npx vitest run`
4. Lint: `npx eslint . --ext .ts,.js` (if configured)
5. Diff review: `git diff --stat`
6. Report results per step

Stop at first failure and report which step failed.

## Output
Pass/fail per check. If all pass: "Verification complete — ready to commit."

## Example
```
Build:     PASS
Typecheck: PASS
Tests:     63 passing, 0 failing
Lint:      PASS
Diff:      5 files changed, 120 insertions
Result:    Ready to commit
```