import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";

const HOOK = path.resolve(".claude/hooks/scripts/session-start.js");
const SESSION_ID = `test-session-start-${Date.now()}`;
const OBS_DIR = path.join(os.tmpdir(), "kadmon", SESSION_ID);
const TEST_DB = path.join(
  os.tmpdir(),
  `kadmon-session-start-test-${Date.now()}.db`,
);
const SCHEMA_PATH = path.resolve("scripts/lib/schema.sql");
const PROJECT_HASH = "9444ca5b82301f2f";

function runHook(
  input: object,
  env?: Record<string, string>,
): { stdout: string; stderr: string; exitCode: number } {
  const baseEnv = { ...process.env, KADMON_TEST_DB: TEST_DB };
  try {
    const stdout = execFileSync("node", [HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 15000,
      env: env ? { ...baseEnv, ...env } : baseEnv,
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

async function seedDbWithOrphan(orphanId: string): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  for (const stmt of schema.split(";").filter((s) => s.trim())) {
    db.run(stmt + ";");
  }
  // Insert the orphan session — no ended_at, no clean-exit marker
  db.run(
    "INSERT INTO sessions (id, project_hash, started_at, branch, compaction_count, message_count) VALUES (?, ?, ?, ?, ?, ?)",
    [orphanId, PROJECT_HASH, new Date().toISOString(), "main", 0, 5],
  );
  fs.writeFileSync(TEST_DB, Buffer.from(db.export()));
  db.close();
}

async function seedDbWithCompactedSession(
  sessionId: string,
  compactionCount: number,
  summary: string,
  filesModified: string[],
  tasks: string[],
): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  for (const stmt of schema.split(";").filter((s) => s.trim())) {
    db.run(stmt + ";");
  }
  db.run(
    `INSERT INTO sessions
       (id, project_hash, started_at, branch, compaction_count, summary, files_modified, tasks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      PROJECT_HASH,
      new Date().toISOString(),
      "main",
      compactionCount,
      summary,
      JSON.stringify(filesModified),
      JSON.stringify(tasks),
    ],
  );
  fs.writeFileSync(TEST_DB, Buffer.from(db.export()));
  db.close();
}

async function readOrphanEndedAt(orphanId: string): Promise<string | null> {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(TEST_DB);
  const db = new SQL.Database(data);
  const stmt = db.prepare("SELECT ended_at FROM sessions WHERE id = ?");
  stmt.bind([orphanId]);
  const hasRow = stmt.step();
  const result = hasRow ? stmt.getAsObject() : {};
  stmt.free();
  db.close();
  const endedAt = result["ended_at"];
  if (endedAt === null || endedAt === undefined) return null;
  return String(endedAt);
}

describe("session-start", () => {
  const orphanDirs: string[] = [];

  afterEach(() => {
    fs.rmSync(OBS_DIR, { recursive: true, force: true });
    // Clean up any orphan observation dirs created in tests
    for (const dir of orphanDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    orphanDirs.length = 0;
    try {
      fs.unlinkSync(TEST_DB);
    } catch {
      /* may not exist */
    }
  });

  it("detects project hash from git remote", () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("9444ca5b82301f2f");
  });

  it("outputs session started banner with branch", () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Kadmon Session Started");
    expect(r.stdout).toContain("Branch:");
  });

  it("reports instinct count", () => {
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toMatch(/Instincts: \d+/);
  });

  it("creates session observations directory", () => {
    runHook({ session_id: SESSION_ID, cwd: process.cwd() });
    expect(fs.existsSync(OBS_DIR)).toBe(true);
  });

  it("respects KADMON_TEST_DB env var and does not write to real DB", () => {
    const realDbPath = path.join(os.homedir(), ".kadmon", "kadmon.db");
    const sizeBefore = fs.existsSync(realDbPath)
      ? fs.readFileSync(realDbPath).byteLength
      : 0;

    // Use a temp file instead of :memory: (works better with dynamic imports on Windows)
    const testDbPath = path.join(os.tmpdir(), `kadmon-test-${Date.now()}.db`);
    const r = runHook(
      { session_id: `test-isolation-${Date.now()}`, cwd: process.cwd() },
      { KADMON_TEST_DB: testDbPath },
    );

    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Kadmon Session Started");

    // Real DB should not have changed size (session written to temp DB instead)
    if (fs.existsSync(realDbPath)) {
      const sizeAfter = fs.readFileSync(realDbPath).byteLength;
      expect(sizeAfter).toBe(sizeBefore);
    }

    // Cleanup temp DB
    try {
      fs.unlinkSync(testDbPath);
    } catch {
      /* ignore */
    }
  });

  // --- Orphan Recovery Tests ---

  it("recovers orphaned session and reports in output", async () => {
    // Arrange: seed DB with an orphan session (different ID, same project hash)
    const orphanId = `test-orphan-${Date.now()}-a`;
    await seedDbWithOrphan(orphanId);

    // Create observations for the orphan so recovery data path is exercised
    const orphanObsDir = path.join(os.tmpdir(), "kadmon", orphanId);
    orphanDirs.push(orphanObsDir);
    fs.mkdirSync(orphanObsDir, { recursive: true });
    const obsLine = JSON.stringify({
      eventType: "tool_pre",
      toolName: "Read",
      filePath: "/test/file.ts",
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(
      path.join(orphanObsDir, "observations.jsonl"),
      obsLine + "\n",
    );

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly and reports the recovery
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Recovered orphaned session");

    // Assert: orphan session now has ended_at set in DB
    const endedAt = await readOrphanEndedAt(orphanId);
    expect(endedAt).not.toBeNull();
    expect(endedAt).not.toBe("");
  });

  it("does not crash when orphan has no observations", async () => {
    // Arrange: seed DB with orphan but no observations dir/file
    const orphanId = `test-orphan-${Date.now()}-b`;
    await seedDbWithOrphan(orphanId);
    // Deliberately do NOT create orphan obs dir — hook must handle missing gracefully

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook does not crash
    expect(r.exitCode).toBe(0);

    // Assert: orphan session still gets ended_at set (recovery proceeds without obs)
    const endedAt = await readOrphanEndedAt(orphanId);
    expect(endedAt).not.toBeNull();
    expect(endedAt).not.toBe("");
  });

  it("does not report recovery when no orphans exist", async () => {
    // Arrange: DB is empty (no seed) — hook runs against a fresh DB
    // TEST_DB does not exist yet, hook will create it fresh via openDb()

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly and reports NO recovery message
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain("Recovered orphaned session");
  });

  // --- Post-Compact Context Reinjection Tests ---

  it("injects post-compact context when compactionCount > 0", async () => {
    // Arrange: seed DB with a session matching SESSION_ID and compactionCount=1.
    // startSession() will find it, increment to 2, and trigger reinjection.
    await seedDbWithCompactedSession(
      SESSION_ID,
      1, // hook increments this to 2
      "Working on test coverage",
      ["/src/foo.ts", "/src/bar.ts"],
      ["[pending] Fix bug", "Complete migration"],
    );

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly and injects the recovery section
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("Post-Compact Context Recovery");
    expect(r.stdout).toContain("2"); // Compaction #2
    expect(r.stdout).toContain("Working on test coverage");
  });

  it("does not inject post-compact context for new sessions", async () => {
    // Arrange: TEST_DB does not exist — hook creates a fresh session with
    // compactionCount=0, so reinjection must NOT trigger.

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly with no post-compact section
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain("Post-Compact");
  });

  // --- Tmp Directory Cleanup Tests ---

  it("cleans up old UUID session dirs older than 7 days", () => {
    // Arrange: create a fake UUID-shaped dir with mtime set to 8 days in the past
    const kadmonTmp = path.join(os.tmpdir(), "kadmon");
    fs.mkdirSync(kadmonTmp, { recursive: true });

    const oldUuidDir = path.join(
      kadmonTmp,
      "00000000-0000-0000-0000-000000000000",
    );
    fs.mkdirSync(oldUuidDir, { recursive: true });

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldUuidDir, eightDaysAgo, eightDaysAgo);

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly
    expect(r.exitCode).toBe(0);

    // Assert: old UUID dir was deleted by cleanup logic
    expect(fs.existsSync(oldUuidDir)).toBe(false);

    // Assert: current session observation dir still exists (was not deleted)
    expect(fs.existsSync(OBS_DIR)).toBe(true);
  });

  it("cleans up old test-* dirs older than 24 hours but keeps recent ones", () => {
    // Arrange: create two test-* dirs — one stale (25h), one fresh
    const kadmonTmp = path.join(os.tmpdir(), "kadmon");
    fs.mkdirSync(kadmonTmp, { recursive: true });

    const oldTestDir = path.join(kadmonTmp, "test-cleanup-old");
    const recentTestDir = path.join(kadmonTmp, "test-cleanup-recent");
    fs.mkdirSync(oldTestDir, { recursive: true });
    fs.mkdirSync(recentTestDir, { recursive: true });

    // Register recentTestDir for afterEach cleanup in case test fails mid-way
    orphanDirs.push(recentTestDir);

    // Set old dir mtime to 25 hours ago
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(oldTestDir, twentyFiveHoursAgo, twentyFiveHoursAgo);
    // recentTestDir keeps current mtime (just created — well within the 24h window)

    // Act
    const r = runHook({ session_id: SESSION_ID, cwd: process.cwd() });

    // Assert: hook exits cleanly
    expect(r.exitCode).toBe(0);

    // Assert: stale test dir was deleted by cleanup logic
    expect(fs.existsSync(oldTestDir)).toBe(false);

    // Assert: recent test dir was NOT deleted
    expect(fs.existsSync(recentTestDir)).toBe(true);
  });
});
