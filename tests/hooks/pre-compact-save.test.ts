import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

const HOOK = path.resolve(".claude/hooks/scripts/pre-compact-save.js");
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

async function seedDb(): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  for (const stmt of schema.split(";").filter((s) => s.trim())) {
    db.run(stmt + ";");
  }
  db.run(
    "INSERT INTO sessions (id, project_hash, started_at, branch, compaction_count) VALUES (?, ?, ?, ?, ?)",
    [sessionId, "test-hash-1234", new Date().toISOString(), "main", 0],
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

describe("pre-compact-save", () => {
  beforeEach(async () => {
    const ts = Date.now() + Math.random().toString(36).slice(2, 6);
    sessionId = `test-pcs-${ts}`;
    obsDir = path.join(os.tmpdir(), "kadmon", sessionId);
    testDb = path.join(os.tmpdir(), `kadmon-pcs-test-${ts}.db`);
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

  it("increments compactionCount in database", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Session state saved");

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT compaction_count FROM sessions WHERE id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(row.compaction_count).toBe(1);
  });

  it("persists summary and files from observations", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/file1.ts"),
      makeObsLine("tool_post", "Read"),
      makeObsLine("tool_pre", "Edit", "/test/file1.ts"),
      makeObsLine("tool_post", "Edit"),
      makeObsLine("tool_pre", "Write", "/test/file2.ts"),
      makeObsLine("tool_post", "Write"),
    ]);

    runHook({ session_id: sessionId, cwd: process.cwd() });

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT files_modified, tools_used, message_count, summary FROM sessions WHERE id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    const files = JSON.parse(String(row.files_modified));
    const tools = JSON.parse(String(row.tools_used));
    expect(files).toContain("/test/file1.ts");
    expect(files).toContain("/test/file2.ts");
    expect(tools).toContain("Read");
    expect(tools).toContain("Edit");
    expect(tools).toContain("Write");
    expect(Number(row.message_count)).toBe(3);
    expect(row.summary).toBeTruthy();
  });

  it("skips pattern evaluation with fewer than 10 observations", async () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
      makeObsLine("tool_pre", "Edit", "/test/a.ts"),
      makeObsLine("tool_post", "Edit"),
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

  it("resets tool_count.txt to zero", async () => {
    fs.mkdirSync(obsDir, { recursive: true });
    fs.writeFileSync(path.join(obsDir, "tool_count.txt"), "42");
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    runHook({ session_id: sessionId, cwd: process.cwd() });

    const countFile = path.join(obsDir, "tool_count.txt");
    expect(fs.existsSync(countFile)).toBe(true);
    expect(fs.readFileSync(countFile, "utf8")).toBe("0");
  });

  it("exits cleanly when observations directory is missing", () => {
    // Don't create obsDir — hook should handle gracefully
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Session state saved");
  });

  it("writes daily log entry during compaction", async () => {
    // Arrange: write observations with Read/Edit/Write activity
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/file1.ts"),
      makeObsLine("tool_post", "Read"),
      makeObsLine("tool_pre", "Edit", "/test/file1.ts"),
      makeObsLine("tool_post", "Edit"),
      makeObsLine("tool_pre", "Write", "/test/file2.ts"),
      makeObsLine("tool_post", "Write"),
    ]);

    // Act: run the hook
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Resolve the daily log path — same formula as daily-log.js
    const today = new Date().toISOString().slice(0, 10);
    const memoryDir = path.join(
      os.homedir(),
      ".claude",
      "projects",
      "C--Command-Center-Kadmon-Harness",
      "memory",
    );
    const logFile = path.join(memoryDir, "logs", `${today}.md`);

    // Assert: log file exists and contains our unique session ID prefix
    expect(fs.existsSync(logFile)).toBe(true);
    const content = fs.readFileSync(logFile, "utf8");
    const sid8 = sessionId.slice(0, 8);
    expect(content).toContain(sid8);
  });
});
