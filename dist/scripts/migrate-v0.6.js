// Migration script: v0.5 → v0.6
// Adds: agent_invocations.tool_use_id (parallel same-type invocation dedup fix, AUD-29)
// Rebuilds: idx_agent_invocations_natural_key as a 4-col index
//   (session_id, agent_type, timestamp, COALESCE(tool_use_id, '')).
// Safe to run multiple times (uses try/catch for duplicate column / already-exists errors).
//
// NOTE: this script is manual-repair/parity tooling, mirroring migrate-v0.5.ts.
// It is never auto-invoked by install.sh/install.ps1. The actual auto-fix for
// this bug lives in openDb() (scripts/lib/state-store.ts) — every DB opened
// through the normal harness runtime (hooks, CLI, dashboard) is migrated
// forward automatically on open. This script exists for operators who want to
// migrate a DB file directly without going through openDb() (e.g. inspecting
// or repairing a DB copy offline).
import { openDb, closeDb } from "./lib/state-store.js";
async function main() {
    const dbPath = process.argv[2] || undefined;
    const db = await openDb(dbPath);
    let applied = 0;
    let failed = 0;
    try {
        db.exec(`ALTER TABLE agent_invocations ADD COLUMN tool_use_id TEXT`);
        console.log(`[ok]   Applied: agent_invocations.tool_use_id`);
        applied++;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("duplicate column") || msg.includes("already exists")) {
            console.log(`[skip] Already exists: agent_invocations.tool_use_id`);
        }
        else {
            console.error(`[err]  Failed: agent_invocations.tool_use_id — ${msg}`);
            failed++;
        }
    }
    try {
        db.exec(`DROP INDEX IF EXISTS idx_agent_invocations_natural_key`);
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_invocations_natural_key
         ON agent_invocations(session_id, agent_type, timestamp, COALESCE(tool_use_id, ''))`);
        console.log(`[ok]   Applied: idx_agent_invocations_natural_key (4-col rebuild)`);
        applied++;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[err]  Failed: idx_agent_invocations_natural_key rebuild — ${msg}`);
        failed++;
    }
    closeDb();
    console.log(`\nMigration complete: ${applied} applied, ${failed} failed.`);
    if (failed > 0)
        process.exit(1);
}
main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
