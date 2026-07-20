import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import initSqlJs from "sql.js";
import { detectProject } from "../../scripts/lib/project-detect.js";
import {
  makeClusterReport,
  writeClusterReportToFile,
} from "../fixtures/make-cluster-report.js";

const HOOK = path.resolve(".claude/hooks/scripts/session-end-all.js");
const SCHEMA_PATH = path.resolve("scripts/lib/schema.sql");

let sessionId: string;
let obsDir: string;
let testDb: string;
let transcriptFile: string | null = null;
// AUD-26: isolated per-test forge-reports dir so the real ~/.kadmon/forge-
// reports on a dev machine never leaks a "pending /evolve" nudge into
// unrelated assertions. Always empty by default — tests that want the
// positive nudge path plant a fixture report inside this exact dir.
let forgeReportsDir: string;

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
  const env = {
    ...process.env,
    KADMON_TEST_DB: testDb,
    KADMON_FORGE_REPORTS_DIR: forgeReportsDir,
  };
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
 * Same shape as generateObsLines but tags file paths with a batch label so
 * two consecutive batches can be told apart when asserting archive order.
 */
function generateTaggedObsLines(count: number, tag: string): string[] {
  const tools = ["Read", "Edit", "Write", "Bash", "Grep"];
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const isPreEvent = i % 2 === 0;
    const tool = tools[Math.floor(i / 2) % tools.length];
    lines.push(
      makeObsLine(
        isPreEvent ? "tool_pre" : "tool_post",
        tool,
        isPreEvent ? `/test/${tag}-file${i % 5}.ts` : undefined,
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
    forgeReportsDir = path.join(os.tmpdir(), `kadmon-forge-reports-test-${ts}`);
    fs.mkdirSync(forgeReportsDir, { recursive: true });
    await seedDb();
  });

  afterEach(() => {
    fs.rmSync(obsDir, { recursive: true, force: true });
    fs.rmSync(forgeReportsDir, { recursive: true, force: true });
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

  // Bug fix (P1, confirmed root cause): Phase 5 used to unlink
  // observations.jsonl outright whenever messageCount >= 20, which fires on
  // EVERY Stop event (not just session exit) — so past message 20, every
  // turn wiped cross-turn readers (/forge, /kompact) down to the last turn.
  // Fix: archive-then-unlink for observations.jsonl ONLY (ECC f720885c
  // retain-on-failure semantics); the other 3 files keep outright unlink.
  it("archives observations.jsonl into observations.archive.jsonl and still unlinks the other 3 files when messageCount >= 20", async () => {
    // 44 lines => 22 tool_pre (messageCount=22) => triggers cleanup at >= 20
    const lines = generateObsLines(44);
    writeObservations(lines);
    fs.writeFileSync(path.join(obsDir, "tool_count.txt"), "44");
    fs.writeFileSync(path.join(obsDir, "last_pre_ts.txt"), String(Date.now()));
    fs.writeFileSync(path.join(obsDir, "hook-events.jsonl"), "");

    runHook({ session_id: sessionId, cwd: process.cwd() });

    // observations.jsonl is archived, not merely deleted — its full content
    // must survive in observations.archive.jsonl
    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(false);
    const archivePath = path.join(obsDir, "observations.archive.jsonl");
    expect(fs.existsSync(archivePath)).toBe(true);
    const archiveContent = fs.readFileSync(archivePath, "utf8");
    for (const line of lines) {
      expect(archiveContent).toContain(line);
    }

    // The other 3 files keep today's outright-unlink behavior (unchanged)
    expect(fs.existsSync(path.join(obsDir, "tool_count.txt"))).toBe(false);
    expect(fs.existsSync(path.join(obsDir, "last_pre_ts.txt"))).toBe(false);
    expect(fs.existsSync(path.join(obsDir, "hook-events.jsonl"))).toBe(false);

    // Marker should still exist (written before cleanup)
    expect(fs.existsSync(path.join(obsDir, "clean-exit.marker"))).toBe(true);
  });

  it("archive accumulates across two consecutive hook runs (both batches present, in order)", async () => {
    // First Stop: batch 1 (44 lines => messageCount=22 >= 20) gets archived.
    const batch1 = generateTaggedObsLines(44, "batch1");
    writeObservations(batch1);
    runHook({ session_id: sessionId, cwd: process.cwd() });

    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(false);
    const archivePath = path.join(obsDir, "observations.archive.jsonl");
    const afterFirst = fs.readFileSync(archivePath, "utf8");
    expect(afterFirst).toContain("batch1-file0.ts");

    // Second Stop: a fresh batch of live observations (simulates the next
    // turn writing new observations after the live file was cleared).
    const batch2 = generateTaggedObsLines(44, "batch2");
    writeObservations(batch2);
    runHook({ session_id: sessionId, cwd: process.cwd() });

    const afterSecond = fs.readFileSync(archivePath, "utf8");
    const batch1Idx = afterSecond.indexOf("batch1-file0.ts");
    const batch2Idx = afterSecond.indexOf("batch2-file0.ts");
    expect(batch1Idx).toBeGreaterThanOrEqual(0);
    expect(batch2Idx).toBeGreaterThan(batch1Idx);
  });

  it("does not create an archive file or touch the live file when messageCount < 20", async () => {
    // 6 lines => 3 tool_pre (messageCount=3), well below the 20 threshold
    writeObservations(generateObsLines(6));

    runHook({ session_id: sessionId, cwd: process.cwd() });

    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(true);
    expect(
      fs.existsSync(path.join(obsDir, "observations.archive.jsonl")),
    ).toBe(false);
  });

  it("uses combined archive + live content for session persistence — messageCount and filesModified reflect totals from BOTH files", async () => {
    fs.mkdirSync(obsDir, { recursive: true });
    const archiveLines = [
      makeObsLine("tool_pre", "Read", "/archive/a.ts"),
      makeObsLine("tool_post", "Read"),
      makeObsLine("tool_pre", "Edit", "/archive/b.ts"),
      makeObsLine("tool_post", "Edit"),
    ];
    fs.writeFileSync(
      path.join(obsDir, "observations.archive.jsonl"),
      archiveLines.join("\n") + "\n",
    );

    // Live file has its own tool_pre events (below the 20-message threshold
    // so Phase 5 does not re-archive mid-assertion).
    writeObservations([
      makeObsLine("tool_pre", "Write", "/live/c.ts"),
      makeObsLine("tool_post", "Write"),
    ]);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    const db = await readDb();
    const stmt = db.prepare(
      "SELECT files_modified, message_count FROM sessions WHERE id = ?",
    );
    stmt.bind([sessionId]);
    expect(stmt.step()).toBe(true);
    const row = stmt.getAsObject();
    stmt.free();
    db.close();

    const files = JSON.parse(String(row.files_modified));
    expect(files).toContain("/archive/b.ts");
    expect(files).toContain("/live/c.ts");
    // 2 tool_pre in archive (Read, Edit) + 1 tool_pre in live (Write) = 3
    expect(Number(row.message_count)).toBe(3);
  });

  it("retains the live observations file when archiving fails (retain-on-failure, ECC f720885c semantics)", async () => {
    // 44 lines => messageCount=22 >= 20, would normally trigger archiving
    writeObservations(generateObsLines(44));
    // Force the archive append to fail: make the archive path a directory
    fs.mkdirSync(path.join(obsDir, "observations.archive.jsonl"));

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);

    // Archiving failed → live file must be RETAINED, not deleted, so the
    // next Stop can retry archiving instead of losing the turn's data.
    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(true);
  });

  // typescript-reviewer WARN (staged forge-blind fix, 2026-07-17): the Phase 5
  // archive catch was a silent `catch {}` — every sibling catch in this file
  // calls logHookError. A swallowed archive failure is invisible; the retain-
  // on-failure semantics are correct, but nobody would ever know archiving is
  // failing every Stop until /forge or /kompact silently drift.
  it("logs the archive failure via logHookError instead of swallowing it silently", async () => {
    // 44 lines => messageCount=22 >= 20, would normally trigger archiving
    writeObservations(generateObsLines(44));

    // Force ONLY the Phase 5 fs.appendFileSync to fail — NOT the
    // mkdirSync-a-directory trick used by the sibling "retains the live
    // observations file..." test above. That matters here: the
    // mkdirSync-directory trick also breaks the earlier combined
    // archive+live read (near the top of main(), before Phase 1), which
    // throws before Phase 5's own try/catch is ever reached — hitting the
    // OUTER catch instead, not the inner one this test targets. The
    // platform-specific fixtures below (read-only file on Windows,
    // dangling symlink on POSIX) both keep the early read working so the
    // failure is isolated to the exact fs.appendFileSync call in Phase 5.
    const archivePath = path.join(obsDir, "observations.archive.jsonl");
    if (process.platform === "win32") {
      // Windows: a chmod'd read-only regular file maps to the DOS
      // read-only attribute — appendFileSync fails with EPERM while the
      // early combined read stays unaffected.
      fs.writeFileSync(archivePath, "");
      fs.chmodSync(archivePath, 0o444);
    } else {
      // POSIX: chmod 0o444 is NOT reliable here — permission bits are
      // ignored for uid 0, so on a root-running CI runner the append
      // silently succeeds and no error is ever logged. A dangling symlink
      // into a nonexistent directory fails the open(O_APPEND|O_CREAT) with
      // ENOENT for EVERY uid, root included. The early combined read still
      // works: fs.existsSync follows the link, sees the dangling target,
      // returns false, and the hook treats it as "no archive yet" — so the
      // failure stays isolated to Phase 5's fs.appendFileSync, exactly as
      // the chmod trick achieves on Windows.
      fs.symlinkSync(
        path.join(obsDir, "no-such-dir", "archive-target.jsonl"),
        archivePath,
      );
    }

    let r: { stdout: string; stderr: string; exitCode: number };
    try {
      r = runHook({ session_id: sessionId, cwd: process.cwd() });
    } finally {
      if (process.platform === "win32") {
        // unlinkSync bypasses the read-only attribute on Windows (libuv
        // clears it and retries) so afterEach's rmSync would succeed anyway,
        // but restore write access explicitly for portability/clarity.
        fs.chmodSync(archivePath, 0o666);
      } else {
        // Remove the dangling symlink (rmSync force in afterEach also
        // handles it, but keep the fixture teardown symmetric).
        fs.rmSync(archivePath, { force: true });
      }
    }
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

    const archiveError = errorLines.find(
      (entry) =>
        entry.hook === "session-end-all" &&
        (entry.context as Record<string, unknown> | undefined)?.phase ===
          "observations-archive",
    );
    expect(archiveError).toBeDefined();
    expect(typeof archiveError?.error).toBe("string");

    // Retain-on-failure still holds — the live file survives the failed
    // append (unlinkSync is never reached).
    expect(fs.existsSync(path.join(obsDir, "observations.jsonl"))).toBe(true);
  });

  // Missing-test gap (typescript-reviewer WARN, staged forge-blind fix):
  // pins the append-succeeds-but-unlink-fails ordering. The archive append
  // and the live-file unlink are two separate fs calls inside the SAME try
  // block — if the append succeeds and ONLY the unlink fails, the batch is
  // already durably archived, but the live file survives too (retain-on-
  // failure keeps it for the next Stop). That next Stop will read the SAME
  // batch again and append it a second time into observations.archive.jsonl
  // — a known, accepted duplication window. This is safe because every DB
  // write downstream (sessions, hook_events, agent_invocations) is keyed by
  // its own natural key with ON CONFLICT DO NOTHING/UPDATE, so re-deriving
  // messageCount/filesModified from a duplicated archive batch does not
  // duplicate rows in the database — only the archive JSONL grows a re-read
  // duplicate line, which downstream readers already tolerate.
  //
  // Windows-only real-fs mechanism: chmod'ing the live file read-only (or
  // even setting the Windows DOS read-only ATTRIBUTE via `attrib +R`) does
  // NOT make fs.unlinkSync fail — verified empirically; libuv's Windows
  // unlink clears FILE_ATTRIBUTE_READONLY and retries. Holding an open
  // Node fs handle in the SAME process also does not block it — Node opens
  // files with FILE_SHARE_DELETE by default. The mechanism that reliably
  // fails fs.unlinkSync WITHOUT also failing the read (which the archive
  // append needs to succeed first) is a handle opened by another process
  // with FileShare.Read: that grants read sharing (so the hook's own
  // fs.readFileSync + fs.appendFileSync to the DIFFERENT archive path both
  // succeed) but withholds delete sharing (so fs.unlinkSync fails EBUSY) —
  // verified empirically. Done here via a short-lived PowerShell process so
  // the lock is real OS state, not a mocked fs call (the hook itself runs
  // as its own spawned subprocess, so there is no `fs` module in that
  // process we could mock from the test).
  it.runIf(process.platform === "win32")(
    "retains the live file (with one archived copy of the batch) when the archive append succeeds but the unlink fails — known re-append-on-next-Stop duplication window, deduped downstream via natural keys",
    async () => {
      const lines = generateObsLines(44);
      writeObservations(lines);
      const obsPath = path.join(obsDir, "observations.jsonl");
      const archivePath = path.join(obsDir, "observations.archive.jsonl");

      // Open the LIVE file with read-sharing (but not delete-sharing) from
      // an external process, so the hook's read+append still succeed but
      // its unlinkSync call cannot bypass the lock.
      const lockScript = [
        "try {",
        `  $fs = [System.IO.File]::Open('${obsPath}', [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)`,
        "  Write-Output 'LOCKED'",
        "  Start-Sleep -Seconds 8",
        "  $fs.Close()",
        "} catch {",
        "  Write-Output ('ERR:' + $_.Exception.Message)",
        "}",
      ].join("\n");
      const lockHolder = spawn(
        "powershell.exe",
        ["-NoProfile", "-Command", lockScript],
        { stdio: ["ignore", "pipe", "ignore"] },
      );

      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("lock holder did not report LOCKED in time")),
            5000,
          );
          lockHolder.stdout.on("data", (d: Buffer) => {
            if (d.toString().includes("LOCKED")) {
              clearTimeout(timer);
              resolve();
            }
          });
        });

        const r = runHook({ session_id: sessionId, cwd: process.cwd() });
        expect(r.exitCode).toBe(0);

        // Release the lock now — it only needed to be held while the hook
        // subprocess attempted its unlinkSync call. afterEach's rmSync of
        // obsDir would otherwise itself be blocked by the still-open handle.
        lockHolder.kill();
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Unlink failed (EBUSY) → live file survives with its ORIGINAL content.
        expect(fs.existsSync(obsPath)).toBe(true);
        expect(fs.readFileSync(obsPath, "utf8")).toBe(lines.join("\n") + "\n");

        // Append happened BEFORE the failed unlink → archive has the batch
        // exactly once. Assert exact equality rather than per-line
        // .toContain/occurrence-counting: generateObsLines() cycles through
        // only 5 (tool, filePath) combos over a tight synchronous loop, so
        // several lines within ONE batch can be byte-identical (same
        // millisecond timestamp) — a substring-occurrence count of a single
        // line conflates "appeared once" with "this exact line happens to
        // repeat within the batch itself" and is not a reliable duplication
        // signal here. Exact string equality against the full batch is.
        const archiveContent = fs.readFileSync(archivePath, "utf8");
        expect(archiveContent).toBe(lines.join("\n") + "\n");
      } finally {
        lockHolder.kill();
      }
    },
    15000,
  );

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

  // --- AUD-26 (Wave 4 audit) — /evolve cadence nudge (Phase 6) ---
  // runHook() always points KADMON_FORGE_REPORTS_DIR at the per-test
  // forgeReportsDir (empty by default) so a dev machine's real
  // ~/.kadmon/forge-reports can never leak a nudge into these assertions.

  it("emits a '/evolve' + 'ClusterReport' cadence nudge when a fresh-in-window report is pending", () => {
    // detectProject needs a real git remote — skip (not fail) when the
    // sandbox running this suite has no origin configured.
    const project = detectProject(process.cwd());
    if (!project?.projectHash) {
      expect(true).toBe(true);
      return;
    }

    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);

    // Plant a fresh ClusterReport for this project's hash directly in the
    // tmpdir that runHook's env points KADMON_FORGE_REPORTS_DIR at.
    const report = makeClusterReport({
      projectHash: project.projectHash,
      generatedAt: new Date().toISOString(),
    });
    writeClusterReportToFile(report, forgeReportsDir);

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain("/evolve");
    expect(r.stdout).toContain("ClusterReport");
  });

  it("does not emit a cadence nudge when no ClusterReports are pending", () => {
    writeObservations([
      makeObsLine("tool_pre", "Read", "/test/a.ts"),
      makeObsLine("tool_post", "Read"),
    ]);
    // forgeReportsDir is empty (beforeEach) — no report planted.

    const r = runHook({ session_id: sessionId, cwd: process.cwd() });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).not.toContain("pending /evolve");
  });
});
