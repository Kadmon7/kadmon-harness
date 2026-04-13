import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

const HOOK = path.resolve(".claude/hooks/scripts/session-end-all.js");
const SCHEMA_PATH = path.resolve("scripts/lib/schema.sql");

let sessionId: string;
let obsDir: string;
let testDb: string;
let transcriptFile: string | null = null;

function runHook(input: object): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const env = { ...process.env, KADMON_TEST_DB: testDb };
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
      env,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout: string; stderr: string; status: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.status ?? 1,
    };
  }
}

function makeObsLine(
  eventType: string,
  toolName: string,
  filePath?: string,
  metadata?: Record<string, unknown>,
): string {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    sessionId,
    eventType,
    toolName,
    filePath: filePath ?? "",
    metadata: metadata ?? {},
  });
}

function writeObservations(lines: string[]): void {
  fs.mkdirSync(obsDir, { recursive: true });
  fs.writeFileSync(
    path.join(obsDir, "observations.jsonl"),
    lines.join("\n") + "\n",
  );
}

/** Generate N observation lines alternating tool_pre/tool_post */
function generateObsLines(count: number): string[] {
  const tools = ["Read", "Edit", "Write", "Bash", "Grep"];
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const isPreEvent = i % 2 === 0;
    const tool = tools[Math.floor(i / 2) % tools.length];
    lines.push(
      makeObsLine(
        isPreEvent ? "tool_pre" : "tool_post",
        tool,
        isPreEvent ? `/test/file${i % 5}.ts` : undefined,
        isPreEvent && tool === "Bash"
          ? { command: "npx vitest run" }
          : undefined,
      ),
    );
  }
  return lines;
}

/**
 * Generate lines that reliably trigger the file_sequence pattern
 * "Build + test after editing types.ts" (ADR-006 pattern A). Each iteration
 * adds Edit scripts/lib/types.ts followed by Bash vitest (4 lines).
 */
function generatePatternALines(pairs: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < pairs; i++) {
    lines.push(
      makeObsLine("tool_pre", "Edit", "scripts/lib/types.ts"),
      makeObsLine("tool_post", "Edit"),
      makeObsLine("tool_pre", "Bash", "", { command: "vitest" }),
      makeObsLine("tool_post", "Bash"),
    );
  }
  return lines;
}

async function seedDb(): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  for (const stmt of schema.split(";").filter((s) => s.trim())) {
    db.run(stmt + ";");
  }
  db.run(
    "INSERT INTO sessions (id, project_hash, started_at, branch, compaction_count, message_count) VALUES (?, ?, ?, ?, ?, ?)",
    [sessionId, "test-hash-1234", new Date().toISOString(), "main", 0, 0],
  );
  fs.writeFileSync(testDb, Buffer.from(db.export()));
  db.close();
}

async function readDb(): Promise<
  InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>
> {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(testDb);
  return new SQL.Database(data);
}

describe("session-end-all", () => {
  beforeEach(async () => {
    const ts = Date.now() + Math.random().toString(36).slice(2, 6);
    sessionId = `test-sea-${ts}`;
    obsDir = path.join(os.tmpdir(), "kadmon", sessionId);
    testDb = path.join(os.tmpdir(), `kadmon-sea-test-${ts}.db`);
    await seedDb();
  });

  afterEach(() => {
    fs.rmSync(obsDir, { recursive: true, force: true });
    try {
      fs.unlinkSync(testDb);
    } catch {
      /* may not exist */
    }
    if (transcriptFile !== null) {
      try {
        fs.unlinkSync(transcriptFile);
      } catch {
        /* may not exist */
      }
      transcriptFile = null;
    }
  });

  it("exits cleanly with no session_id", () => {
    const r = runHook({});
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("");
  });

  it("persists session with ended_at and observation metadata", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
      makeObsLine("tool_pre", "Edit", "/test/a.ts"),
      makeObsLine("tool_post", "Edit"),
      makeObsLine("tool_pre", "Write", "/test/b.ts"),
      makeObsLine("tool_post", "Write"),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Session persisted");

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT ended_at, files_modified, tools_used, message_count FROM sessions WHERE id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(row.ended_at).toBeTruthy();
    const files = JSON.parse(String(row.files_modified));
    expect(files).toContain("/test/a.ts");
    expect(files).toContain("/test/b.ts");
    expect(Number(row.message_count)).toBe(3);
  });

  it("evaluates patterns with 10+ observations", async () => {
    // 5 pairs of Edit types.ts + Bash vitest = 20 lines, well above minLines
    // and reliably triggers pattern A "Build + test after editing types.ts".
    writeObservations(generatePatternALines(5));

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Pattern A should trigger and create at least one instinct
    const db = await readDb();
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.cnt)).toBeGreaterThan(0);
  });

  it("skips pattern evaluation with fewer than 10 observations", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const db = await readDb();
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.cnt)).toBe(0);
  });

  it("tracks cost from direct token values in stdin", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      model: "opus",
      usage: { input_tokens: 1000, output_tokens: 500 },
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");
    expect(r.stdout).toContain("opus");

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT model, input_tokens, output_tokens, estimated_cost_usd FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();

    expect(row.model).toBe("opus");
    expect(Number(row.input_tokens)).toBe(1000);
    expect(Number(row.output_tokens)).toBe(500);
    expect(Number(row.estimated_cost_usd)).toBeGreaterThan(0);

    // Verify session totals were updated
    const sesStmt = db.prepare(
      "SELECT total_input_tokens, total_output_tokens, estimated_cost_usd FROM sessions WHERE id = ?",
    );
    sesStmt.bind([sessionId]);
    expect(sesStmt.step()).toBe(true);
    const sesRow = sesStmt.getAsObject();
    sesStmt.free();
    db.close();

    expect(Number(sesRow.total_input_tokens)).toBe(1000);
    expect(Number(sesRow.total_output_tokens)).toBe(500);
    expect(Number(sesRow.estimated_cost_usd)).toBeGreaterThan(0);
  });

  it("estimates cost from observations when no tokens provided", async () => {
    // 10 lines => 5 tool calls => 5*1200=6000 input, 5*600=3000 output
    writeObservations(generateObsLines(10));

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBeGreaterThan(0);
    expect(Number(row.output_tokens)).toBeGreaterThan(0);
  });

  it("writes clean-exit marker file", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    runHook({ session_id: sessionId, cwd: process.cwd() });

    const markerPath = path.join(obsDir, "clean-exit.marker");
    expect(fs.existsSync(markerPath)).toBe(true);

    const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
    expect(marker.sessionId).toBe(sessionId);
    expect(marker.exitedAt).toBeTruthy();
  });

  it("cleans observation files when messageCount >= 20", async () => {
    // 44 lines => 22 tool_pre (messageCount=22) => triggers cleanup at >= 20
    writeObservations(generateObsLines(44));
    fs.writeFileSync(path.join(obsDir, "tool_count.txt"), "44");

    runHook({ session_id: sessionId, cwd: process.cwd() });

    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(false);
    expect(fs.existsSync(path.join(obsDir, "tool_count.txt"))).toBe(false);
    // Marker should still exist (written before cleanup)
    expect(fs.existsSync(path.join(obsDir, "clean-exit.marker"))).toBe(true);
  });

  it("estimates cost from transcript when no direct tokens provided", async () => {
    // Arrange: write minimal observations so the hook has a valid session
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    // Create a temp JSONL transcript with mixed user/assistant entries
    transcriptFile = path.join(os.tmpdir(), `transcript-${Date.now()}.jsonl`);
    const transcriptLines = [
      JSON.stringify({ role: "user", content: "Hello, can you help me?" }),
      JSON.stringify({
        role: "assistant",
        content: "Sure, I can help you with that task.",
      }),
      JSON.stringify({
        role: "user",
        content: "Please fix the bug in auth.ts",
      }),
      JSON.stringify({
        role: "assistant",
        content: "I'll fix that for you now.",
      }),
    ];
    fs.writeFileSync(transcriptFile, transcriptLines.join("\n") + "\n");

    // Act: provide transcript_path but NO usage or direct token fields
    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      transcript_path: transcriptFile,
    });

    // Assert: hook exits clean and reports a Cost line
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    // Assert: cost_events row has tokens derived from the transcript
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBeGreaterThan(0);
    expect(Number(row.output_tokens)).toBeGreaterThan(0);
  });

  it("uses code-aware ratio (3.0 chars/token) for code-heavy transcript", async () => {
    // Arrange
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    // Build a code-heavy transcript: lots of {}[]();= chars to push codeRatio > 0.05
    const codeUser = "function foo() { return bar(); }";
    const codeAssistant =
      "export const x = [1, 2, 3]; const y = {a: 1}; if (x) { y(); }";
    transcriptFile = path.join(
      os.tmpdir(),
      `transcript-code-${Date.now()}.jsonl`,
    );
    const transcriptLines = [
      JSON.stringify({ role: "user", content: codeUser }),
      JSON.stringify({ role: "assistant", content: codeAssistant }),
    ];
    fs.writeFileSync(transcriptFile, transcriptLines.join("\n") + "\n");

    // Compute expected tokens using code ratio path (charsPerToken = 3.0)
    const expectedInputTokens = Math.ceil(codeUser.length / 3.0);
    const expectedOutputTokens = Math.ceil(codeAssistant.length / 3.0);

    // Act
    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      transcript_path: transcriptFile,
    });

    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    // Assert: tokens match the 3.0 chars/token formula (code-aware path)
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBe(expectedInputTokens);
    expect(Number(row.output_tokens)).toBe(expectedOutputTokens);
  });

  it("falls through to observation estimate when transcript file is empty", async () => {
    // Arrange: 10 obs lines => 5 tool calls => obs fallback produces tokens
    writeObservations(generateObsLines(10));

    // Create an empty transcript file (whitespace only — estimateTokensFromTranscript returns
    // {inputTokens:0, outputTokens:0} which are falsy, so fallback chain continues to obs)
    transcriptFile = path.join(
      os.tmpdir(),
      `transcript-empty-${Date.now()}.jsonl`,
    );
    fs.writeFileSync(transcriptFile, "   \n   \n");

    // Act: provide transcript_path (empty file) but NO usage tokens
    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      transcript_path: transcriptFile,
    });

    // Assert: hook exits clean and reports Cost via obs fallback
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    // Assert: cost_events has tokens > 0 (from observation-based estimate, not empty transcript)
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBeGreaterThan(0);
    expect(Number(row.output_tokens)).toBeGreaterThan(0);
  });

  it("falls through when transcript has only malformed lines", async () => {
    // Arrange: 10 obs lines for obs fallback
    writeObservations(generateObsLines(10));

    // Create transcript with non-JSON content — all lines fail JSON.parse, so
    // inputChars and outputChars stay 0 => {inputTokens:0, outputTokens:0} => falsy => falls through
    transcriptFile = path.join(
      os.tmpdir(),
      `transcript-bad-${Date.now()}.jsonl`,
    );
    fs.writeFileSync(
      transcriptFile,
      "not json\nalso not json\njust plain text\n",
    );

    // Act: provide the malformed transcript, NO usage tokens
    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      transcript_path: transcriptFile,
    });

    // Assert: hook exits clean (errors in malformed lines are swallowed) and reports Cost
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    // Assert: cost_events has tokens > 0 (obs fallback, not malformed transcript)
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBeGreaterThan(0);
    expect(Number(row.output_tokens)).toBeGreaterThan(0);
  });

  it("falls back to observation estimate when transcript_path file does not exist", async () => {
    // Arrange: write enough observations for the obs-based fallback to produce tokens
    writeObservations(generateObsLines(10));

    // Act: provide a non-existent transcript path — estimateTokensFromTranscript returns null
    const r = runHook({
      session_id: sessionId,
      cwd: process.cwd(),
      transcript_path: "/nonexistent/path/transcript.jsonl",
    });

    // Assert: hook exits clean and still reports a Cost line via obs fallback
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Cost:");

    // Assert: cost_events has tokens > 0 (from observation-based estimate)
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT input_tokens, output_tokens FROM cost_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.input_tokens)).toBeGreaterThan(0);
    expect(Number(row.output_tokens)).toBeGreaterThan(0);
  });

  // --- Gap #14: Hook Event Extraction ---

  it("persists hook events from hook-events.jsonl to database", async () => {
    // Arrange: minimal observations so the session persists
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    // Write hook-events.jsonl with 2 hook event entries
    const hookEventsPath = path.join(obsDir, "hook-events.jsonl");
    const hookEvents = [
      {
        hookName: "config-protection",
        eventType: "pre_tool",
        toolName: "Edit",
        exitCode: 2,
        blocked: true,
        error: "Disabling strict",
        timestamp: "2026-04-01T10:00:00Z",
      },
      {
        hookName: "no-context-guard",
        eventType: "pre_tool",
        toolName: "Write",
        exitCode: 2,
        blocked: true,
        error: "no_context: src/foo.ts",
        timestamp: "2026-04-01T10:01:00Z",
      },
    ];
    fs.writeFileSync(
      hookEventsPath,
      hookEvents.map((e) => JSON.stringify(e)).join("\n") + "\n",
    );

    // Act
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Assert: both hook events are in the DB
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT hook_name, blocked FROM hook_events WHERE session_id = ? ORDER BY timestamp ASC",
    );
    stmt.bind([sessionId]);

    expect(stmt.step()).toBe(true);
    const row1 = stmt.getAsObject();
    expect(row1.hook_name).toBe("config-protection");
    expect(Number(row1.blocked)).toBe(1);

    expect(stmt.step()).toBe(true);
    const row2 = stmt.getAsObject();
    expect(row2.hook_name).toBe("no-context-guard");
    expect(Number(row2.blocked)).toBe(1);

    expect(stmt.step()).toBe(false); // exactly 2 rows
    stmt.free();
    db.close();
  });

  it("handles missing hook-events.jsonl gracefully — no hook_events rows inserted", async () => {
    // Arrange: observations only, NO hook-events.jsonl
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);
    // Ensure no hook-events.jsonl exists
    const hookEventsPath = path.join(obsDir, "hook-events.jsonl");
    if (fs.existsSync(hookEventsPath)) fs.unlinkSync(hookEventsPath);

    // Act
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });

    // Assert: exits 0, no crash
    expect(r.exitCode).toBe(0);

    // Assert: zero hook_events rows for this session
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT COUNT(*) as cnt FROM hook_events WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.cnt)).toBe(0);
  });

  // --- Gap #15: Agent Invocation Extraction ---

  it("extracts paired agent invocations from observations and persists to database", async () => {
    // Arrange: observations include a matched Agent tool_pre / tool_post pair
    const agentPreTs = new Date().toISOString();
    const agentPostTs = new Date(Date.now() + 5000).toISOString();

    const lines = [
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
      // Agent pre — metadata carries agentType and agentDescription
      JSON.stringify({
        timestamp: agentPreTs,
        sessionId,
        eventType: "tool_pre",
        toolName: "Agent",
        filePath: "",
        metadata: {
          agentType: "feniks",
          agentDescription: "TDD guide",
        },
      }),
      // Agent post — paired with the pre above
      JSON.stringify({
        timestamp: agentPostTs,
        sessionId,
        eventType: "tool_post",
        toolName: "Agent",
        filePath: "",
        durationMs: 5000,
        success: true,
        metadata: {},
      }),
    ];
    writeObservations(lines);

    // Act
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Assert: one agent_invocations row with correct fields
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT agent_type, description, duration_ms, success FROM agent_invocations WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(row.agent_type).toBe("feniks");
    expect(row.description).toBe("TDD guide");
    expect(Number(row.duration_ms)).toBe(5000);
    expect(Number(row.success)).toBe(1); // SQLite stores boolean as 1/0
  });

  it("persists unmatched agent pre events with success = null", async () => {
    // Arrange: Agent tool_pre with NO matching tool_post
    const agentPreTs = new Date().toISOString();

    const lines = [
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
      // Agent pre only — no post
      JSON.stringify({
        timestamp: agentPreTs,
        sessionId,
        eventType: "tool_pre",
        toolName: "Agent",
        filePath: "",
        metadata: {
          agentType: "spektr",
          agentDescription: "Security scan",
        },
      }),
    ];
    writeObservations(lines);

    // Act
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Assert: one agent_invocations row, success IS NULL (unmatched pre)
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT agent_type, description, duration_ms, success FROM agent_invocations WHERE session_id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(row.agent_type).toBe("spektr");
    expect(row.description).toBe("Security scan");
    expect(row.duration_ms).toBeNull();
    expect(row.success).toBeNull();
  });
});
