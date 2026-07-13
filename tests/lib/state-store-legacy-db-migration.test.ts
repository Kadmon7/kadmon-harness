// TDD [feniks]
// AUD-29 CRITICAL/BLOCK (Wave 3 cluster A, confirmed by orakle + typescript-reviewer):
// openDb() applies schema.sql only via CREATE TABLE/INDEX IF NOT EXISTS — both
// name-gated, not definition-gated. On a pre-existing on-disk DB from before the
// tool_use_id column + 4-col natural-key index landed, that means:
//   1. The ALTER never runs (table already exists), so tool_use_id is missing.
//   2. The index stays 3-col (index name already exists).
//   3. The ADR-022 dedup sentinel's `GROUP BY ... COALESCE(tool_use_id, '')`
//      throws "no such column: tool_use_id" -- and the catch only swallows
//      /no such table/i, so this re-throws and openDb() fails outright.
// This test seeds a genuine OLD-schema on-disk DB file (raw sql.js, 3-col
// index, no tool_use_id column) and proves openDb() must migrate it forward.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import initSqlJs from "sql.js";
import {
  openDb,
  closeDb,
  insertAgentInvocation,
  getAgentInvocationsBySession,
} from "../../scripts/lib/state-store.js";

const OLD_SCHEMA = `
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

const tempDirs: string[] = [];

async function createLegacyDb(): Promise<string> {
  const SQL = await initSqlJs();
  const rawDb = new SQL.Database();
  for (const stmt of OLD_SCHEMA.split(";").filter((s) => s.trim())) {
    rawDb.run(stmt + ";");
  }
  const data = rawDb.export();
  rawDb.close();

  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "kadmon-legacy-db-test-"),
  );
  tempDirs.push(tmpDir);
  const dbPath = path.join(tmpDir, "legacy.db");
  fs.writeFileSync(dbPath, Buffer.from(data));
  return dbPath;
}

afterEach(() => {
  closeDb();
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
  tempDirs.length = 0;
});

describe("openDb() forward migration for pre-existing on-disk DBs (AUD-29)", () => {
  it("opens a legacy on-disk DB without throwing 'no such column: tool_use_id'", async () => {
    const dbPath = await createLegacyDb();

    await expect(openDb(dbPath)).resolves.toBeDefined();
  });

  it("adds the tool_use_id column to agent_invocations after opening a legacy DB", async () => {
    const dbPath = await createLegacyDb();
    const db = await openDb(dbPath);

    const columns = db
      .prepare("PRAGMA table_info(agent_invocations)")
      .all() as unknown as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("tool_use_id");
  });

  it("rebuilds idx_agent_invocations_natural_key as a 4-column index after opening a legacy DB", async () => {
    const dbPath = await createLegacyDb();
    const db = await openDb(dbPath);

    const indexColumns = db
      .prepare("PRAGMA index_xinfo(idx_agent_invocations_natural_key)")
      .all() as unknown as Array<{ name: string | null; key: number }>;
    // key=1 marks columns that are part of the index key (excludes the
    // trailing rowid alias sql.js reports for some index types).
    const keyColumns = indexColumns.filter((c) => c.key === 1);

    expect(keyColumns.length).toBe(4);
  });

  it("retains both rows for parallel same-type invocations with distinct toolUseId after migrating a legacy DB", async () => {
    const dbPath = await createLegacyDb();
    const db = await openDb(dbPath);
    db.prepare(
      "INSERT INTO sessions (id, project_hash, started_at) VALUES (@id, @project_hash, @started_at)",
    ).run({ id: "s1", project_hash: "p1", started_at: "2026-07-13T00:00:00Z" });

    const ts = "2026-07-13T09:00:00.000Z";
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      toolUseId: "toolu_parallel_1",
      timestamp: ts,
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      toolUseId: "toolu_parallel_2",
      timestamp: ts,
    });

    const invocations = getAgentInvocationsBySession("s1");
    expect(invocations).toHaveLength(2);
    const toolUseIds = invocations.map((i) => i.toolUseId).sort();
    expect(toolUseIds).toEqual(["toolu_parallel_1", "toolu_parallel_2"]);
  });

  it("is idempotent -- opening the same now-migrated file a second time still succeeds", async () => {
    const dbPath = await createLegacyDb();
    await openDb(dbPath);
    closeDb();

    await expect(openDb(dbPath)).resolves.toBeDefined();

    const db = await openDb(dbPath);
    const columns = db
      .prepare("PRAGMA table_info(agent_invocations)")
      .all() as unknown as Array<{ name: string }>;
    expect(columns.map((c) => c.name)).toContain("tool_use_id");
  });
});
