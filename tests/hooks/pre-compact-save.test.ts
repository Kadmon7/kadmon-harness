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

function runHook(
  input: object,
  extraEnv?: Record<string, string>,
): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const env = { ...process.env, KADMON_TEST_DB: testDb, ...extraEnv };
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

  // AUD-15 (2026-07-12 audit) — session_id from stdin must be validated
  // against /^[a-zA-Z0-9_-]+$/ before being used to build a filesystem path.
  // Regression test: plant a decoy observations.jsonl OUTSIDE the kadmon
  // sandbox at the location a "../" session_id resolves to. Pre-fix, this
  // hook did `path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl")`
  // with no validation, so it would read the decoy's tool-call count and
  // print "Session state saved..." to stdout referencing it. Post-fix, the
  // malformed session_id is rejected by safeSessionDir() and the hook exits
  // immediately — same contract as the "no session_id" case (empty stdout,
  // exit 0) — before touching any escaped path.
  it("does not read observations from a path outside the kadmon sandbox for a traversal session_id", () => {
    const escapedName = `evil-pcs-${Date.now()}`;
    const escapedDir = path.join(os.tmpdir(), escapedName);
    fs.mkdirSync(escapedDir, { recursive: true });
    fs.writeFileSync(
      path.join(escapedDir, "observations.jsonl"),
      JSON.stringify({ eventType: "tool_pre", toolName: "Read", filePath: "decoy.ts" }) + "\n",
    );
    try {
      const r = runHook({ session_id: `../${escapedName}`, cwd: process.cwd() });
      expect(r.exitCode).toBe(0);
      // Early-exit contract (matches "exits cleanly with no session_id"
      // above) — the decoy is never read, so no "Session state saved"
      // message referencing its content is printed.
      expect(r.stdout).toBe("");
    } finally {
      fs.rmSync(escapedDir, { recursive: true, force: true });
    }
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

    // Sandbox the hook's home directory so the daily log lands in a temp
    // dir instead of the developer's REAL ~/.claude/projects memory (the
    // old version of this test appended a fake entry to the real daily
    // log on every run). os.homedir() honors $HOME on POSIX and
    // %USERPROFILE% on Windows — set both.
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-pcs-home-"));

    try {
      // Act: run the hook
      const r = runHook(
        { session_id: sessionId, cwd: process.cwd() },
        { HOME: fakeHome, USERPROFILE: fakeHome },
      );
      expect(r.exitCode).toBe(0);

      // Resolve the daily log path — same formula as daily-log.js
      // resolveMemoryDir(): slug = cwd with [:\\/] replaced by "-". The old
      // hardcoded "C--Command-Center-Kadmon-Harness" slug only matched the
      // dev machines' checkout path (C:\Command Center\Kadmon Harness) and
      // failed on any other clone location.
      const today = new Date().toISOString().slice(0, 10);
      const projectDirName = process.cwd().replace(/[:\\/]/g, "-");
      const memoryDir = path.join(
        fakeHome,
        ".claude",
        "projects",
        projectDirName,
        "memory",
      );
      const logFile = path.join(memoryDir, "logs", `${today}.md`);

      // Assert: log file exists and contains our unique session ID prefix
      expect(fs.existsSync(logFile)).toBe(true);
      const content = fs.readFileSync(logFile, "utf8");
      const sid8 = sessionId.slice(0, 8);
      expect(content).toContain(sid8);
    } finally {
      fs.rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});
