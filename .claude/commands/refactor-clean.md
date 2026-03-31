---
description: Remove dead code, reduce duplication, and improve structure without behavior changes
agent: refactor-cleaner
skills: [coding-standards]
---

## Purpose
Identify and fix dead code, duplication, and structural issues without changing behavior.

## Arguments
- `<file-path>` — refactor a specific file (e.g., `/refactor-clean scripts/lib/state-store.ts`)
- (none) — refactor recently modified files

## Steps
1. Invoke refactor-cleaner agent (sonnet) on specified files
2. Agent identifies: unused imports, dead functions, duplicated code
3. Run tests BEFORE any changes
4. Apply refactoring changes
5. Run tests AFTER to verify no behavior change
6. Produce before/after summary

## Output
Refactoring report with changes applied and test verification.

## Example
```
Refactor: scripts/lib/state-store.ts

Before: 248 lines, 3 unused imports, 1 dead function
After:  231 lines (-17)
  - Removed: unused `formatDate` import
  - Removed: unused `debugLog` function (0 callers)
  - Extracted: duplicate timestamp formatting to shared helper

Tests: 63 passing (no regressions)
```