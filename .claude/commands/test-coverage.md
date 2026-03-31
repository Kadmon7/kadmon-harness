---
description: Run tests with coverage and flag files below 80% threshold
skills: [tdd-workflow]
---

## Purpose
Run tests with coverage reporting and flag files below 80% threshold.

## Arguments
- (none) — run full coverage report
- `<file-path>` — coverage for a specific file or directory

## Steps
1. Run: `npx vitest run --coverage`
2. Parse coverage report
3. Flag files below 80% coverage
4. Report per-file coverage table

## Output
Coverage table with gaps highlighted. Files below 80% are flagged.

## Example
```
| File                  | Coverage | Status |
|-----------------------|----------|--------|
| scripts/lib/utils.ts  | 95%      | OK     |
| scripts/lib/state-store.ts | 82% | OK     |
| scripts/lib/instinct-manager.ts | 71% | BELOW 80% |
```