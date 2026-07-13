import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
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

// AUD-30 note: execFileSync only exposes stderr via the thrown error object
// on a NON-ZERO exit — on success (this hook's contract is always exit 0,
// per rules/common/hooks.md "NEVER crash — always exit(0)") stderr is
// silently discarded. Use spawnSync instead, which captures stdout/stderr
// into the result object regardless of exit code, so warn-only diagnostics
// (e.g. logHookError's stderr redirect in test env) are observable.
function runHook(input: object): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const env = { ...process.env, KADMON_TEST_DB: testDb };
  const result = spawnSync("node", [HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 15000,
    env,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
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

  // AUD-15 (2026-07-12 audit) — session_id from stdin must be validated
  // against /^[a-zA-Z0-9_-]+$/ before being used to build a filesystem path.
  // Regression test: plant a decoy observations.jsonl OUTSIDE the kadmon
  // sandbox at the location a "../" session_id resolves to. Pre-fix, this
  // hook did `path.join(os.tmpdir(), "kadmon", sid)` with no validation and
  // proceeded through all persistence phases regardless (producing a
  // non-empty "not found in DB" message). Post-fix, the malformed session_id
  // is rejected by safeSessionDir() and the hook exits immediately — same
  // contract as the "no session_id" case above (empty stdout, exit 0).
  it("does not read observations from a path outside the kadmon sandbox for a traversal session_id", () => {
    const escapedName = `evil-sea-${Date.now()}`;
    const escapedDir = path.join(os.tmpdir(), escapedName);
    fs.mkdirSync(escapedDir, { recursive: true });
    fs.writeFileSync(
      path.join(escapedDir, "observations.jsonl"),
      JSON.stringify({ eventType: "tool_pre", toolName: "Read", filePath: "decoy.ts" }) + "\n",
    );
    try {
      const r = runHook({ session_id: `../${escapedName}`, cwd: process.cwd() });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toBe("");
    } finally {
      fs.rmSync(escapedDir, { recursive: true, force: true });
    }
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

  // --- AUD-06 (2026-07-12 audit §2 Cluster B): parallel-agent pairing ---
  // Global LIFO pop misattributes duration/success/error when parallel agents
  // finish out of order. Pairing must correlate by toolUseId when present,
  // else oldest pending pre of the SAME agentType, with LIFO only as fallback.

  function makeAgentPre(
    agentType: string,
    ts: string,
    toolUseId?: string,
  ): string {
    return JSON.stringify({
      timestamp: ts,
      sessionId,
      eventType: "tool_pre",
      toolName: "Agent",
      filePath: "",
      ...(toolUseId ? { toolUseId } : {}),
      metadata: { agentType, agentDescription: `${agentType} task` },
    });
  }

  function makeAgentPost(
    agentType: string | null,
    ts: string,
    durationMs: number,
    success: boolean,
    opts?: { toolUseId?: string; error?: string },
  ): string {
    return JSON.stringify({
      timestamp: ts,
      sessionId,
      eventType: "tool_post",
      toolName: "Agent",
      filePath: "",
      durationMs,
      success,
      ...(opts?.error ? { error: opts.error } : {}),
      ...(opts?.toolUseId ? { toolUseId: opts.toolUseId } : {}),
      metadata: agentType ? { agentType } : {},
    });
  }

  async function readAgentRows(): Promise<Record<string, unknown>[]> {
    const db = await readDb();
    const stmt = db.prepare(
      "SELECT agent_type, duration_ms, success, error, timestamp FROM agent_invocations WHERE session_id = ? ORDER BY timestamp ASC",
    );
    stmt.bind([sessionId]);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    db.close();
    return rows;
  }

  it("pairs parallel agents of distinct types by agentType, not global LIFO", async () => {
    // feniks starts, then spektr starts; posts arrive in START order
    // (feniks first). Global LIFO would pop spektr for the feniks post.
    const t0 = new Date("2026-07-12T10:00:00.000Z").toISOString();
    const t1 = new Date("2026-07-12T10:00:01.000Z").toISOString();
    const t2 = new Date("2026-07-12T10:00:05.000Z").toISOString();
    const t3 = new Date("2026-07-12T10:00:09.000Z").toISOString();

    writeObservations([
      makeAgentPre("feniks", t0),
      makeAgentPre("spektr", t1),
      makeAgentPost("feniks", t2, 5000, false, { error: "feniks boom" }),
      makeAgentPost("spektr", t3, 8000, true),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const rows = await readAgentRows();
    expect(rows).toHaveLength(2);

    const feniks = rows.find((row) => row.agent_type === "feniks");
    const spektr = rows.find((row) => row.agent_type === "spektr");
    expect(feniks).toBeDefined();
    expect(spektr).toBeDefined();

    expect(Number(feniks?.duration_ms)).toBe(5000);
    expect(Number(feniks?.success)).toBe(0);
    expect(feniks?.error).toBe("feniks boom");

    expect(Number(spektr?.duration_ms)).toBe(8000);
    expect(Number(spektr?.success)).toBe(1);
    expect(spektr?.error).toBeNull();
  });

  it("pairs same-type parallel agents by toolUseId when posts arrive in start order", async () => {
    // Two kody agents; posts arrive in START order. Global LIFO would pop the
    // SECOND pre for the FIRST post. toolUseId must disambiguate.
    const t0 = new Date("2026-07-12T11:00:00.000Z").toISOString();
    const t1 = new Date("2026-07-12T11:00:01.000Z").toISOString();
    const t2 = new Date("2026-07-12T11:00:04.000Z").toISOString();
    const t3 = new Date("2026-07-12T11:00:08.000Z").toISOString();

    writeObservations([
      makeAgentPre("kody", t0, "toolu_1"),
      makeAgentPre("kody", t1, "toolu_2"),
      makeAgentPost("kody", t2, 4000, false, {
        toolUseId: "toolu_1",
        error: "kody-1 failed",
      }),
      makeAgentPost("kody", t3, 7000, true, { toolUseId: "toolu_2" }),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const rows = await readAgentRows();
    expect(rows).toHaveLength(2);

    // Row timestamps come from the PRE event: toolu_1 → t0, toolu_2 → t1
    const first = rows.find((row) => row.timestamp === t0);
    const second = rows.find((row) => row.timestamp === t1);
    expect(Number(first?.duration_ms)).toBe(4000);
    expect(Number(first?.success)).toBe(0);
    expect(first?.error).toBe("kody-1 failed");
    expect(Number(second?.duration_ms)).toBe(7000);
    expect(Number(second?.success)).toBe(1);
  });

  it("prefers toolUseId over same-type FIFO when posts arrive out of start order", async () => {
    // Same-type FIFO alone would hand the first post (toolu_2) to the OLDEST
    // kody pre (toolu_1). The id match must win over type-based matching.
    const t0 = new Date("2026-07-12T12:00:00.000Z").toISOString();
    const t1 = new Date("2026-07-12T12:00:01.000Z").toISOString();
    const t2 = new Date("2026-07-12T12:00:03.000Z").toISOString();
    const t3 = new Date("2026-07-12T12:00:09.000Z").toISOString();

    writeObservations([
      makeAgentPre("kody", t0, "toolu_1"),
      makeAgentPre("kody", t1, "toolu_2"),
      makeAgentPost("kody", t2, 2000, true, { toolUseId: "toolu_2" }),
      makeAgentPost("kody", t3, 9000, false, {
        toolUseId: "toolu_1",
        error: "slow kody failed",
      }),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const rows = await readAgentRows();
    expect(rows).toHaveLength(2);

    const first = rows.find((row) => row.timestamp === t0); // toolu_1
    const second = rows.find((row) => row.timestamp === t1); // toolu_2
    expect(Number(first?.duration_ms)).toBe(9000);
    expect(Number(first?.success)).toBe(0);
    expect(first?.error).toBe("slow kody failed");
    expect(Number(second?.duration_ms)).toBe(2000);
    expect(Number(second?.success)).toBe(1);
  });

  it("falls back to LIFO for legacy posts without agentType or toolUseId", async () => {
    // Legacy observations (pre-AUD-06 format): post carries neither
    // toolUseId nor metadata.agentType — must still pair (old behavior).
    const t0 = new Date("2026-07-12T13:00:00.000Z").toISOString();
    const t1 = new Date("2026-07-12T13:00:06.000Z").toISOString();

    writeObservations([
      makeAgentPre("orakle", t0),
      makeAgentPost(null, t1, 6000, true),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const rows = await readAgentRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].agent_type).toBe("orakle");
    expect(Number(rows[0].duration_ms)).toBe(6000);
    expect(Number(rows[0].success)).toBe(1);
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

  // --- AUD-29 item 1 (Wave 3 audit) — empty-commit guard proxy ---
  // Phase 1c only emits the "DB: ..." output line when hookCount > 0 ||
  // agentCount > 0 (see session-end-all.js). Its absence here is a
  // behavioral proxy for "the batch transaction had nothing to insert" —
  // the disk-write-skip mechanism itself is proven directly at the
  // state-store level (tests/lib/state-store.test.ts "Phase 1c pattern").
  it("does not emit the 'DB: ... persisted' output line when there are zero hook events and zero agent invocations", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);
    // No hook-events.jsonl written, no Agent tool_pre/tool_post pairs present.

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain("DB:");
  });

  // --- AUD-29 item 2 (Wave 3 audit) — agent_invocations natural key ---
  // Two parallel kody agents that both START in the exact same millisecond.
  // Pre-fix, the natural key (session_id, agent_type, timestamp) collided
  // and ON CONFLICT DO NOTHING silently dropped the second row. Fixed by
  // extending the natural key with COALESCE(tool_use_id, '').
  it("retains both rows for parallel same-type agents whose pre timestamps collide to the exact same millisecond", async () => {
    const tSame = new Date("2026-07-13T09:00:00.000Z").toISOString();
    const tPost1 = new Date("2026-07-13T09:00:04.000Z").toISOString();
    const tPost2 = new Date("2026-07-13T09:00:05.000Z").toISOString();

    writeObservations([
      makeAgentPre("kody", tSame, "toolu_p1"),
      makeAgentPre("kody", tSame, "toolu_p2"),
      makeAgentPost("kody", tPost1, 4000, true, { toolUseId: "toolu_p1" }),
      makeAgentPost("kody", tPost2, 5000, true, { toolUseId: "toolu_p2" }),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const rows = await readAgentRows();
    const sameTimestampRows = rows.filter((row) => row.timestamp === tSame);
    expect(sameTimestampRows).toHaveLength(2);
  });

  // --- AUD-30 sub-item (Wave 3 audit) — anomalous-pairing branch coverage ---
  // When a toolUseId-bearing Agent post cannot be resolved by id AND has no
  // agentType metadata to fall back on, takeMatchingAgentPre logs via
  // logHookError before falling back to LIFO pop. In test env (KADMON_TEST_DB
  // set), logHookError redirects to stderr as JSON — see hook-logger.js.
  it("logs an anomalous-pairing error via logHookError when a toolUseId-bearing Agent post cannot be resolved to any pending pre", async () => {
    const t0 = new Date("2026-07-13T08:00:00.000Z").toISOString();
    const t1 = new Date("2026-07-13T08:00:03.000Z").toISOString();

    writeObservations([
      makeAgentPre("feniks", t0), // no toolUseId
      // Ghost toolUseId matches no pending pre; no agentType metadata either
      // — both lookups in takeMatchingAgentPre fail, triggering the log.
      makeAgentPost(null, t1, 3000, true, { toolUseId: "toolu_ghost" }),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const errorLines: Array<Record<string, unknown>> = r.stderr
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is Record<string, unknown> => entry !== null);

    const pairingError = errorLines.find(
      (entry) =>
        entry.hook === "session-end-all" &&
        typeof entry.error === "string" &&
        entry.error.includes("agent pairing fallback"),
    );
    expect(pairingError).toBeDefined();
    expect(pairingError?.error).toContain("toolUseId=toolu_ghost");
    expect(
      (pairingError?.context as Record<string, unknown> | undefined)?.phase,
    ).toBe("agent-pairing");

    // The LIFO fallback still pairs SOMETHING despite the anomaly — one row
    // persisted (the logic itself is unchanged, only newly covered by test).
    const rows = await readAgentRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].agent_type).toBe("feniks");
  });
});
