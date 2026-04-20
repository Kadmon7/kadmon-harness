/**
 * migrate-fix-session-inversion.ts
 *
 * One-shot migration that repairs historical inverted session rows in the
 * Kadmon Harness SQLite database. An "inverted" row has `ended_at < started_at`,
 * which occurs when the COALESCE-based `upsertSession` preserves a stale
 * `ended_at` from the previous lifecycle after a /compact resume that moves
 * `started_at` forward. See ADR-007, Bug B for the full root-cause trace.
 *
 * Repair strategy: set `ended_at = NULL` and `duration_ms = NULL` for every
 * inverted row. This preserves the session-start signal (still accurate) and
 * clears the broken end signal. Idempotent — a second run with --apply finds
 * zero rows and is a no-op.
 *
 * Historical `hook_events.duration_ms` rows are NOT repaired here (no recoverable
 * timing signal exists for past hook executions). See ADR-007 for rationale.
 *
 * Usage:
 *   npx tsx scripts/migrate-fix-session-inversion.ts            # dry-run (default)
 *   npx tsx scripts/migrate-fix-session-inversion.ts --apply    # mutate DB
 *
 * DB path: ~/.kadmon/kadmon.db (production default)
 * Override for tests: KADMON_TEST_DB=:memory: (honours the same env var as the rest of the codebase)
 *
 * Reference: docs/decisions/ADR-007-sprint-c-data-integrity-fixes.md
 */
export interface MigrationResult {
    /** Number of rows found with ended_at < started_at before this run. */
    invertedCount: number;
    /** Number of rows actually repaired (0 in dry-run mode). */
    repairedCount: number;
    /** true when no writes were performed. */
    dryRun: boolean;
}
/**
 * Count and optionally repair all sessions where ended_at IS NOT NULL AND
 * ended_at < started_at.
 *
 * @param options.apply  When false (default), dry-run only — no writes.
 *                       When true, NULLs out ended_at and duration_ms on every
 *                       inverted row.
 * @returns MigrationResult with counts and mode flag.
 */
export declare function runMigration(options: {
    apply: boolean;
}): MigrationResult;
