# Plan-001: Kadmon Harness v0.3 Plans (Archived)

> Status: Archived — all plans executed as of v0.3.4
> Consolidates: plan-001 through plan-005 (2026-03 to 2026-04)

## Plan Summary

| # | Title | ADR | Status | Key Commits |
|---|-------|-----|--------|-------------|
| 001 | Memory Improvements | ADR-007 | Executed | daily-log.js, post-compact reinjection in session-start |
| 002 | Missing Hook Tests | — | Executed | e2f63ba (20/20 hooks tested), 7a263ea (lifecycle hooks) |
| 003 | v1 Sprint Plan | ADR-008 | Superseded | Replaced by roadmap restructure + Sprint A/B plan |
| 004 | Hook Path Robustness | — | Executed | 20 hooks prefixed with `cd "$(git rev-parse --show-toplevel)"` |
| 005 | v1 Sprint A+B | ADR-008 | Executed | 876fe82 (ensure-dist, hook-logger, backup-rotate, state-store cleanup) |

## Details

### plan-001: Memory Improvements
Implemented ADR-007. Created daily-log.js shared module with appendDailyLog() and readTodayLog(). Integrated into session-end-all.js and pre-compact-save.js as writers, session-start.js as reader. Post-compact context reinjection reads SQLite session + feedback memories + today's log.

### plan-002: Missing Hook Tests
Covered all 20 hooks with tests. Added tests for session-end-all.js (8 tests), pre-compact-save.js (6 tests), and all 10 remaining hooks. Total: 20/20 hook coverage.

### plan-003: v1 Sprint Plan
Original P0/P1/P2 execution plan from ADR-008. Sprint 1 (hook reliability) and Sprint 2 (test debt) were completed. Sprint 3 (multi-project) was re-evaluated and items were either completed, deferred, or eliminated during roadmap restructure.

### plan-004: Hook Path Robustness
Config-only change: prefixed all 20 hook commands in settings.json with `cd "$(git rev-parse --show-toplevel)" &&` so hooks resolve correctly regardless of shell CWD. No new code, no tests needed.

### plan-005: v1 Sprint A+B
Final v1.0 sprints. Sprint A: ensure-dist.js (auto-build stale dist/), hook-logger.js (persistent error logging), health check in session-start banner. Sprint B: backup-rotate.js (3 timestamped backups), deleteSession/cleanupTestSessions in state-store, cleanup script. 29 new tests.
