// TDD [feniks]
// Gap #16 of plan-002: migration script tests
// Tests: migrate-v0.4.ts — creates hook_events and agent_invocations tables on a v0.3 DB

import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import initSqlJs from "sql.js";

// v0.3 schema: only the 4 original tables + their indexes (no hook_events, no agent_invocations)
const V0_3_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  duration_ms INTEGER,
  branch TEXT,
  tasks TEXT DEFAULT '[]',
  files_modified TEXT DEFAULT '[]',
  tools_used TEXT DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd REAL DEFAULT 0,
  instincts_created TEXT DEFAULT '[]',
  compaction_count INTEGER DEFAULT 0,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS instincts (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.30,
  occurrences INTEGER NOT NULL DEFAULT 1,
  contradictions INTEGER NOT NULL DEFAULT 0,
  source_sessions TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'promoted', 'contradicted', 'archived')),
  scope TEXT NOT NULL DEFAULT 'project'
    CHECK (scope IN ('project', 'global')),
  domain TEXT,
  promoted_to TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS cost_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_instincts_project ON instincts(project_hash);
CREATE INDEX IF NOT EXISTS idx_instincts_status ON instincts(status);
CREATE INDEX IF NOT EXISTS idx_instincts_confidence ON instincts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_cost_events_session ON cost_events(session_id);
CREATE INDEX IF NOT EXISTS idx_cost_events_timestamp ON cost_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
`;

const SCRIPT = path.resolve("scripts/migrate-v0.4.ts");

const tempDbFiles: string[] = [];

async function createV03Db(): Promise<string> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  for (const stmt of V0_3_SCHEMA.split(";").filter((s) => s.trim())) {
    rawDb.run(stmt + ";");
  }

  const data = rawDb.export();
  rawDb.close();

  const tempPath = path.join(os.tmpdir(), `kadmon-test-v03-${Date.now()}.db`);
  fs.writeFileSync(tempPath, Buffer.from(data));
  tempDbFiles.push(tempPath);
  return tempPath;
}

function runMigration(dbPath: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  // spawnSync with shell:true is required on Windows — npx is a .cmd script,
  // not a binary, so execFileSync cannot resolve it without the shell.
  const result = spawnSync("npx", ["tsx", SCRIPT, dbPath], {
    encoding: "utf8",
    shell: true,
    cwd: path.resolve("."),
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

async function tableExists(
  dbPath: string,
  tableName: string,
): Promise<boolean> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database(fs.readFileSync(dbPath));
  try {
    rawDb.run(`SELECT COUNT(*) FROM ${tableName}`);
    rawDb.close();
    return true;
  } catch {
    rawDb.close();
    return false;
  }
}

afterEach(() => {
  for (const f of tempDbFiles) {
    try {
      fs.unlinkSync(f);
    } catch {
      // ignore cleanup errors
    }
  }
  tempDbFiles.length = 0;
});

describe("migrate-v0.4", () => {
  it("creates hook_events and agent_invocations tables on a fresh v0.3 DB", async () => {
    // arrange — v0.3 DB without the two new tables
    const dbPath = await createV03Db();

    // act
    const result = runMigration(dbPath);

    // assert — exit code 0
    expect(result.exitCode).toBe(0);

    // assert — stdout reports the two tables as applied
    expect(result.stdout).toContain("Applied: hook_events table");
    expect(result.stdout).toContain("Applied: agent_invocations table");
    expect(result.stdout).toContain("Migration complete:");

    // assert — both tables now exist in the DB file
    expect(await tableExists(dbPath, "hook_events")).toBe(true);
    expect(await tableExists(dbPath, "agent_invocations")).toBe(true);
  }, 30_000);

  it("is idempotent — running the migration twice does not error", async () => {
    // arrange
    const dbPath = await createV03Db();

    // act — first run
    const first = runMigration(dbPath);
    expect(first.exitCode).toBe(0);

    // act — second run (idempotency check)
    const second = runMigration(dbPath);

    // assert — second run exits cleanly
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Migration complete:");

    // assert — tables still intact after second run
    expect(await tableExists(dbPath, "hook_events")).toBe(true);
    expect(await tableExists(dbPath, "agent_invocations")).toBe(true);
  }, 60_000);
});
