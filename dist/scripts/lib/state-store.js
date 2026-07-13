// Kadmon Harness — SQLite State Store (sql.js) — public facade
//
// AUD-37: this file was a 1201-line monolith (over the 800-line hard limit). It
// is now a thin barrel that re-exports the domain modules under ./state-store/.
// The public API is byte-for-byte the same, so all ~65 import sites keep their
// `from ".../state-store.js"` imports unchanged — no consumer edit was needed.
//
// The core module (./state-store/core.ts) owns the sql.js wrapper, the DB
// singleton, schema apply + forward migrations, and the shared parseJson helper.
// parseJson + the WrappedDb type stay internal to the package (consumed by the
// domain modules, never part of the public surface) — hence the explicit named
// re-export of core's public trio rather than `export *`.
export { openDb, getDb, closeDb } from "./state-store/core.js";
export * from "./state-store/sessions.js";
export * from "./state-store/instincts.js";
export * from "./state-store/cost-events.js";
export * from "./state-store/sync-queue.js";
export * from "./state-store/hook-events.js";
export * from "./state-store/agent-invocations.js";
export * from "./state-store/research-reports.js";
