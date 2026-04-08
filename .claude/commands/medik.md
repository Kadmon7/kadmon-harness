---
description: "Full harness diagnostic — 7 health checks, approval gate, repair, cleanup. Report in docs/diagnostics/. Alias: /MediK"
agent: mekanik, kurator
skills: [systematic-debugging, coding-standards]
---

## Purpose
Full harness health diagnostic with user approval gate. Runs 7 checks, writes a diagnostic report, asks before repairing, then cleans up. Like /abra-kdabra writes to `docs/plans/`, /medik writes to `docs/diagnostics/`.

## Arguments
- (none) — full diagnostic + repair (all 7 checks)
- `build` — only checks 1-3 (build, typecheck, tests)
- `hooks` — only check 4 (hook errors from log)
- `db` — only check 5 (database health)
- `clean` — only Phase 3 (kurator cleanup, skip diagnostic)
- `<file-path>` — target specific file for diagnostic + repair

## Steps

### Phase 1: Diagnostic (mekanik)

Run all 7 health checks and collect findings:

| # | Check | Command / Method | What to look for |
|---|-------|-----------------|------------------|
| 1 | Build | `npm run build` | Compilation errors, EBUSY locks, missing files |
| 2 | Typecheck | `npx tsc --noEmit` | Type errors (TS2xxx codes) |
| 3 | Tests | `npx vitest run` | Test failures, timeout errors |
| 4 | Hook errors | Read `~/.kadmon/hook-errors.log` | Recent errors, crash patterns |
| 5 | DB health | Read `~/.kadmon/kadmon.db` | File exists, 6 tables present (sessions, instincts, cost_events, hook_events, agent_invocations, sync_queue), no corruption |
| 6 | dist/ sync | Compare `dist/` timestamps vs `scripts/lib/` | Stale compiled output, missing files |
| 7 | Dependencies | `npm audit` | Vulnerable packages, outdated deps |

Write diagnostic report to `docs/diagnostics/diag-NNN.md` (scan existing reports and increment highest number, 3-digit zero-padded).

Report format:
```markdown
## Diagnostic Report: diag-NNN [mekanik]

Date: YYYY-MM-DD HH:MM
Branch: <current branch>

### Health Checks
| # | Check | Status | Details |
|---|-------|--------|---------|
| 1 | Build | PASS/FAIL | <details if failed> |
| 2 | Typecheck | PASS/FAIL | <N errors> |
| 3 | Tests | PASS/FAIL | <N passing, N failing> |
| 4 | Hook errors | PASS/WARN | <N errors in log> |
| 5 | DB health | PASS/FAIL | <status> |
| 6 | dist/ sync | PASS/WARN | <stale files> |
| 7 | Dependencies | PASS/WARN | <N vulnerabilities> |

### Problems Found
- [severity] [check #] [description]

### Recommended Fixes
- [fix 1]
- [fix 2]
```

### GATE: User Approval

**MANDATORY STOP.** Present the diagnostic report to the user.

Ask: **"Found N problems in docs/diagnostics/diag-NNN.md. Fix them?"**

Wait for explicit approval. If the user requests changes to the fix plan, adjust and re-present.

If all 7 checks pass: report clean health, skip Phase 2 and 3.

### Phase 2: Repair (mekanik)

Fix only the problems approved by the user:
1. Apply minimal fixes (one problem at a time, smallest diff possible)
2. Re-run the specific check after each fix to confirm resolution
3. Update the diagnostic report with fix results

### Phase 3: Cleanup (kurator)

Only runs if mekanik changed files in Phase 2:
1. Run tests BEFORE cleanup: `npx vitest run`
2. Invoke **kurator agent** (sonnet) on files mekanik touched
3. Agent identifies: unused imports, dead code from fixes, style issues
4. Apply cleanup changes
5. Run tests AFTER to verify no behavior change: `npx vitest run`

### Phase 4: Verify

Re-run all 7 health checks to confirm everything is green.
Append final status to the diagnostic report:
```markdown
### Post-Fix Verification
| # | Check | Before | After |
|---|-------|--------|-------|
| 1 | Build | FAIL | PASS |
...

Result: ALL GREEN / N remaining issues
```

## Output
Diagnostic report path + health check summary + fix results + verification.

## Example
```
Phase 1 — Diagnostic:
  Report: docs/diagnostics/diag-001.md
  1. Build:        FAIL (EBUSY: schema.sql locked)
  2. Typecheck:    PASS
  3. Tests:        PASS (289 passing)
  4. Hook errors:  WARN (2 errors in log)
  5. DB health:    PASS
  6. dist/ sync:   WARN (3 stale files)
  7. Dependencies: PASS

GATE: "Found 3 problems (1 FAIL, 2 WARN). Fix them?"

Phase 2 — Repair:
  Fixed: EBUSY — added retry logic for schema.sql copy
  Fixed: dist/ — rebuilt with npm run build
  Noted: Hook errors — cleared stale entries from log

Phase 3 — Cleanup:
  kurator: no dead code found in changed files

Phase 4 — Verify:
  All 7 checks: PASS
  Report updated: docs/diagnostics/diag-001.md
```
