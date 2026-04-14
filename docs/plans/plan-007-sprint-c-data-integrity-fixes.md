---
number: 7
title: Sprint C — v1.1 data-integrity fixes (hook duration + session inversion)
date: 2026-04-14
status: shipped
needs_tdd: true
route: A
adr: ADR-007-sprint-c-data-integrity-fixes.md
---

# Plan 007: Sprint C — v1.1 data-integrity fixes [konstruct]

## Goal

Fix the two `db-health-check` anomalies blocking plan-003: `hook_events.duration_ms` never populated (Bug A, 9 hooks) and `sessions.ended_at < started_at` on resume (Bug B, session-manager merge path). Closing Sprint C unblocks the plan-003 bootstrap so new collaborators do not inherit a broken observability pipeline on day one.

## Scope

Exactly the files enumerated in ADR-007. No additions.

**Bug A (10 files):**
- `.claude/hooks/scripts/block-no-verify.js`
- `.claude/hooks/scripts/commit-format-guard.js`
- `.claude/hooks/scripts/commit-quality.js`
- `.claude/hooks/scripts/git-push-reminder.js`
- `.claude/hooks/scripts/config-protection.js`
- `.claude/hooks/scripts/deps-change-reminder.js`
- `.claude/hooks/scripts/no-context-guard.js`
- `.claude/hooks/scripts/console-log-warn.js`
- `.claude/hooks/scripts/ts-review-reminder.js`
- `.claude/hooks/scripts/log-hook-event.js` (JSDoc only)

**Bug B (2 files):**
- `scripts/lib/state-store.ts` (add `clearSessionEndState`)
- `scripts/lib/session-manager.ts` (call it on resume)

**Migration (1 file):**
- `scripts/migrate-fix-session-inversion.ts` (new)

**Tests (2-3 files):**
- `tests/hooks/hook-duration-instrumentation.test.ts` (new)
- `tests/lib/session-manager.test.ts` (new or extended)
- `tests/scripts/migrate-fix-session-inversion.test.ts` (new)

## Phase 0: Research

- [ ] Read `scripts/lib/state-store.ts:235-283` (upsertSession COALESCE path) and `scripts/lib/session-manager.ts:18-80` (existing/new/end branches) to confirm the ADR trace still matches current code.
- [ ] Read `.claude/hooks/scripts/log-hook-event.js` and one sample caller (`no-context-guard.js`) to verify the `logHookEvent` call shape before writing tests.
- [ ] Read `scripts/lib/db-health.ts:176-200` to confirm the anomaly keys used by health-check (`hook_duration_missing`, `sessions_timestamp_inversion`).
- [ ] Read `scripts/db-health-check.ts` CLI entrypoint to confirm expected output format.

## Phase 1: Bug A — hook duration instrumentation (TDD)

- [ ] Step A.1 — Write failing test `tests/hooks/hook-duration-instrumentation.test.ts`. (M)
  - For each of the 9 hooks, spawn via `execFileSync` with a minimal valid stdin JSON, point `HOOK_EVENTS_LOG` (or the session tmp dir env var used by `log-hook-event.js`) at `os.tmpdir()`, then read the written JSONL row and assert `typeof row.durationMs === 'number' && row.durationMs >= 0 && row.durationMs < 500`.
  - File: `tests/hooks/hook-duration-instrumentation.test.ts`
  - Verify: `npx vitest run tests/hooks/hook-duration-instrumentation.test.ts` — RED (assertion on `durationMs` fails because field is missing).
  - Depends on: Phase 0.
  - Risk: Medium (spawn plumbing per hook must match each hook's stdin contract).

- [ ] Step A.2 — Update `log-hook-event.js` JSDoc to mark `durationMs` REQUIRED. (S)
  - File: `.claude/hooks/scripts/log-hook-event.js`
  - Verify: `git diff` shows only the JSDoc block at line ~17 changed; no behavior change.
  - Depends on: A.1.
  - Risk: Low.

- [ ] Step A.3 — Patch the 9 hook files to capture `const start = Date.now();` at entry (after `parseStdin()`) and pass `durationMs: Date.now() - start` into every `logHookEvent(...)` call site. GREEN. (M)
  - Files: the 9 hooks listed in Scope.
  - Verify: `npx vitest run tests/hooks/hook-duration-instrumentation.test.ts` — all 9 pass.
  - Depends on: A.1, A.2.
  - Risk: Medium — 9 near-identical edits, easy to typo. Mitigation: the per-hook test catches any missed call site. Some hooks have 2 `logHookEvent` call sites (`config-protection`, `no-context-guard`); both must get `durationMs`.

- [ ] Step A.4 — Review for extraction opportunities and run full hook test file. (S)
  - Verify: `npx vitest run tests/hooks/` — all hook tests green. Do NOT extract a `measureHookEvent` helper unless duplication pain is real (ADR-007 defers this decision).
  - Depends on: A.3.
  - Risk: Low.

## Phase 2: Bug B — session-manager reset on resume (TDD)

- [ ] Step B.1 — Write failing test `tests/lib/session-manager.test.ts`. (M)
  - Cases: (a) fresh session → `endSession` writes `ended_at >= started_at`; (b) resume path → second `startSession(sid)` on an ended session leaves `ended_at IS NULL` and `duration_ms IS NULL`; (c) start → end → resume → end writes a final `ended_at >= started_at` and `duration_ms` reflects T4 − T3 (not T2 − T1); (d) invariant scan at end of suite asserts `ended_at IS NULL OR ended_at >= started_at` for every row.
  - File: `tests/lib/session-manager.test.ts`
  - Verify: `npx vitest run tests/lib/session-manager.test.ts` — RED on cases (b), (c), (d).
  - Depends on: Phase 0.
  - Risk: Low.

- [ ] Step B.2 — Add `clearSessionEndState(id: string): void` to `scripts/lib/state-store.ts`. (S)
  - Exported function running prepared statement `UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE id = ?` followed by `saveToDisk()`.
  - File: `scripts/lib/state-store.ts`
  - Verify: `npm run build` compiles; function is exported from the module and visible to `session-manager.ts`.
  - Depends on: B.1.
  - Risk: Low — parameterized SQL, single-row write.

- [ ] Step B.3 — In `session-manager.ts` `startSession` existing-session branch (~lines 18-29), call `clearSessionEndState(existing.id)` BEFORE the `upsertSession(merged)` call. Add a one-line comment `// ADR-007: reset end-state so COALESCE cannot preserve stale ended_at`. GREEN. (S)
  - File: `scripts/lib/session-manager.ts`
  - Verify: `npx vitest run tests/lib/session-manager.test.ts` — all cases pass including invariant scan.
  - Depends on: B.2.
  - Risk: Low.

- [ ] Step B.4 — Run broader test suite to confirm no other session-manager consumer regressed. (S)
  - Verify: `npx vitest run tests/lib/` — all green.
  - Depends on: B.3.
  - Risk: Low.

## Phase 3: Historical repair migration

- [ ] Step M.1 — Write `scripts/migrate-fix-session-inversion.ts`. (M)
  - Behavior: without flags → dry-run, prints count of rows where `ended_at IS NOT NULL AND ended_at < started_at`. With `--apply` → runs `UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE ended_at IS NOT NULL AND ended_at < started_at`, prints rows-affected. Idempotent (second apply is a no-op). Opens the DB via the existing `state-store` helper so backup rotation stays consistent.
  - File: `scripts/migrate-fix-session-inversion.ts`
  - Verify: `npx tsc --noEmit` clean; CLI invocation with no args prints dry-run banner.
  - Depends on: B.2 (reuses `clearSessionEndState` or equivalent SQL).
  - Risk: Medium — Windows path handling and `--apply` gate must be bulletproof (spektr surface).

- [ ] Step M.2 — Write `tests/scripts/migrate-fix-session-inversion.test.ts`. (M)
  - Seed `:memory:` DB with 3 rows (2 inverted, 1 normal). Dry-run: output reports "2 rows would be repaired", DB unchanged. Apply: 2 rows now have `ended_at IS NULL` and `duration_ms IS NULL`; 1 normal row untouched. Second apply: reports "0 rows would be repaired".
  - File: `tests/scripts/migrate-fix-session-inversion.test.ts`
  - Verify: `npx vitest run tests/scripts/migrate-fix-session-inversion.test.ts` — all green.
  - Depends on: M.1.
  - Risk: Low.

## Phase 4: Verification

- [ ] Step V.1 — Full build + suite.
  - Verify: `npm run build && npx vitest run` — all tests green, TypeScript compiles with no errors.
  - Depends on: Phases 1-3.

- [ ] Step V.2 — Run migration against local DB.
  - Verify: `npx tsx scripts/migrate-fix-session-inversion.ts` (dry-run; confirm row count matches the 19/35 reported by db-health-check), then `npx tsx scripts/migrate-fix-session-inversion.ts --apply`. Confirm rows-affected matches dry-run count.
  - Depends on: V.1.

- [ ] Step V.3 — Health-check gate.
  - Verify: `npx tsx scripts/db-health-check.ts` reports **0** occurrences of `sessions_timestamp_inversion` (historical repair + new merge path prevents recurrence). `hook_duration_missing` should report 0 for rows created after the fix — historical rows (> 24h old) are documented as NULL by design and the detector uses a 24h window, so the metric clears naturally within one day of post-fix hook activity.
  - Depends on: V.2.

- [ ] Step V.4 — Manual smoke of hook instrumentation.
  - Verify: trigger one of the 9 instrumented hooks (e.g., make a 5th `.ts` edit to fire `ts-review-reminder`, or run a benign `git status` to exercise `block-no-verify`'s allow path). Tail the current session's `hook-events.jsonl` in the tmp dir and confirm the latest row has `durationMs` populated with a positive integer. At the next session-end, confirm the row is persisted to SQLite via `sqlite3 ~/.kadmon/kadmon.db "SELECT hook_name, duration_ms FROM hook_events ORDER BY rowid DESC LIMIT 5"`.
  - Depends on: V.3.

## Testing Strategy

- **Unit**: `tests/hooks/hook-duration-instrumentation.test.ts` (per-hook duration capture), `tests/lib/session-manager.test.ts` (resume reset invariant), `tests/scripts/migrate-fix-session-inversion.test.ts` (dry-run + apply semantics, idempotency).
- **Integration**: end-to-end lifecycle in `session-manager.test.ts` (start → end → resume → end) against `:memory:` SQLite using real `state-store` (no mocks, per `rules/common/testing.md`).
- **Regression gate**: `db-health-check.ts` CLI must report 0 for both anomaly keys on post-fix rows — documented as the acceptance criterion in ADR-007.

## Rollback Plan

If either fix destabilizes the harness, rollback is straightforward. The migration itself only ever writes NULL (never destroys recoverable state), and the DB is protected by the existing 3-backup rotation in `session-start.js:44-49` via `rotateBackup(dbFile, 3)`. To recover:

1. Revert the Sprint C commits (`git revert <sha1> <sha2> ...` targeting this plan's commits) and rebuild (`npm run build`). Hooks and session-manager return to pre-Sprint-C behavior.
2. If the migration wrote unwanted NULLs, restore from the most recent rotating backup: `cp ~/.kadmon/backups/kadmon-<timestamp>.db ~/.kadmon/kadmon.db`. The three most recent backups are preserved; pick the one with the latest `mtime` older than the migration run.
3. Re-run `npx tsx scripts/db-health-check.ts` to confirm the pre-fix state is restored and no new corruption entered during rollback.

No schema changes are proposed, so no down-migration is required.

## Risks and Mitigations

- **Windows path sanitization in the new migration script.** The migration is a new CLI that reads `~/.kadmon/kadmon.db` and must round-trip Windows paths through `fileURLToPath` (not `new URL().pathname`) and use `path.join(homedir(), '.kadmon', 'kadmon.db')`. Mitigation: spektr review during /chekpoint; reuse the existing `state-store` DB-opening helper instead of hand-rolling path logic.
- **Historical `hook_events` rows are not repaired.** By ADR-007 design — no recoverable timing signal exists for past executions. Documented, not a bug. The `db-health-check` 24h window makes this invisible within a day of active use. Mitigation: document in the migration script's header comment so future auditors do not mistake it for a miss.
- **Nine-hook mass edit is a consistency hazard.** Drift or typo in any single hook breaks its duration signal silently. Mitigation: per-hook test in Step A.1 fails loudly if any call site lacks `durationMs`. Future blocking/warning hooks inherit the test coverage by adding one case to the shared test file.
- **Migration and new session-manager reset path add two SQL writes where one existed.** Negligible at sql.js scale (both wrapped in the same implicit transaction per session-start) but worth noting if anyone benchmarks `/compact` latency later. Mitigation: none needed; flagged in ADR-007 Alternatives B1.

## Success Criteria

- [ ] `npx tsx scripts/db-health-check.ts` reports 0 `hook_duration_missing` for rows within the detector's 24h window.
- [ ] `npx tsx scripts/db-health-check.ts` reports 0 `sessions_timestamp_inversion` across the entire table (historical repair + new merge path).
- [ ] All new and existing tests pass: `npx vitest run` green.
- [ ] TypeScript compiles: `npx tsc --noEmit` clean.
- [ ] Manual smoke confirms at least one post-fix `hook_events` row has a non-null `duration_ms` persisted to SQLite.
- [ ] Migration script is idempotent (second `--apply` reports 0 rows repaired).
- [ ] plan-003 unblocked — Sprint C gate closed.
