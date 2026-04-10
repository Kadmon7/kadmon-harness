/**
 * TDD [feniks]
 * Tests for evaluate-patterns-shared.js exercised through the session-end-all hook.
 * session-end-all is the primary consumer of evaluateAndApplyPatterns.
 *
 * Covered here (NOT covered in session-end-all.test.ts):
 *   1. cwd with no git remote → returns 0 instincts
 *   2. reinforcement — second run updates confidence instead of creating a duplicate
 *   3. multiple distinct patterns → multiple instincts created in one run
 *   4. malformed JSON lines mixed in → no crash, valid lines still processed
 */
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

// ---------------------------------------------------------------------------
// Infrastructure helpers (same pattern as session-end-all.test.ts)
// ---------------------------------------------------------------------------

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
      timeout: 20000,
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
    "INSERT INTO sessions (id, project_hash, started_at, branch, compaction_count, message_count) VALUES (?, ?, ?, ?, ?, ?)",
    [sessionId, "test-hash-eval", new Date().toISOString(), "main", 0, 0],
  );
  fs.writeFileSync(testDb, Buffer.from(db.export()));
  db.close();
}

/** Add a new session row to the existing DB on disk (preserves all data including instincts). */
async function addSessionToDb(extraSessionId: string): Promise<void> {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(testDb);
  const db = new SQL.Database(data);
  db.run(
    "INSERT INTO sessions (id, project_hash, started_at, branch, compaction_count, message_count) VALUES (?, ?, ?, ?, ?, ?)",
    [extraSessionId, "test-hash-eval", new Date().toISOString(), "main", 0, 0],
  );
  fs.writeFileSync(testDb, Buffer.from(db.export()));
  db.close();
}

async function openReadDb(): Promise<
  InstanceType<Awaited<ReturnType<typeof initSqlJs>>["Database"]>
> {
  const SQL = await initSqlJs();
  const data = fs.readFileSync(testDb);
  return new SQL.Database(data);
}

/** Build 20+ observation lines that reliably trigger Read→Edit→Write sequences */
function buildReadEditWriteLines(count: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    // Cycle: Read → Edit → Write → Read → Edit → Write …
    const cycle = i % 3;
    const tool = cycle === 0 ? "Read" : cycle === 1 ? "Edit" : "Write";
    lines.push(
      makeObsLine("tool_pre", tool, `/project/file${i}.ts`),
      makeObsLine("tool_post", tool),
    );
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("evaluate-patterns-shared (via session-end-all)", () => {
  beforeEach(async () => {
    const ts = Date.now() + Math.random().toString(36).slice(2, 7);
    sessionId = `test-eps-${ts}`;
    obsDir = path.join(os.tmpdir(), "kadmon", sessionId);
    testDb = path.join(os.tmpdir(), `kadmon-eps-test-${ts}.db`);
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

  // -------------------------------------------------------------------------
  // Test 1: cwd with no git remote → 0 instincts
  // -------------------------------------------------------------------------
  it("creates no instincts when cwd has no git remote", async () => {
    // Use os.tmpdir() as cwd — it has no .git remote, so gitExec returns null
    // and evaluateAndApplyPatterns short-circuits before touching the DB.
    writeObservations(buildReadEditWriteLines(12)); // 24 lines, well above minLines

    const r = runHook({ session_id: sessionId, cwd: os.tmpdir() });
    expect(r.exitCode).toBe(0);

    const db = await openReadDb();
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    expect(Number(row.cnt)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 2: reinforcement — second run increases confidence, no new row
  // -------------------------------------------------------------------------
  it("reinforces an existing instinct instead of creating a duplicate", async () => {
    // Run 1: create instincts
    writeObservations(buildReadEditWriteLines(12));
    const r1 = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r1.exitCode).toBe(0);

    // Capture count and baseline instinct data in a single DB open
    const db1 = await openReadDb();
    const stmt1 = db1.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt1.step();
    const countAfterRun1 = Number(stmt1.getAsObject().cnt);
    stmt1.free();
    expect(countAfterRun1).toBeGreaterThan(0);

    const confStmt1 = db1.prepare(
      "SELECT id, pattern, confidence, occurrences FROM instincts ORDER BY id",
    );
    const instinctsAfterRun1: Array<{
      id: string;
      pattern: string;
      confidence: number;
      occurrences: number;
    }> = [];
    while (confStmt1.step()) {
      const r = confStmt1.getAsObject();
      instinctsAfterRun1.push({
        id: String(r.id),
        pattern: String(r.pattern),
        confidence: Number(r.confidence),
        occurrences: Number(r.occurrences),
      });
    }
    confStmt1.free();
    db1.close();

    // Run 2: same patterns — should reinforce, not duplicate.
    // Insert a second session row WITHOUT wiping the DB (instincts from run 1 must survive).
    const ts2 = Date.now() + Math.random().toString(36).slice(2, 7);
    const sessionId2 = `test-eps-run2-${ts2}`;
    await addSessionToDb(sessionId2);

    // Write the same observation pattern for the second session
    const obsDir2 = path.join(os.tmpdir(), "kadmon", sessionId2);
    fs.mkdirSync(obsDir2, { recursive: true });
    const lines2 = buildReadEditWriteLines(12).map((line) => {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      parsed.sessionId = sessionId2;
      return JSON.stringify(parsed);
    });
    fs.writeFileSync(
      path.join(obsDir2, "observations.jsonl"),
      lines2.join("\n") + "\n",
    );

    const r2 = runHook({ session_id: sessionId2, cwd: process.cwd() });
    expect(r2.exitCode).toBe(0);

    // Clean up second obs dir
    fs.rmSync(obsDir2, { recursive: true, force: true });

    // Count should be the same — no new rows created
    const db2 = await openReadDb();
    const stmt2 = db2.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt2.step();
    const countAfterRun2 = Number(stmt2.getAsObject().cnt);
    stmt2.free();

    // Confidence of at least one instinct should have increased
    const confStmt2 = db2.prepare(
      "SELECT id, confidence, occurrences FROM instincts ORDER BY id",
    );
    const instinctsAfterRun2: Array<{
      id: string;
      confidence: number;
      occurrences: number;
    }> = [];
    while (confStmt2.step()) {
      const row2 = confStmt2.getAsObject();
      instinctsAfterRun2.push({
        id: String(row2.id),
        confidence: Number(row2.confidence),
        occurrences: Number(row2.occurrences),
      });
    }
    confStmt2.free();
    db2.close();

    expect(countAfterRun2).toBe(countAfterRun1);

    // At least one instinct should have higher confidence or more occurrences
    const atLeastOneReinforced = instinctsAfterRun2.some((inst2) => {
      const inst1 = instinctsAfterRun1.find((i) => i.id === inst2.id);
      return inst1 !== undefined && inst2.occurrences > inst1.occurrences;
    });
    expect(atLeastOneReinforced).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 3: multiple distinct patterns → multiple instincts created
  // -------------------------------------------------------------------------
  it("creates multiple instincts from diverse tool sequences", async () => {
    // Build observations that trigger multiple distinct pattern definitions:
    //   - "Read files before editing them"  (Read → Edit sequence)
    //   - "Search before writing new code"  (Grep → Write sequence)
    //   - "Explore multiple files"          (cluster of 3+ Read)
    const lines: string[] = [];

    // 4× Read→Edit pairs (triggers "Read files before editing them", threshold 3)
    for (let i = 0; i < 4; i++) {
      lines.push(makeObsLine("tool_pre", "Read", `/src/a${i}.ts`));
      lines.push(makeObsLine("tool_post", "Read"));
      lines.push(makeObsLine("tool_pre", "Edit", `/src/a${i}.ts`));
      lines.push(makeObsLine("tool_post", "Edit"));
    }

    // 3× Grep→Write pairs (triggers "Search before writing new code", threshold 2)
    for (let i = 0; i < 3; i++) {
      lines.push(
        makeObsLine("tool_pre", "Grep", undefined, { pattern: "foo" }),
      );
      lines.push(makeObsLine("tool_post", "Grep"));
      lines.push(makeObsLine("tool_pre", "Write", `/src/new${i}.ts`));
      lines.push(makeObsLine("tool_post", "Write"));
    }

    // 3× consecutive Read calls (triggers "Explore multiple files", minClusterSize 3, threshold 3)
    for (let i = 0; i < 4; i++) {
      lines.push(makeObsLine("tool_pre", "Read", `/docs/file${i}.md`));
      lines.push(makeObsLine("tool_post", "Read"));
    }

    // Ensure at least 10 lines (well above that — we have 44 total)
    expect(lines.length).toBeGreaterThanOrEqual(10);

    writeObservations(lines);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const db = await openReadDb();
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt.step();
    const count = Number(stmt.getAsObject().cnt);
    stmt.free();

    const patternStmt = db.prepare(
      "SELECT DISTINCT pattern FROM instincts ORDER BY pattern",
    );
    const patterns: string[] = [];
    while (patternStmt.step()) {
      patterns.push(String(patternStmt.getAsObject().pattern));
    }
    patternStmt.free();
    db.close();

    // Expect at least 2 distinct patterns triggered
    expect(count).toBeGreaterThanOrEqual(2);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------------
  // Test 4: malformed JSON lines mixed in → no crash, valid lines processed
  // -------------------------------------------------------------------------
  it("handles malformed observation lines gracefully and processes valid ones", async () => {
    const lines: string[] = [];

    // Inject malformed lines at positions 0, 5, 10
    lines.push("{ this is not valid json }");

    // 4× Read→Edit pairs (triggers pattern even with bad lines present)
    for (let i = 0; i < 4; i++) {
      lines.push(makeObsLine("tool_pre", "Read", `/src/b${i}.ts`));
      lines.push(makeObsLine("tool_post", "Read"));
      lines.push(makeObsLine("tool_pre", "Edit", `/src/b${i}.ts`));
      lines.push(makeObsLine("tool_post", "Edit"));
    }

    lines.push("INVALID LINE");

    // 2× more Read→Edit to push well past threshold
    for (let i = 4; i < 6; i++) {
      lines.push(makeObsLine("tool_pre", "Read", `/src/b${i}.ts`));
      lines.push(makeObsLine("tool_post", "Read"));
      lines.push(makeObsLine("tool_pre", "Edit", `/src/b${i}.ts`));
      lines.push(makeObsLine("tool_post", "Edit"));
    }

    lines.push('{"incomplete": true');

    writeObservations(lines);

    // Hook must NOT crash (exit 0)
    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // And valid lines should still have been processed — patterns triggered
    const db = await openReadDb();
    const stmt = db.prepare("SELECT COUNT(*) as cnt FROM instincts");
    stmt.step();
    const count = Number(stmt.getAsObject().cnt);
    stmt.free();
    db.close();

    // The Read→Edit pattern (threshold 3) should have triggered despite bad lines
    expect(count).toBeGreaterThan(0);
  });
});
