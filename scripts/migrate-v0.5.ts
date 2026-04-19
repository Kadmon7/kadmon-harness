// Migration script: v0.4 → v0.5
// Adds: instincts.last_observed_at (seeds confidence decay — plan-018 ECC port 1/4)
// Safe to run multiple times (uses try/catch for duplicate column errors).

import { openDb, closeDb } from "./lib/state-store.js";

async function main(): Promise<void> {
  const dbPath = process.argv[2] || undefined;
  const db = await openDb(dbPath);

  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: "instincts.last_observed_at",
      sql: "ALTER TABLE instincts ADD COLUMN last_observed_at TEXT",
    },
  ];

  let applied = 0;
  let failed = 0;
  for (const m of migrations) {
    try {
      db.exec(m.sql);
      console.log(`[ok]   Applied: ${m.name}`);
      applied++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        console.log(`[skip] Already exists: ${m.name}`);
      } else {
        console.error(`[err]  Failed: ${m.name} — ${msg}`);
        failed++;
      }
    }
  }

  closeDb();
  console.log(`\nMigration complete: ${applied} applied, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
