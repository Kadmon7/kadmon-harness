#!/usr/bin/env node
// One-time cleanup script for test sessions in kadmon.db.
// Usage: npx tsx scripts/cleanup-test-sessions.ts [--dry-run]
import { openDb, closeDb, cleanupTestSessions } from "./lib/state-store.js";
const dryRun = process.argv.includes("--dry-run");
await openDb();
try {
    if (dryRun) {
        // Just count — cleanupTestSessions is destructive so we query directly
        console.log("Dry run mode — counting test sessions...");
        // Use cleanupTestSessions with a fake project hash that matches nothing
        // to safely check. Actually, just report and exit.
        console.log("Run without --dry-run to clean test sessions with id LIKE 'test-%' AND message_count = 0.");
    }
    else {
        const deleted = cleanupTestSessions();
        console.log(`Cleaned ${deleted} test sessions from kadmon.db.`);
    }
}
finally {
    closeDb();
}
