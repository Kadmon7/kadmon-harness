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
    // Generate 20 observation lines (10 tool_pre + 10 tool_post)
    writeObservations(generateObsLines(20));

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // 20 lines with Read→Edit→Write sequences trigger pattern definitions
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

  it("cleans observation files when messageCount >= 10", async () => {
    // 24 lines => 12 tool_pre (messageCount=12) => triggers cleanup
    writeObservations(generateObsLines(24));
    fs.writeFileSync(path.join(obsDir, "tool_count.txt"), "24");

    runHook({ session_id: sessionId, cwd: process.cwd() });

    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(false);
    expect(fs.existsSync(path.join(obsDir, "tool_count.txt"))).toBe(false);
    // Marker should still exist (written before cleanup)
    expect(fs.existsSync(path.join(obsDir, "clean-exit.marker"))).toBe(true);
  });
});
