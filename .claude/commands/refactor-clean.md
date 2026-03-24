---
description: Invoke refactor-cleaner agent to improve code structure
---

## Purpose
Identify and fix dead code, duplication, and structural issues without changing behavior.

## Steps
1. Invoke refactor-cleaner agent (sonnet) on specified files
2. Agent identifies: unused imports, dead functions, duplicated code
3. Run tests BEFORE any changes
4. Apply refactoring changes
5. Run tests AFTER to verify no behavior change
6. Produce before/after summary

## Output
Refactoring report with changes applied and test verification.