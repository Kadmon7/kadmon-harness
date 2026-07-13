// TDD [feniks]
// AUD-29 companion migration script tests — mirrors migrate-v0.4.test.ts pattern.
// Tests: migrate-v0.6.ts — adds agent_invocations.tool_use_id + rebuilds the
// natural-key index as 4-col on a legacy (pre-AUD-29) on-disk DB.
//
// Note: openDb() itself now auto-migrates on open (scripts/lib/state-store.ts),
// so by the time migrate-v0.6.ts's own statements run, the DB is often already
// migrated — these tests verify the whole pipeline (auto-migration + the
// script's own idempotent statements) completes cleanly end to end, matching
// the existing migrate-v0.4/v0.5 CLI-script convention.

import { describe, it, expect, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import initSqlJs from "sql.js";

// Legacy (pre-AUD-29) schema: agent_invocations WITHOUT tool_use_id, 3-col index.
const LEGACY_SCHEMA = `
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  started_at TEXT,
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
  created_at TEXT
);
CREATE TABLE hook_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  hook_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  exit_code INTEGER NOT NULL DEFAULT 0,
  blocked INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  timestamp TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_hook_events_natural_key
  ON hook_events(session_id, hook_name, event_type, timestamp);
CREATE TABLE agent_invocations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  agent_type TEXT NOT NULL,
  model TEXT,
  description TEXT,
  duration_ms INTEGER,
  success INTEGER,
  error TEXT,
  timestamp TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_agent_invocations_natural_key
  ON agent_invocations(session_id, agent_type, timestamp);
`;

const SCRIPT = path.resolve("scripts/migrate-v0.6.ts");

const tempDbFiles: string[] = [];

async function createLegacyDb(): Promise<string> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();

  for (const stmt of LEGACY_SCHEMA.split(";").filter((s) => s.trim())) {
    rawDb.run(stmt + ";");
  }

  const data = rawDb.export();
  rawDb.close();

  const tempPath = path.join(os.tmpdir(), `kadmon-test-v06-${Date.now()}.db`);
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

async function getAgentInvocationColumns(dbPath: string): Promise<string[]> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database(fs.readFileSync(dbPath));
  try {
    const stmt = rawDb.prepare("PRAGMA table_info(agent_invocations)");
    const names: string[] = [];
    while (stmt.step()) {
      names.push(String(stmt.getAsObject().name));
    }
    stmt.free();
    return names;
  } finally {
    rawDb.close();
  }
}

async function getNaturalKeyIndexColumnCount(dbPath: string): Promise<number> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database(fs.readFileSync(dbPath));
  try {
    const stmt = rawDb.prepare(
      "PRAGMA index_xinfo(idx_agent_invocations_natural_key)",
    );
    let count = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      if (Number(row.key) === 1) count++;
    }
    stmt.free();
    return count;
  } finally {
    rawDb.close();
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

describe("migrate-v0.6", () => {
  it("adds tool_use_id and rebuilds the natural-key index as 4-col on a legacy DB", async () => {
    // arrange — legacy DB without tool_use_id, 3-col index
    const dbPath = await createLegacyDb();

    // act
    const result = runMigration(dbPath);

    // assert — exit code 0, no crash on "no such column"
    expect(result.exitCode).toBe(0);
    expect(result.stderr).not.toContain("no such column");
    expect(result.stdout).toContain("Migration complete:");

    // assert — column now present
    expect(await getAgentInvocationColumns(dbPath)).toContain("tool_use_id");

    // assert — index is now 4-col
    expect(await getNaturalKeyIndexColumnCount(dbPath)).toBe(4);
  }, 30_000);

  it("is idempotent — running the migration twice does not error", async () => {
    // arrange
    const dbPath = await createLegacyDb();

    // act — first run
    const first = runMigration(dbPath);
    expect(first.exitCode).toBe(0);

    // act — second run (idempotency check)
    const second = runMigration(dbPath);

    // assert — second run exits cleanly
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Migration complete:");

    // assert — schema still correct after second run
    expect(await getAgentInvocationColumns(dbPath)).toContain("tool_use_id");
    expect(await getNaturalKeyIndexColumnCount(dbPath)).toBe(4);
  }, 60_000);
});
