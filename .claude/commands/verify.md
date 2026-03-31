---
description: Run full verification loop — typecheck, tests, lint, and optionally security scan
skills: [verification-loop]
---

## Purpose
Multi-step verification that catches issues before they reach the repository. Run before every commit. Use `/verify full` to include a security scan.

## Arguments
- (none) — standard verification: build, typecheck, tests, lint, diff
- `full` — adds security scan (exposed secrets, unsafe patterns)

## Steps
1. Build: `npm run build`
2. Typecheck: `npx tsc --noEmit`
3. Run tests: `npx vitest run`
4. Lint: `npx eslint . --ext .ts,.js` (if configured)
5. **[full only]** Security: scan for exposed secrets, unsafe patterns (invoke security-reviewer agent)
6. Diff review: `git diff --stat`
7. Report results per step

Stop at first failure and report which step failed.

## Output
Pass/fail per check. If all pass: "Verification complete — ready to commit."

## Example
```
Build:     PASS
Typecheck: PASS
Tests:     63 passing, 0 failing
Lint:      PASS
Security:  PASS (full mode)
Diff:      5 files changed, 120 insertions
Result:    Ready to commit
```