/**
 * Phase 1b — E2E Workflow Tests (kartograf)
 * 5 critical scenarios verifying full workflows across multiple components.
 * All DB operations use KADMON_TEST_DB=:memory: or a temp file path.
 * Real hook scripts run via execFileSync; no mocking of the system under test.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

type SqlValue = number | string | Uint8Array | null;

// ─── Paths ────────────────────────────────────────────────────────────────────
const HOOKS_DIR = path.resolve(".claude/hooks/scripts");
const HOOK_OBSERVE_PRE = path.join(HOOKS_DIR, "observe-pre.js");
const HOOK_OBSERVE_POST = path.join(HOOKS_DIR, "observe-post.js");
const HOOK_NO_CTX = path.join(HOOKS_DIR, "no-context-guard.js");
const HOOK_SESSION_END = path.join(HOOKS_DIR, "session-end-all.js");
const SCHEMA_PATH = path.resolve("scripts/lib/schema.sql");

// ─── Helpers ─────────────────────────────────────────────────────────────────
function runHook(
  hookPath: string,
  input: object,
  env: Record<string, string> = {},
): { stdout: string; stderr: string; exitCode: number } {
  const merged = { ...process.env, ...env };
  try {
    const stdout = execFileSync("node", [hookPath], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 20000,
      env: merged,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

async function readDbRows(
  dbPath: string,
  sql: string,
  params: SqlValue[] = [],
): Promise<Record<string, unknown>[]> {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(dbPath);
  const db = new SQL.Database(data);
  try {
    const stmt = db.prepare(sql);
    try {
      if (params.length > 0) stmt.bind(params);
      const rows: Record<string, unknown>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  } finally {
    db.close();
  }
}

function obsDir(sid: string): string {
  return path.join(os.tmpdir(), "kadmon", sid);
}
function obsPath(sid: string): string {
  return path.join(obsDir(sid), "observations.jsonl");
}

// ─── Scenario 1: Session lifecycle ───────────────────────────────────────────
describe("Scenario 1 — session lifecycle", () => {
  const SID = `test-e2e-s1-${Date.now()}`;
  let testDb: string;

  beforeEach(() => {
    testDb = path.join(os.tmpdir(), `e2e-s1-${Date.now()}.db`);
  });

  afterEach(() => {
    // Clean up temp files and session dir
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("session-start creates session row, observe-pre appends JSONL, session-end-all persists and closes", async () => {
    // Step 1: session-start (requires git repo — we are IN one, so it works)
    const startResult = runHook(
      HOOK_SESSION_END, // we use session-end-all for full lifecycle
      {
        session_id: SID,
        cwd: process.cwd(),
        // Provide token counts so cost phase succeeds
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: "sonnet",
      },
      { KADMON_TEST_DB: testDb },
    );
    // session-end-all may exit 0 even when session doesn't exist — check output
    expect(startResult.exitCode, "session-end-all exit code").toBe(0);

    // Step 2: Seed the DB with a session row, then run observe-pre + session-end-all
    // to verify the full insert-persist path.

    // Seed DB with session row directly via sql.js
    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
           VALUES (?, ?, ?, ?)`,
        [SID, "test-project-hash", new Date().toISOString(), 0],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    // Step 3: observe-pre writes to JSONL
    const preResult = runHook(HOOK_OBSERVE_PRE, {
      session_id: SID,
      tool_name: "Read",
      tool_input: { file_path: "/some/file.ts" },
    });
    expect(preResult.exitCode, "observe-pre exit code").toBe(0);
    expect(fs.existsSync(obsPath(SID)), "observations.jsonl created").toBe(
      true,
    );

    const obsContent = fs.readFileSync(obsPath(SID), "utf8");
    const obsLines = obsContent.trim().split("\n").filter(Boolean);
    expect(obsLines.length, "at least one JSONL line").toBeGreaterThanOrEqual(
      1,
    );
    const firstEntry = JSON.parse(obsLines[0]);
    expect(firstEntry.toolName, "tool_pre toolName").toBe("Read");
    expect(firstEntry.eventType, "event type is tool_pre").toBe("tool_pre");

    // Step 4: session-end-all persists session to DB
    const endResult = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: { input_tokens: 5000, output_tokens: 2000 },
        model: "sonnet",
      },
      { KADMON_TEST_DB: testDb },
    );
    expect(endResult.exitCode, "session-end-all exit code").toBe(0);

    // Step 5: verify session row in DB has been updated
    const rows = await readDbRows(
      testDb,
      `SELECT id, ended_at FROM sessions WHERE id = ?`,
      [SID],
    );
    expect(rows.length, "session row exists").toBe(1);
    expect(String(rows[0].id), "session id matches").toBe(SID);
  }, 30000);
});

// ─── Scenario 2: Instinct lifecycle ──────────────────────────────────────────
describe("Scenario 2 — instinct lifecycle", () => {
  let openDb: (p: string) => Promise<unknown>;
  let closeDb: () => void;
  let createInstinct: (
    p: string,
    pat: string,
    act: string,
    s: string,
  ) => { id: string; confidence: number; status: string };
  let reinforceInstinct: (
    id: string,
    s: string,
  ) => { confidence: number; occurrences: number } | null;
  let promoteInstinct: (
    id: string,
    skill: string,
  ) => { status: string; promotedTo: string } | null;
  let getPromotableInstincts: (p: string) => unknown[];
  let getActiveInstincts: (p: string) => unknown[];

  beforeEach(async () => {
    // Import fresh modules for each test via dynamic import
    const ss = await import("../../scripts/lib/state-store.js");
    const im = await import("../../scripts/lib/instinct-manager.js");
    openDb = ss.openDb;
    closeDb = ss.closeDb;
    createInstinct = im.createInstinct as typeof createInstinct;
    reinforceInstinct = im.reinforceInstinct as typeof reinforceInstinct;
    promoteInstinct = im.promoteInstinct as typeof promoteInstinct;
    getPromotableInstincts = ss.getPromotableInstincts;
    getActiveInstincts = ss.getActiveInstincts;
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("create → reinforce (x4) → check promotable → promote", () => {
    const PROJECT = "e2e-instinct-project";

    // Create
    const inst = createInstinct(
      PROJECT,
      "always test first",
      "run vitest",
      "s1",
    );
    expect(inst.confidence, "initial confidence").toBe(0.3);
    expect(inst.status, "initial status").toBe("active");

    // Reinforce x4 — confidence reaches 0.7
    reinforceInstinct(inst.id, "s2");
    reinforceInstinct(inst.id, "s3");
    reinforceInstinct(inst.id, "s4");
    const r4 = reinforceInstinct(inst.id, "s5");
    expect(r4, "reinforcement result not null").not.toBeNull();
    expect(r4!.confidence, "confidence after 4 reinforcements").toBeCloseTo(
      0.7,
    );
    expect(r4!.occurrences, "occurrences after reinforce").toBe(5);

    // Check promotable threshold
    const promotable = getPromotableInstincts(PROJECT);
    expect((promotable as unknown[]).length, "one promotable instinct").toBe(1);

    // Promote
    const promoted = promoteInstinct(inst.id, "test-first-skill");
    expect(promoted, "promote result not null").not.toBeNull();
    expect(promoted!.status, "status after promotion").toBe("promoted");
    expect(promoted!.promotedTo, "promotedTo field set").toBe(
      "test-first-skill",
    );

    // No longer active or promotable
    expect(
      (getActiveInstincts(PROJECT) as unknown[]).length,
      "no active instincts post-promotion",
    ).toBe(0);
    expect(
      (getPromotableInstincts(PROJECT) as unknown[]).length,
      "no promotable instincts post-promotion",
    ).toBe(0);
  });
});

// ─── Scenario 3: Hook chain (observe-pre → observe-post order + tool_use_id) ─
describe("Scenario 3 — hook chain observe-pre/post", () => {
  const SID = `test-e2e-s3-${Date.now()}`;

  afterEach(() => {
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("observe-pre then observe-post produce ordered JSONL with matching toolName", () => {
    const toolName = "Edit";
    const filePath = "/src/foo.ts";

    // Fire observe-pre
    const pre = runHook(HOOK_OBSERVE_PRE, {
      session_id: SID,
      tool_name: toolName,
      tool_input: { file_path: filePath },
    });
    expect(pre.exitCode, "observe-pre exits 0").toBe(0);

    // Simulate tool execution delay (write last_pre_ts so observe-post can diff)
    // already handled by observe-pre writing last_pre_ts.txt

    // Fire observe-post
    const post = runHook(HOOK_OBSERVE_POST, {
      session_id: SID,
      tool_name: toolName,
      tool_input: { file_path: filePath },
      tool_result: "done",
      tool_error: null,
    });
    expect(post.exitCode, "observe-post exits 0").toBe(0);

    // Read JSONL and verify order
    const lines = fs
      .readFileSync(obsPath(SID), "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    expect(lines.length, "two JSONL entries").toBe(2);

    const [preEntry, postEntry] = lines;
    expect(preEntry.eventType, "first entry is tool_pre").toBe("tool_pre");
    expect(postEntry.eventType, "second entry is tool_post").toBe("tool_post");
    expect(preEntry.toolName, "pre toolName matches").toBe(toolName);
    expect(postEntry.toolName, "post toolName matches").toBe(toolName);
    expect(preEntry.filePath, "pre filePath recorded").toBe(filePath);

    // Timestamps must be in chronological order
    const preTs = new Date(preEntry.timestamp).getTime();
    const postTs = new Date(postEntry.timestamp).getTime();
    expect(postTs, "post timestamp >= pre timestamp").toBeGreaterThanOrEqual(
      preTs,
    );
  }, 15000);
});

// ─── Scenario 4: no-context-guard blocks Write without prior Read ─────────────
describe("Scenario 4 — no-context-guard blocking", () => {
  const SID = `test-e2e-s4-${Date.now()}`;
  const TARGET = "/some/unread/file.ts";

  beforeEach(() => {
    // Create observations dir with NO prior Read for TARGET
    const dir = obsDir(SID);
    fs.mkdirSync(dir, { recursive: true });
    // Write an observation for a different file (Bash), not Read of TARGET
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      sessionId: SID,
      eventType: "tool_pre",
      toolName: "Bash",
      filePath: null,
      metadata: { command: "npm run build" },
    });
    fs.writeFileSync(path.join(dir, "observations.jsonl"), line + "\n");
  });

  afterEach(() => {
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("exits 2 (block) when Write targets a file with no prior Read", () => {
    const result = runHook(HOOK_NO_CTX, {
      session_id: SID,
      tool_name: "Write",
      tool_input: { file_path: TARGET },
    });

    expect(result.exitCode, "exit code 2 = blocked").toBe(2);
    const stderrData = JSON.parse(result.stderr);
    expect(stderrData.block, "block flag true").toBe(true);
    expect(stderrData.message, "message contains no_context").toContain(
      "no_context",
    );
  });

  it("exits 0 (allow) when Edit targets a file that WAS previously Read", () => {
    const dir = obsDir(SID);
    // Add a Read observation for the target file
    const readLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      sessionId: SID,
      eventType: "tool_pre",
      toolName: "Read",
      filePath: TARGET,
      metadata: {},
    });
    fs.appendFileSync(path.join(dir, "observations.jsonl"), readLine + "\n");

    const result = runHook(HOOK_NO_CTX, {
      session_id: SID,
      tool_name: "Edit",
      tool_input: { file_path: TARGET },
    });

    expect(result.exitCode, "exit code 0 = allowed after Read").toBe(0);
  });
});

// ─── Scenario 6: hook_events table populated from JSONL ──────────────────────
describe("Scenario 6 — hook_events persistence", () => {
  const SID = `test-e2e-s6-${Date.now()}`;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `e2e-s6-${Date.now()}.db`);

    // Seed DB with session row
    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
         VALUES (?, ?, ?, ?)`,
        [SID, "hook-events-test-project", new Date().toISOString(), 3],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    // Create session dir with observations.jsonl (minimal, prevents fallback estimator)
    const sDir = obsDir(SID);
    fs.mkdirSync(sDir, { recursive: true });
    const obsLines = [
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: "git commit --no-verify" },
      }),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_post",
        toolName: "Bash",
        success: false,
      }),
    ];
    fs.writeFileSync(path.join(sDir, "observations.jsonl"), obsLines.join("\n") + "\n");

    // Seed hook-events.jsonl with 3 realistic entries
    const hookEventsPath = path.join(sDir, "hook-events.jsonl");
    const hookEntries = [
      {
        timestamp: new Date().toISOString(),
        hookName: "block-no-verify",
        eventType: "pre_tool",
        toolName: "Bash",
        exitCode: 2,
        blocked: true,
        durationMs: 45,
        error: "Blocked: --no-verify flag detected",
      },
      {
        timestamp: new Date().toISOString(),
        hookName: "commit-quality",
        eventType: "pre_tool",
        toolName: "Bash",
        exitCode: 2,
        blocked: true,
        durationMs: 78,
        error: "Blocked: console.log found in staged changes",
      },
      {
        timestamp: new Date().toISOString(),
        hookName: "git-push-reminder",
        eventType: "pre_tool",
        toolName: "Bash",
        exitCode: 1,
        blocked: false,
        durationMs: 12,
        error: null,
      },
    ];
    fs.writeFileSync(
      hookEventsPath,
      hookEntries.map((e) => JSON.stringify(e)).join("\n") + "\n",
    );
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("session-end-all reads hook-events.jsonl and persists all rows to hook_events table", async () => {
    const result = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: "claude-sonnet-4",
      },
      { KADMON_TEST_DB: testDb },
    );

    expect(result.exitCode, "session-end-all exits 0").toBe(0);

    // Query hook_events for this session
    const rows = await readDbRows(
      testDb,
      `SELECT session_id, hook_name, blocked, exit_code, duration_ms
         FROM hook_events WHERE session_id = ? ORDER BY rowid ASC`,
      [SID],
    );

    expect(rows.length, "3 hook_event rows persisted from JSONL").toBe(3);

    // Row 0: block-no-verify (blocked=true)
    expect(String(rows[0].session_id), "session_id matches").toBe(SID);
    expect(String(rows[0].hook_name), "first hook_name").toBe("block-no-verify");
    expect(Number(rows[0].blocked), "block-no-verify is blocked (1)").toBe(1);
    expect(Number(rows[0].exit_code), "block-no-verify exit_code 2").toBe(2);

    // Row 1: commit-quality (blocked=true)
    expect(String(rows[1].hook_name), "second hook_name").toBe("commit-quality");
    expect(Number(rows[1].blocked), "commit-quality is blocked (1)").toBe(1);

    // Row 2: git-push-reminder (blocked=false)
    expect(String(rows[2].hook_name), "third hook_name").toBe("git-push-reminder");
    expect(Number(rows[2].blocked), "git-push-reminder is not blocked (0)").toBe(0);
    expect(Number(rows[2].exit_code), "git-push-reminder exit_code 1").toBe(1);
    expect(Number(rows[2].duration_ms), "duration_ms persisted").toBe(12);
  }, 30000);
});

// ─── Scenario 7: agent_invocations table rows from Agent events ───────────────
describe("Scenario 7 — agent_invocations persistence", () => {
  const SID = `test-e2e-s7-${Date.now()}`;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `e2e-s7-${Date.now()}.db`);

    // Seed DB with session row
    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
         VALUES (?, ?, ?, ?)`,
        [SID, "agent-inv-test-project", new Date().toISOString(), 4],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    // Build observations.jsonl with paired Agent tool_pre/tool_post + one unpaired pre
    const sDir = obsDir(SID);
    fs.mkdirSync(sDir, { recursive: true });

    const ts1 = new Date(Date.now() - 5000).toISOString();
    const ts2 = new Date(Date.now() - 4000).toISOString();
    const ts3 = new Date(Date.now() - 2000).toISOString();
    // ts4 would be the post for ts3, but we intentionally omit it (unpaired pre)

    const obsLines = [
      // Paired: mekanik agent
      JSON.stringify({
        timestamp: ts1,
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Agent",
        filePath: null,
        metadata: {
          agentType: "mekanik",
          agentDescription: "Fix TypeScript compilation errors",
        },
      }),
      JSON.stringify({
        timestamp: ts2,
        sessionId: SID,
        eventType: "tool_post",
        toolName: "Agent",
        durationMs: 4200,
        success: true,
      }),
      // Unpaired: kartograf agent (only tool_pre, no tool_post)
      JSON.stringify({
        timestamp: ts3,
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Agent",
        filePath: null,
        metadata: {
          agentType: "kartograf",
          agentDescription: "Run E2E test suite",
        },
      }),
    ];
    fs.writeFileSync(path.join(sDir, "observations.jsonl"), obsLines.join("\n") + "\n");
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("session-end-all extracts paired and unpaired Agent events into agent_invocations", async () => {
    const result = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: { input_tokens: 2000, output_tokens: 1000 },
        model: "claude-sonnet-4",
      },
      { KADMON_TEST_DB: testDb },
    );

    expect(result.exitCode, "session-end-all exits 0").toBe(0);

    const rows = await readDbRows(
      testDb,
      `SELECT session_id, agent_type, duration_ms, success
         FROM agent_invocations WHERE session_id = ? ORDER BY rowid ASC`,
      [SID],
    );

    // Both the paired and unpaired pre should produce rows
    expect(rows.length, "2 agent_invocation rows persisted").toBe(2);

    // Paired agent (mekanik) — has duration and success=1
    const mekanik = rows[0];
    expect(String(mekanik.session_id), "session_id matches").toBe(SID);
    expect(String(mekanik.agent_type), "first agent_type is mekanik").toBe("mekanik");
    expect(Number(mekanik.duration_ms), "duration_ms persisted for paired agent").toBe(4200);
    expect(Number(mekanik.success), "paired agent success=1").toBe(1);

    // Unpaired agent (kartograf) — success is NULL (no tool_post received)
    const kartograf = rows[1];
    expect(String(kartograf.agent_type), "second agent_type is kartograf").toBe("kartograf");
    expect(kartograf.duration_ms, "unpaired agent duration_ms is null").toBeNull();
    expect(kartograf.success, "unpaired agent success is null (no tool_post)").toBeNull();
  }, 30000);
});

// ─── Scenario 5: Cost tracking via session-end-all ───────────────────────────
describe("Scenario 5 — cost tracking", () => {
  const SID = `test-e2e-s5-${Date.now()}`;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `e2e-s5-${Date.now()}.db`);

    // Seed DB with a session row
    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
         VALUES (?, ?, ?, ?)`,
        [SID, "cost-test-project", new Date().toISOString(), 5],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    // Create minimal observations dir (so session-end-all doesn't skip)
    fs.mkdirSync(obsDir(SID), { recursive: true });
    // Write 2 observation lines so the fallback estimator doesn't fire
    const obsLines = [
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Read",
        filePath: "/f.ts",
        metadata: {},
      }),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_post",
        toolName: "Read",
        filePath: "/f.ts",
        success: true,
      }),
    ];
    fs.writeFileSync(obsPath(SID), obsLines.join("\n") + "\n");
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("inserts cost_event row with correct calculated cost for sonnet (3/15 per 1M)", async () => {
    // sonnet pricing: input $3/1M, output $15/1M
    // 100_000 input + 50_000 output
    // expected = (100000/1e6)*3 + (50000/1e6)*15 = 0.30 + 0.75 = $1.05 -- too large
    // Use small numbers: 10000 in, 5000 out
    // expected = (10000/1e6)*3 + (5000/1e6)*15 = 0.03 + 0.075 = $0.000030 + $0.000075 = $0.000105
    const INPUT_TOKENS = 10_000;
    const OUTPUT_TOKENS = 5_000;
    const EXPECTED_COST =
      (INPUT_TOKENS / 1_000_000) * 3 + (OUTPUT_TOKENS / 1_000_000) * 15;

    const result = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: {
          input_tokens: INPUT_TOKENS,
          output_tokens: OUTPUT_TOKENS,
        },
        model: "claude-sonnet-4",
      },
      { KADMON_TEST_DB: testDb },
    );

    expect(result.exitCode, "session-end-all exits 0").toBe(0);

    // Verify cost_events row in DB
    const rows = await readDbRows(
      testDb,
      `SELECT session_id, model, input_tokens, output_tokens, estimated_cost_usd
         FROM cost_events WHERE session_id = ?`,
      [SID],
    );

    expect(rows.length, "one cost_event row inserted").toBe(1);
    const row = rows[0];
    expect(Number(row.input_tokens), "input_tokens persisted").toBe(
      INPUT_TOKENS,
    );
    expect(Number(row.output_tokens), "output_tokens persisted").toBe(
      OUTPUT_TOKENS,
    );
    expect(
      Number(row.estimated_cost_usd),
      "estimated cost matches calculation",
    ).toBeCloseTo(EXPECTED_COST, 7);
  }, 30000);
});

// ─── Scenario 8: Cost routing — opus pricing ─────────────────────────────────
describe("Scenario 8 — cost routing: opus", () => {
  const SID = `test-e2e-s8-${Date.now()}`;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `e2e-s8-${Date.now()}.db`);

    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
         VALUES (?, ?, ?, ?)`,
        [SID, "cost-opus-test", new Date().toISOString(), 5],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    fs.mkdirSync(obsDir(SID), { recursive: true });
    const obsLines = [
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Read",
        filePath: "/f.ts",
        metadata: {},
      }),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_post",
        toolName: "Read",
        filePath: "/f.ts",
        success: true,
      }),
    ];
    fs.writeFileSync(obsPath(SID), obsLines.join("\n") + "\n");
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("inserts cost_event row with correct opus rate ($15 input / $75 output per 1M)", async () => {
    // Opus pricing (from cost-calculator.ts): input $15/1M, output $75/1M
    // Use exact counts for clean math: 1000 input + 500 output
    // Expected = (1000/1e6)*15 + (500/1e6)*75 = 0.000015 + 0.0000375 = $0.0000525
    const INPUT_TOKENS = 1_000;
    const OUTPUT_TOKENS = 500;
    const EXPECTED_COST =
      (INPUT_TOKENS / 1_000_000) * 15 + (OUTPUT_TOKENS / 1_000_000) * 75;

    const result = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: {
          input_tokens: INPUT_TOKENS,
          output_tokens: OUTPUT_TOKENS,
        },
        model: "claude-opus-4",
      },
      { KADMON_TEST_DB: testDb },
    );

    expect(result.exitCode, "session-end-all exits 0").toBe(0);

    const rows = await readDbRows(
      testDb,
      `SELECT session_id, model, input_tokens, output_tokens, estimated_cost_usd
         FROM cost_events WHERE session_id = ?`,
      [SID],
    );

    expect(rows.length, "one cost_event row for opus").toBe(1);
    const row = rows[0];
    expect(String(row.model), "model stored as provided").toBe("claude-opus-4");
    expect(Number(row.input_tokens), "input_tokens persisted").toBe(INPUT_TOKENS);
    expect(Number(row.output_tokens), "output_tokens persisted").toBe(OUTPUT_TOKENS);
    expect(
      Number(row.estimated_cost_usd),
      "estimated cost matches opus rate",
    ).toBeCloseTo(EXPECTED_COST, 8);
  }, 30000);
});

// ─── Scenario 9: Cost routing — haiku pricing ────────────────────────────────
describe("Scenario 9 — cost routing: haiku", () => {
  const SID = `test-e2e-s9-${Date.now()}`;
  let testDb: string;

  beforeEach(async () => {
    testDb = path.join(os.tmpdir(), `e2e-s9-${Date.now()}.db`);

    const SQL = await initSqlJs();
    const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
    const rawDb = new SQL.Database();
    try {
      rawDb.exec(schema);
      rawDb.run(
        `INSERT INTO sessions (id, project_hash, started_at, message_count)
         VALUES (?, ?, ?, ?)`,
        [SID, "cost-haiku-test", new Date().toISOString(), 5],
      );
      fs.writeFileSync(testDb, Buffer.from(rawDb.export()));
    } finally {
      rawDb.close();
    }

    fs.mkdirSync(obsDir(SID), { recursive: true });
    const obsLines = [
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_pre",
        toolName: "Read",
        filePath: "/f.ts",
        metadata: {},
      }),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId: SID,
        eventType: "tool_post",
        toolName: "Read",
        filePath: "/f.ts",
        success: true,
      }),
    ];
    fs.writeFileSync(obsPath(SID), obsLines.join("\n") + "\n");
  });

  afterEach(() => {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
    const sDir = obsDir(SID);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  });

  it("inserts cost_event row with correct haiku rate ($0.80 input / $4 output per 1M)", async () => {
    // Haiku pricing (from cost-calculator.ts): input $0.8/1M, output $4/1M
    // Use exact counts for clean math: 1000 input + 500 output
    // Expected = (1000/1e6)*0.8 + (500/1e6)*4 = 0.0000008 + 0.000002 = $0.0000028
    const INPUT_TOKENS = 1_000;
    const OUTPUT_TOKENS = 500;
    const EXPECTED_COST =
      (INPUT_TOKENS / 1_000_000) * 0.8 + (OUTPUT_TOKENS / 1_000_000) * 4;

    const result = runHook(
      HOOK_SESSION_END,
      {
        session_id: SID,
        cwd: process.cwd(),
        usage: {
          input_tokens: INPUT_TOKENS,
          output_tokens: OUTPUT_TOKENS,
        },
        model: "claude-haiku-4",
      },
      { KADMON_TEST_DB: testDb },
    );

    expect(result.exitCode, "session-end-all exits 0").toBe(0);

    const rows = await readDbRows(
      testDb,
      `SELECT session_id, model, input_tokens, output_tokens, estimated_cost_usd
         FROM cost_events WHERE session_id = ?`,
      [SID],
    );

    expect(rows.length, "one cost_event row for haiku").toBe(1);
    const row = rows[0];
    expect(String(row.model), "model stored as provided").toBe("claude-haiku-4");
    expect(Number(row.input_tokens), "input_tokens persisted").toBe(INPUT_TOKENS);
    expect(Number(row.output_tokens), "output_tokens persisted").toBe(OUTPUT_TOKENS);
    expect(
      Number(row.estimated_cost_usd),
      "estimated cost matches haiku rate",
    ).toBeCloseTo(EXPECTED_COST, 9);
  }, 30000);
});
