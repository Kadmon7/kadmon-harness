// Migration script: v0.2 → v0.3
// Adds: sessions.summary, instincts.domain
// Safe to run multiple times (uses try/catch for duplicate column errors).
import { openDb, closeDb } from "./lib/state-store.js";
async function main() {
    const dbPath = process.argv[2] || undefined;
    const db = await openDb(dbPath);
    const migrations = [
        {
            name: "sessions.summary",
            sql: "ALTER TABLE sessions ADD COLUMN summary TEXT",
        },
        {
            name: "instincts.domain",
            sql: "ALTER TABLE instincts ADD COLUMN domain TEXT",
        },
    ];
    let applied = 0;
    for (const m of migrations) {
        try {
            db.exec(m.sql);
            console.log(`✅ Applied: ${m.name}`);
            applied++;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("duplicate column") || msg.includes("already exists")) {
                console.log(`⏭️  Skipped (already exists): ${m.name}`);
            }
            else {
                console.error(`❌ Failed: ${m.name} — ${msg}`);
            }
        }
    }
    closeDb();
    console.log(`\nMigration complete: ${applied} applied.`);
}
main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
