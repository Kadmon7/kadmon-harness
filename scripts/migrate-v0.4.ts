// Migration script: v0.3 → v0.4
// Adds: hook_events table, agent_invocations table + indexes
// Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS).

import { openDb, closeDb } from "./lib/state-store.js";

async function main(): Promise<void> {
  const dbPath = process.argv[2] || undefined;
  const db = await openDb(dbPath);

  const migrations: Array<{ name: string; sql: string }> = [
    {
      name: "hook_events table",
      sql: `CREATE TABLE IF NOT EXISTS hook_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        hook_name TEXT NOT NULL,
        event_type TEXT NOT NULL CHECK (event_type IN ('pre_tool', 'post_tool', 'post_tool_fail', 'pre_compact', 'session_start', 'stop')),
        tool_name TEXT,
        exit_code INTEGER NOT NULL DEFAULT 0,
        blocked INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        error TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      name: "agent_invocations table",
      sql: `CREATE TABLE IF NOT EXISTS agent_invocations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        agent_type TEXT NOT NULL,
        model TEXT,
        description TEXT,
        duration_ms INTEGER,
        success INTEGER,
        error TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    },
    {
      name: "idx_hook_events_session",
      sql: "CREATE INDEX IF NOT EXISTS idx_hook_events_session ON hook_events(session_id)",
    },
    {
      name: "idx_hook_events_hook",
      sql: "CREATE INDEX IF NOT EXISTS idx_hook_events_hook ON hook_events(hook_name)",
    },
    {
      name: "idx_hook_events_timestamp",
      sql: "CREATE INDEX IF NOT EXISTS idx_hook_events_timestamp ON hook_events(timestamp DESC)",
    },
    {
      name: "idx_agent_invocations_session",
      sql: "CREATE INDEX IF NOT EXISTS idx_agent_invocations_session ON agent_invocations(session_id)",
    },
    {
      name: "idx_agent_invocations_agent",
      sql: "CREATE INDEX IF NOT EXISTS idx_agent_invocations_agent ON agent_invocations(agent_type)",
    },
    {
      name: "idx_agent_invocations_timestamp",
      sql: "CREATE INDEX IF NOT EXISTS idx_agent_invocations_timestamp ON agent_invocations(timestamp DESC)",
    },
  ];

  let applied = 0;
  for (const m of migrations) {
    try {
      db.exec(m.sql);
      console.log(`Applied: ${m.name}`);
      applied++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        console.log(`Skipped (already exists): ${m.name}`);
      } else {
        console.error(`Failed: ${m.name} -- ${msg}`);
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
