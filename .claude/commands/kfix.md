---
description: Diagnose and fix build errors, then clean up code structure — sequential mekanik -> kurator
agent: mekanik, kurator
skills: [systematic-debugging, coding-standards]
---

## Purpose
Two-phase fix: first resolve compilation/build errors, then clean up the resulting code. Absorbs the former /build-fix and /refactor-clean into a single flow.

## Arguments
- (none) — run build fix, then refactor recently changed files
- `build` — only Phase 1 (mekanik), skip refactoring
- `clean` — only Phase 2 (kurator), skip build fix
- `<file-path>` — target specific file for both phases

## Steps

### Phase 1: Build Fix
1. Run `npm run build` or `npx tsc --noEmit` to capture errors
2. Invoke **mekanik agent** (sonnet) with full error output
3. Agent diagnoses root cause, traces to source file and line
4. Agent proposes minimal fix (no unrelated changes)
5. Apply fix
6. Re-run build to verify fix works
7. If `build` argument: stop here

### Phase 2: Refactor Clean
1. Run tests BEFORE any changes: `npx vitest run`
2. Invoke **kurator agent** (sonnet) on target files
3. Agent identifies: unused imports, dead functions, duplicated code
4. Apply refactoring changes
5. Run tests AFTER to verify no behavior change: `npx vitest run`
6. Produce before/after summary

## Output
Build fix results + refactoring summary + test verification.

## Example
```
Phase 1 — Build Fix:
  Error: TS2345 in session-manager.ts:42
  Fix: parseInt() cast applied
  Build: PASS

Phase 2 — Refactor Clean:
  Target: scripts/lib/session-manager.ts
  Before: 248 lines, 3 unused imports, 1 dead function
  After: 231 lines (-17)
  Tests: 180 passing (no regressions)
```
