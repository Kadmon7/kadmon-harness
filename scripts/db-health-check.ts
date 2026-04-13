// DB diagnostic CLI — prints the report from scripts/lib/db-health.ts.
// Usage: npx tsx scripts/db-health-check.ts

import { openDb, closeDb } from "./lib/state-store.js";
import { getDbHealthReport } from "./lib/db-health.js";

await openDb();
const report = getDbHealthReport();

console.log("\n=== ANOMALIES ===");
if (report.anomalies.length === 0) {
  console.log("  (none detected)");
} else {
  for (const a of report.anomalies) console.log(`  [!] ${a}`);
}

console.log("\n=== TABLE COUNTS ===");
for (const [t, n] of Object.entries(report.tableCounts)) {
  console.log(`  ${t.padEnd(20)} ${n}`);
}

console.log("\n=== FRESHNESS (latest row per table) ===");
for (const [t, ts] of Object.entries(report.freshness)) {
  console.log(`  ${t.padEnd(20)} ${ts ?? "(empty)"}`);
}

console.log("\n=== LAST 3 SESSIONS ===");
console.table(report.lastSessions);

console.log("\n=== HOOK EVENTS — last 24h ===");
console.table(report.hookEvents24h);

console.log("\n=== AGENT INVOCATIONS — last 24h ===");
console.table(report.agentInvocations24h);

console.log("\n=== COST EVENTS — last 24h ===");
console.table(report.costEvents24h);

closeDb();
