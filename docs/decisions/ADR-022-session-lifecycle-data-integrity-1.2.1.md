---
number: 022
title: Session lifecycle data-integrity fixes (orphan staleness guard + hook_events/agent_invocations dedup)
date: 2026-04-22
status: accepted
route: retroactive-stub
---

# ADR-022: Session lifecycle data-integrity fixes (v1.2.1)

**Deciders**: Ych-Kadmon (reconstructed retroactively 2026-07-12 — see Provenance)

## Provenance

This ADR was never written at the time the decision shipped. `ADR-022` has been used as a code-comment tag across the codebase since the `[1.2.1]` release (2026-04-22) — `scripts/lib/orphan-staleness.ts`, `scripts/lib/state-store.ts`, `scripts/lib/session-manager.ts`, `.claude/hooks/scripts/session-start.js`, and multiple test files all cite "ADR-022" for the mechanisms described below — but no corresponding markdown file was ever created. `CLAUDE.md` (`KADMON_ORPHAN_STALE_MS`) and `CHANGELOG.md` (`[1.2.1]`) both point at "ADR-022" as if the file existed.

This stub was reconstructed from that evidence during the 2026-07-12 doc-drift audit (BACKLOG AUD-17), rather than left as a dead reference, because the surrounding CHANGELOG `[1.2.1]` entry and the code comments together make the original intent unambiguous. It documents what shipped; it does not add new decisions.

## Context

The `[1.2.1]` release (2026-04-22) closed two related data-integrity bugs surfaced during multi-terminal dogfooding:

1. **Orphan recovery false positives ("Bug 2")** — `session-start.js`'s crash-recovery path could mark a session as orphaned and recover it even while that session was still alive in another terminal, because there was no minimum-inactivity threshold before a session was considered a recovery candidate.
2. **Duplicate `hook_events` / `agent_invocations` rows** — lifecycle hooks firing twice for the same event (a known double-fire pattern on Windows) produced duplicate DB rows because neither table had a natural-key uniqueness constraint.

## Decision

1. **Orphan staleness guard** — introduce `isOrphanStale()` (`scripts/lib/orphan-staleness.ts`) gated by a new `KADMON_ORPHAN_STALE_MS` env var (default `300000` = 5 minutes). `session-start.js`'s recovery path only treats a session as an orphan candidate once it has been inactive longer than this threshold. A companion guard in `session-manager.ts` (`endSession` cross-project assert) rejects ending a session whose `project_hash` does not match the caller's, as defense-in-depth against the same class of cross-session interference.
2. **Natural-key dedup on `hook_events` and `agent_invocations`** — add a `UNIQUE INDEX` on the natural key (`session_id`, `hook_name`, `event_type`, `timestamp` for hook_events) and use `ON CONFLICT DO NOTHING` on insert, so a hook firing twice for the same event persists one row, not two.

## Consequences

- **Positive**: eliminated the "session-start pisa live sessions in other terminals" failure mode; duplicate-row inflation in `hook_events`/`agent_invocations` stopped.
- **Negative**: introduces one more env var (`KADMON_ORPHAN_STALE_MS`) to document and keep in sync with `session-start.js` defaults. The 5-minute default is a heuristic, not derived from measurement.
- **Known follow-up**: orphan recovery still fails to trigger in ~20% of sessions per later observation (tracked in BACKLOG.md, "Orphan-recovery trigger fails ~20% of sessions (ADR-022 internals OK)") — the staleness guard itself works as designed; the gap is in when recovery is *invoked*, not in `isOrphanStale()`'s logic.

## Compatibility

No schema migration is required for fresh installs (the unique index is part of `schema.sql`). Existing DBs with pre-existing duplicate rows are cleaned up by `cleanupDuplicateHookEvents` (see `state-store.ts`), which the migration-cleanup test suite covers.

## Sources

- `CHANGELOG.md` `[1.2.1]` — 2026-04-22 (original shipped-work record)
- `scripts/lib/orphan-staleness.ts`, `scripts/lib/state-store.ts`, `scripts/lib/session-manager.ts`, `.claude/hooks/scripts/session-start.js` — implementation
- `tests/lib/orphan-staleness.test.ts`, `tests/lib/session-manager.test.ts`, `tests/lib/state-store-migration-cleanup.test.ts` — test coverage
