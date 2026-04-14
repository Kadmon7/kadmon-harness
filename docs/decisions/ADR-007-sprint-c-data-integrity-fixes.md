---
number: 7
title: Sprint C v1.1 data-integrity fixes — hook duration instrumentation and session timestamp merge
date: 2026-04-14
status: accepted
route: A
plan: plan-007-sprint-c-data-integrity-fixes.md
---

# ADR-007: Sprint C v1.1 data-integrity fixes — hook duration instrumentation and session timestamp merge

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Context

The `db-health-check` detector in `scripts/lib/db-health.ts` (CLI at `scripts/db-health-check.ts`) reported two anomalies on 2026-04-13 against the production DB at `~/.kadmon/kadmon.db`. Both are blockers for plan-003 (harness distribution bootstrap) — we cannot ship a bootstrap that seeds a broken observability pipeline on every collaborator's machine. Each bug is a short, localized fix; together they close the v1.1 data-integrity gate.

### Bug A — `hook_events.duration_ms` always NULL

Anomaly key: `hook_duration_missing` (detector at `scripts/lib/db-health.ts:186-200`).

Schema is correct: `hook_events.duration_ms` is declared as a nullable INTEGER and is wired through `insertHookEvent` at `scripts/lib/state-store.ts:617-631`, which binds `@duration_ms` to `event.durationMs ?? null`. The persistence layer would happily store any non-null value. The problem is that no caller ever provides one.

The write path is a three-hop chain:

1. **Calling hook** (9 blocking/warning hooks: `block-no-verify`, `commit-format-guard`, `commit-quality`, `git-push-reminder`, `config-protection`, `deps-change-reminder`, `no-context-guard`, `console-log-warn`, `ts-review-reminder`) invokes `logHookEvent(sessionId, event)`.
2. **`.claude/hooks/scripts/log-hook-event.js`** serializes `event` to `hook-events.jsonl` in the session temp dir. The JSDoc at line 17 lists `event.durationMs` as an optional field. **None of the 9 callers passes it.** I confirmed this by grep — see for example `no-context-guard.js:44-51` and `:69-76`, which build the event object with `hookName`, `eventType`, `toolName`, `exitCode`, `blocked`, `error`, but no timing field. Same pattern in every other caller.
3. **`session-end-all.js`** reads `hook-events.jsonl` (line 135-144), then persists via `insertHookEvent` (line 328: `durationMs: he.durationMs ?? null`). It never computes a duration of its own.

So every row arrives at the DB with `durationMs === undefined`, coerced to `null`, and the column is effectively dead. The observability pipeline runs, but the latency signal that `arkonte` and `/evolve` rely on for hook-budget enforcement is flat-lined. This is also why the `rules/common/hooks.md` budget table (observe < 50ms, guard < 100ms, others < 500ms) has never been empirically verified.

### Bug B — `sessions.ended_at < started_at` in 19/35 rows (54%)

Anomaly key: `sessions_timestamp_inversion` (detector at `scripts/lib/db-health.ts:176-185`).

**Root cause (confirmed by code reading, not guessed):** the `/compact` / session-resume merge path in `startSession` overwrites `started_at` forward in time while `upsertSession`'s `COALESCE` preserves the previous cycle's `ended_at`. The result: a session that was legitimately ended at T2, then resumed at T3, ends up with `started_at = T3, ended_at = T2`.

Trace it through the code:

1. **Run 1 normal lifecycle.** `session-start.js:251` calls `startSession(sid)`. Session doesn't exist yet → NEW path (`scripts/lib/session-manager.ts:31-52`) inserts row with `started_at = T1, ended_at = null`. Later, `session-end-all.js:183` calls `endSession(sid)`, which at `session-manager.ts:55-80` writes `ended_at = T2, duration_ms = T2 - T1`. Invariant holds.

2. **Run 2 after `/compact` (same `sid`).** `session-start.js:251` calls `startSession(sid)` again. The existing-row branch fires (`session-manager.ts:18-29`):
   ```ts
   const merged: SessionSummary = {
     ...existing,
     startedAt: now,                       // T3
     endedAt: undefined as unknown as string, // intent: clear
     ...
   };
   upsertSession(merged);
   ```

3. **Inside `upsertSession`** (`state-store.ts:235-283`):
   - Line 269: `ended_at: session.endedAt ?? null` → binds `NULL`.
   - Line 250 (upsert): `ended_at = COALESCE(excluded.ended_at, sessions.ended_at)`. With `excluded.ended_at = NULL`, COALESCE falls through to the existing value **T2**.
   - Line 249: `started_at = COALESCE(excluded.started_at, sessions.started_at)`. `excluded.started_at = T3` (non-null) → overwrites to T3.

Net effect: `started_at = T3, ended_at = T2`, and since T3 > T2, the invariant `ended_at >= started_at` breaks. `duration_ms` has the same problem — line 251 COALESCEs it, so the stale T2 - T1 duration from the previous end survives the resume. The comment on `session-manager.ts:23` (`"null in DB → COALESCE preserves"`) is the author acknowledging the COALESCE behavior without noticing that "preserves" is exactly wrong for a reset path.

I also checked the secondary suspect — orphan recovery in `session-start.js:88-151`. It calls `endSession(orphan.id, ...)` against a **different** session id than the current one, and `endSession` computes `durationMs = nowMs() - new Date(existing.startedAt).getTime()` against whatever `existing.startedAt` is. For an orphan that has never been resumed, `existing.startedAt` is its original T1, so the recovery writes `ended_at = T_recovery > T1`. That path is fine. For an orphan that *had* been resumed by some earlier /compact (and thus already has inverted timestamps), recovery writes a new `ended_at` that may or may not heal the row depending on wall-clock ordering — it cannot reliably fix inversion, only fresh starts can.

Clock source is **not** the bug: `nowISO()` (`utils.ts:6-8`) and `nowMs()` (`utils.ts:10-12`) both use the same Node.js system clock (`Date`), and SQLite `CURRENT_TIMESTAMP` is never used for sessions. Schema stores `started_at`/`ended_at` as ISO strings and `duration_ms` as INTEGER ms; no unit mismatch.

**Why these block plan-003.** plan-003 is the bootstrap script that seeds the harness onto a fresh machine. If we ship it with these bugs live:
- Every bootstrapped project immediately starts generating corrupt `hook_events` (Bug A) and will fail the same health check within a day.
- Every bootstrapped project loses the ability to evaluate hook latency budgets — the v1.1 `rules/common/hooks.md` SLAs become unverifiable for every downstream user, not just us.
- Every bootstrapped project that uses `/compact` (which is every project) will accumulate inverted session rows. We ship a broken DB as the default.

Distribution without fixing data integrity is negative value. Fix first, ship second.

## Decision

**Bug A — capture duration at the calling hook (Option A1).** Each of the 9 blocking/warning hooks starts a `Date.now()` timer at the top of its main logic (immediately before `parseStdin()`, so parse cost is included in the measured hook duration), then passes `durationMs: Date.now() - start` into every `logHookEvent(...)` call. `log-hook-event.js` is unchanged. `session-end-all.js` is unchanged. The single new responsibility is a two-line edit per hook (declare `start`, pass `durationMs`).

**Bug B — fix the merge path and reset semantics in `session-manager.ts:startSession`.** On the resume branch:
1. Keep `startedAt: now` (intentional — the resume is a new interaction window).
2. Explicitly reset `endedAt` and `durationMs` in the DB, not just in the merged object. Since `upsertSession` uses `COALESCE` globally, we cannot achieve a reset through `upsertSession` alone. Two options considered (see Alternatives); chosen: **add an explicit `UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE id = ?` call inside `startSession` before the `upsertSession(merged)` call**, guarded by the existing-session branch. This is a surgical change, preserves `upsertSession`'s COALESCE-everywhere contract (which other call sites depend on), and leaves a single `session-manager.ts` file to review.

For both bugs, the fix is written in `scripts/lib/*.ts` and `.claude/hooks/scripts/*.js` — full /chekpoint tier (spektr for hook file paths, orakle for the new SQL write, ts-reviewer for session-manager, kody to consolidate). feniks-guided TDD: red test → fix → green.

### Acceptance criteria

1. `npx tsx scripts/db-health-check.ts` reports **zero** occurrences of `hook_duration_missing` after a session that fires any of the 9 blocking/warning hooks.
2. `npx tsx scripts/db-health-check.ts` reports **zero** occurrences of `sessions_timestamp_inversion` on any session created after the fix, including sessions that go through at least one `/compact` cycle.
3. New vitest tests (see Test Strategy below) enforce both invariants at the unit level so the detectors are not the only safety net.
4. `duration_ms` values for the 9 instrumented hooks fall within the budgets documented in `rules/common/hooks.md` (observe < 50ms is out of scope here — not one of the 9 — but serves as a later follow-up).

## Consequences

### What changes

**Bug A — files touched (10):**
- `.claude/hooks/scripts/block-no-verify.js` — `const start = Date.now();` near top of `try`, add `durationMs: Date.now() - start` to every `logHookEvent` call (1 call).
- `.claude/hooks/scripts/commit-format-guard.js` — same (1 call).
- `.claude/hooks/scripts/commit-quality.js` — same (1 call).
- `.claude/hooks/scripts/git-push-reminder.js` — same (1 call).
- `.claude/hooks/scripts/config-protection.js` — same (2 calls).
- `.claude/hooks/scripts/deps-change-reminder.js` — same (1 call).
- `.claude/hooks/scripts/no-context-guard.js` — same (2 calls).
- `.claude/hooks/scripts/console-log-warn.js` — same (1 call).
- `.claude/hooks/scripts/ts-review-reminder.js` — same (1 call).
- `.claude/hooks/scripts/log-hook-event.js` — JSDoc clarification only: `durationMs` should be filled in by caller; no behavior change.

**Bug B — files touched (1):**
- `scripts/lib/session-manager.ts` — add `resetSessionEndState(sessionId)` helper (or inline SQL call) that executes `UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE id = ?` before `upsertSession(merged)` in the existing-session branch. Export the helper from `state-store.ts` so the DAL stays co-located. `state-store.ts` gains a single new exported function `clearSessionEndState(id: string): void` with a prepared statement; `session-manager.ts` imports and calls it.

### Migration / backfill for existing rows

Both bugs have produced corrupt historical data in `~/.kadmon/kadmon.db`. Backfill semantics differ:

- **Bug A (historical `hook_events.duration_ms`):** **do not backfill.** There is no recoverable signal — we do not have pre/post timestamps for past hook executions. Document the cutover explicitly: all `hook_events` rows with `timestamp < cutover_date` have `duration_ms IS NULL` by design. `db-health.ts:186-200` already filters to a 24h window, so within one day of shipping the fix the anomaly will clear naturally on any active user's DB.

- **Bug B (historical inverted rows):** **soft repair via one-shot migration script.** Add `scripts/migrate-fix-session-inversion.ts` that runs:
  ```sql
  UPDATE sessions
  SET ended_at = NULL, duration_ms = NULL
  WHERE ended_at IS NOT NULL AND ended_at < started_at;
  ```
  Rationale: an inverted row means we know `ended_at` is wrong, but we do not know the true end time. Setting both fields to NULL preserves the session-start signal (still accurate), clears the broken end signal, and lets `getOrphanedSessions` pick the row up on the next session-start for recovery if the `observations.jsonl` for that session still exists in `/tmp/kadmon/<sid>/` (unlikely after the 7-day cleanup, but possible). For rows whose tmpdir is gone, they stay as open-ended sessions — no worse than their current corrupt state, and the health check becomes clean. The script is idempotent and logs the number of rows repaired.

The migration is optional for new bootstrapped projects (they start clean), and is invoked once on the current developer DB via `npx tsx scripts/migrate-fix-session-inversion.ts` as part of plan-007 rollout.

### Test strategy (TDD, feniks-guided)

All tests use `:memory:` SQLite per `rules/common/testing.md` and `rules/common/performance.md`.

**Bug A — `tests/hooks/hook-duration-instrumentation.test.ts`:**
1. Happy-path test per hook: run the hook via `execFileSync` with the standard test stdin, inspect the written `hook-events.jsonl`, assert the logged event has `durationMs > 0` and `durationMs < 500` (generous ceiling — real latency budgets live in `rules/common/hooks.md` and will be enforced in a later follow-up).
2. End-to-end test: run a synthetic session with at least one call through `no-context-guard`, call `session-end-all`, open `:memory:` DB, query `hook_events`, assert `duration_ms IS NOT NULL` for the corresponding row.
3. Regression test for the existing 9 hooks that captures the parameter shape — fails if a future edit drops `durationMs` from a `logHookEvent` call.

**Bug B — `tests/lib/session-manager.test.ts` (new or extended):**
1. Start → end → start (resume) → query. Assert post-resume row has `ended_at IS NULL`, `duration_ms IS NULL`, `started_at = T3`. This fails against current code.
2. Start → end → start (resume) → end. Assert final row has `ended_at >= started_at`, `duration_ms = T4 - T3` (not T2 - T1). This also fails against current code.
3. Invariant test: scan all sessions in test DB, assert `ended_at IS NULL OR ended_at >= started_at` for every row. Runs at the end of each session-manager test to act as a perma-guard.
4. Migration script test: seed a DB with 3 inverted rows + 2 clean rows, run `migrate-fix-session-inversion.ts` against it, assert inverted rows have `ended_at = NULL` and clean rows are untouched.

### Risks and mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fixing Bug A in 9 files means 9 chances to typo the timing code. | Medium | Single shared pattern (`const start = Date.now();` / `durationMs: Date.now() - start`), enforced by the per-hook test above. Consider extracting a `measureHookEvent(start, event)` helper if the boilerplate compounds — deferred decision, evaluate during implementation. |
| Bug B fix introduces a new SQL write path that spektr has not reviewed. | Low | Full /chekpoint tier mandates spektr. The new statement is parameterized (`WHERE id = ?`) with no user input — it takes only the sessionId already validated by `startSession`'s caller chain. |
| Migration script destroys data. | Low | `UPDATE ... SET NULL` is reversible only via DB backup. `session-start.js:44-49` already runs `rotateBackup(dbFile, 3)` on every session start, so the migration runs against a DB that has a fresh backup. Migration script also prints a dry-run count before applying and requires `--apply` flag to write. |
| `duration_ms` values for one hook exceed its budget and fail new tests. | Medium | The new per-hook tests use a loose 500ms ceiling, not the stricter budget. Budget enforcement is a separate v1.1 deliverable — this ADR only verifies the signal is present and non-zero. |
| COALESCE-based upsert contract changes break another caller. | Low | We are **not** changing `upsertSession`'s COALESCE semantics. The fix adds a separate `UPDATE ... SET NULL` call. No other call site is affected. |

### Review date

2026-05-01 — revisit after one week of production use on the developer DB. Confirm:
- `hook_duration_missing` anomaly remains absent.
- `sessions_timestamp_inversion` remains absent on sessions created post-fix.
- Per-hook `duration_ms` distributions are within expected budgets (feeds into a later latency-enforcement ADR).

## Alternatives Considered

### Bug A alternatives

**Option A1 (CHOSEN) — hook-measures-and-passes.** Each of the 9 hooks captures `start = Date.now()` at entry and passes `durationMs` into every `logHookEvent` call. `log-hook-event.js` and `session-end-all.js` unchanged.
- **Pros:** Single source of truth (the hook itself knows when its work starts and ends, with no ambiguity from I/O in the shared module). Zero changes to the logger and the reader. Easy to unit-test per hook. Works correctly even when a hook exits early via `process.exit(2)` — the final `logHookEvent` call runs before the exit, with the full measurement in hand. No coupling to observe-pre/post sequencing.
- **Cons:** Touches 9 files with near-identical boilerplate. Risk of drift if a future hook is added and the author forgets the timing wrapper.
- **Mitigation for cons:** Per-hook unit test (see Test Strategy) enforces the presence of a non-null `durationMs`. Adding a new blocking/warning hook without timing will fail its own test.

**Option A2 — logger-captures-timestamps, reader-pairs-them.** `log-hook-event.js` records `preTimestamp` and `postTimestamp` automatically; `session-end-all.js` computes `durationMs` by pairing pre/post entries for the same hook.
- **Pros:** No hook-file changes. Centralized logic.
- **Cons:** Blocking hooks call `logHookEvent` **once**, not pre+post. There is no second call to pair against — the event IS the terminal log. This option fundamentally does not fit the current call shape. Would require re-architecting every hook to emit pre+post events, which is strictly more invasive than Option A1.

**Option A3 — reuse `last_pre_ts.txt` and `observe-pre`/`observe-post` timing.** Leverage the existing observe-hook timestamp files to back-compute duration.
- **Pros:** Reuses existing infrastructure.
- **Cons:** `last_pre_ts.txt` is keyed by `tool_pre` / `tool_post` event pairs for Claude Code tool calls, not by hook execution. A blocking hook (e.g., `no-context-guard`) runs *inside* the Bash/Edit tool's pre phase — its duration is a sub-interval of the tool-pre timing, not the tool-pre timing itself. The grain is wrong. Also, using `observe-post` timestamps would conflate hook execution time with tool execution time, which is actively misleading for the latency budgets in `rules/common/hooks.md`. Rejected on semantic grounds, not just implementation effort.

**Decision rationale:** Option A1 wins because (1) it is the only option that actually measures *hook execution time*, not proxies for it; (2) the 9-file boilerplate risk is contained by a single shared pattern plus a per-hook test; (3) zero blast radius on the logger or reader, both of which are shared infrastructure we want stable.

### Bug B alternatives

**Option B1 (CHOSEN) — add explicit `clearSessionEndState` SQL call, leave `upsertSession` COALESCE contract untouched.** In `startSession`'s existing-session branch, call `clearSessionEndState(sessionId)` (new exported helper in `state-store.ts`) before `upsertSession(merged)`. The helper runs `UPDATE sessions SET ended_at = NULL, duration_ms = NULL WHERE id = ?`.
- **Pros:** Surgical. One new exported function, one new call site. `upsertSession`'s global COALESCE behavior — which other call sites rely on for partial-update semantics — stays exactly the same. The reset intent is explicit and self-documenting. Easy to test.
- **Cons:** Two writes where one would suffice (the UPDATE + the subsequent upsert). On sql.js this is negligible and both are wrapped in the same implicit transaction per-hook-call.

**Option B2 — change `upsertSession` to distinguish `null` from `undefined` and selectively bypass COALESCE on null.** Pass a sentinel or a second `resetFields` parameter that tells the SQL to use `excluded.ended_at` directly instead of COALESCE.
- **Pros:** Single write. Keeps all session state changes inside `upsertSession`.
- **Cons:** The SQL `ON CONFLICT` clause would need to be regenerated or templated per-call to swap COALESCE for a direct assignment on selected columns. This complicates a hot-path function that every caller uses. It also changes the `upsertSession` contract in a way that ripples through every test and caller of the function. High blast radius for a cosmetic win. Rejected.

**Option B3 — stop overwriting `started_at` on resume.** Treat resume as a continuation: preserve original `started_at`, only bump `compactionCount`.
- **Pros:** No inversion possible, because `started_at` is monotonic (never moves forward). The DB reflects session-as-logical-interaction instead of session-as-resume-window.
- **Cons:** Changes the semantic meaning of `started_at`. The current design (overwrite forward) exists because `/compact` is treated as a fresh interaction window where the dashboard should show "started N minutes ago" referring to the post-compact prompt, not the original session from hours earlier. Switching semantics would silently change dashboard displays and session-history trajectory, requiring a second pass on `session-start.js:171-216` and `/kadmon-harness`. Out of scope for a v1.1 data-integrity fix. **Defer to a future ADR** if the architect wants to revisit session semantics as part of the broader v1.x memory model.

**Option B4 — fix it in the migration script only.** Leave the merge path broken; run a periodic repair query.
- **Pros:** Zero code change.
- **Cons:** Ships with a known-broken write path and treats symptoms. Violates the Kadmon principle of "observe → verify" because the observer's own data is corrupt. Rejected unconditionally.

**Decision rationale:** Option B1 wins because it fixes the root cause with the smallest possible surface area, preserves the semantic choice that `/compact` bumps `started_at` (Option B3 would change that), keeps `upsertSession`'s contract stable (Option B2 would break it), and pairs naturally with the one-shot migration for historical rows. The ADR decision for this bug is as much about *what not to change* as what to change.

## Checklist Verification

- [x] Requirements documented with acceptance criteria (see Decision section)
- [x] API contracts defined — `clearSessionEndState(id: string): void` is the only new public function
- [x] Data models specified — no schema changes, only write-path behavior changes
- [x] Migration path from current state — soft repair script for Bug B, natural 24h rollover for Bug A
- [x] Error handling strategy — both fixes preserve the existing best-effort semantics (hook logger never throws, session-manager returns null on missing session)
- [x] Testing strategy planned — TDD per bug, feniks-guided, :memory: SQLite, per-hook + end-to-end + invariant coverage
- [x] Windows compatibility verified — no new shell commands, no new file paths, no changes to `parseStdin` or PATH handling
- [x] Observability — both fixes are verifiable via the existing `db-health-check` detector; that detector is the acceptance gate
- [x] Security review — kody pass 2026-04-14: parameterized SQL only, `--apply` gate, Windows-safe paths, no new attack surface. spektr to re-confirm during /chekpoint Phase 2.
- [x] Performance targets — per-hook `Date.now()` call adds < 0.01ms. Extra UPDATE on resume adds one write per `/compact` (not per edit). db-health-check post-fix shows zero anomalies and no latency regression in 514-test suite (18.72s).
