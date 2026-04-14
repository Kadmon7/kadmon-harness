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

import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, closeDb, getDb } from "./lib/state-store.js";

// ─── Types ───

export interface MigrationResult {
  /** Number of rows found with ended_at < started_at before this run. */
  invertedCount: number;
  /** Number of rows actually repaired (0 in dry-run mode). */
  repairedCount: number;
  /** true when no writes were performed. */
  dryRun: boolean;
}

// ─── Core logic ───

/**
 * Count and optionally repair all sessions where ended_at IS NOT NULL AND
 * ended_at < started_at.
 *
 * @param options.apply  When false (default), dry-run only — no writes.
 *                       When true, NULLs out ended_at and duration_ms on every
 *                       inverted row.
 * @returns MigrationResult with counts and mode flag.
 */
export function runMigration(options: { apply: boolean }): MigrationResult {
  const db = getDb();

  // Count inverted rows
  const countRow = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM sessions
       WHERE ended_at IS NOT NULL AND ended_at < started_at`,
    )
    .get();
  const invertedCount = countRow ? Number(countRow.cnt ?? 0) : 0;

  if (!options.apply || invertedCount === 0) {
    return {
      invertedCount,
      repairedCount: 0,
      dryRun: !options.apply,
    };
  }

  // Apply: NULL out ended_at and duration_ms for every inverted row
  db.prepare(
    `UPDATE sessions
     SET ended_at = NULL, duration_ms = NULL
     WHERE ended_at IS NOT NULL AND ended_at < started_at`,
  ).run();

  return {
    invertedCount,
    repairedCount: invertedCount,
    dryRun: false,
  };
}

// ─── CLI entry point ───

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const dbPath = process.env.KADMON_TEST_DB;

  await openDb(dbPath);

  try {
    const result = runMigration({ apply });

    if (result.dryRun) {
      console.log(
        `[dry-run] DB: ${dbPath ?? "~/.kadmon/kadmon.db (default)"}`,
      );
      console.log(
        `[dry-run] ${result.invertedCount} inverted session rows found (ended_at < started_at).`,
      );
      if (result.invertedCount > 0) {
        // Show sample rows for user confirmation before --apply
        const db = getDb();
        const samples = db
          .prepare(
            `SELECT id, started_at, ended_at FROM sessions
             WHERE ended_at IS NOT NULL AND ended_at < started_at
             ORDER BY started_at DESC LIMIT 3`,
          )
          .all();
        console.log(`[dry-run] First ${samples.length} inverted row(s):`);
        for (const row of samples) {
          console.log(
            `  id=${String(row.id)}  started_at=${String(row.started_at)}  ended_at=${String(row.ended_at)}`,
          );
        }
        console.log(
          `[dry-run] Run with --apply to repair ${result.invertedCount} row(s).`,
        );
      } else {
        console.log("[dry-run] Nothing to repair.");
      }
    } else {
      console.log(`Repaired ${result.repairedCount} inverted session row(s).`);
      if (result.repairedCount === 0) {
        console.log("Nothing to repair — DB is already clean.");
      }
    }
  } finally {
    closeDb();
  }
}

// ─── Guard: only run main when invoked directly (not when imported in tests) ───

const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const invokedDirectly = path.resolve(scriptPath) === argvPath;

if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(
      `migrate-fix-session-inversion failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
