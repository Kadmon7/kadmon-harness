// One-shot migration (ADR-006 rollout):
// Archive active instincts whose pattern name matches one of the 13 hygiene
// pattern definitions removed from pattern-definitions.json on 2026-04-13.
// Idempotent. Status moves active -> archived; rows are preserved.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, closeDb, getDb } from "./lib/state-store.js";

export const DELETED_HYGIENE_PATTERN_NAMES: readonly string[] = [
  "Read files before editing them",
  "Verify before committing code",
  "Explore multiple files before taking action",
  "Search before writing new code",
  "Test after implementing changes",
  "Check dashboard for system health",
  "Plan before implementing changes",
  "Read tests alongside source code",
  "Commit before pushing",
  "Re-run tests after fixing failures",
  "Multi-file refactor pattern",
  "Glob search before editing",
  "Build after editing TypeScript",
];

export function runArchiveMigration(): { archivedIds: string[] } {
  const db = getDb();
  const placeholders = DELETED_HYGIENE_PATTERN_NAMES.map(() => "?").join(",");
  const selectStmt = db.prepare(
    `SELECT id FROM instincts WHERE status = 'active' AND pattern IN (${placeholders})`,
  );
  const rows = selectStmt.all(...DELETED_HYGIENE_PATTERN_NAMES);
  const archivedIds = rows
    .map((r) => r["id"])
    .filter((id): id is string => typeof id === "string");
  if (archivedIds.length === 0) return { archivedIds };

  const nowIso = new Date().toISOString();
  const updateStmt = db.prepare(
    "UPDATE instincts SET status = 'archived', updated_at = @updated_at WHERE id = @id",
  );
  for (const id of archivedIds) {
    updateStmt.run({ updated_at: nowIso, id });
  }
  return { archivedIds };
}

async function main(): Promise<void> {
  await openDb();
  try {
    const { archivedIds } = runArchiveMigration();
    process.stderr.write(
      `migrate-archive-hygiene-instincts: archived ${archivedIds.length} instincts\n`,
    );
    if (archivedIds.length > 0) {
      process.stderr.write(`archived ids: ${archivedIds.join(", ")}\n`);
    }
  } finally {
    closeDb();
  }
}

const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const invokedDirectly = path.resolve(scriptPath) === argvPath;
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(
      `migrate-archive-hygiene-instincts failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
