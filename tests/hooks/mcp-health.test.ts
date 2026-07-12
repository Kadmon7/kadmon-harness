import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHECK_HOOK = path.resolve(".claude/hooks/scripts/mcp-health-check.js");
const FAILURE_HOOK = path.resolve(
  ".claude/hooks/scripts/mcp-health-failure.js",
);
const HEALTH_DIR = path.join(os.tmpdir(), "kadmon");
const HEALTH_FILE = path.join(HEALTH_DIR, "mcp-health.jsonl");
// Must match MAX_LOG_LINES in mcp-health-failure.js — the rotation cap
// under test in the "rotates" case below.
const MAX_LOG_LINES = 200;
const TRIM_THRESHOLD = MAX_LOG_LINES * 2;

interface HealthEntry {
  server: string;
  timestamp: string;
}

let backup: string | null = null;

function runCheck(input: object): {
  code: number;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync("node", [CHECK_HOOK], {
    encoding: "utf8",
    input: JSON.stringify(input),
  });
  return {
    code: r.status ?? 0,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function runFailure(input: object): number {
  try {
    execFileSync("node", [FAILURE_HOOK], {
      encoding: "utf8",
      input: JSON.stringify(input),
      stdio: ["pipe", "pipe", "pipe"],
    });
    return 0;
  } catch (err: unknown) {
    return (err as { status: number }).status ?? 1;
  }
}

function writeJsonl(entries: HealthEntry[]): void {
  const body = entries.map((e) => JSON.stringify(e)).join("\n");
  fs.writeFileSync(HEALTH_FILE, body.length > 0 ? body + "\n" : "");
}

function readJsonl(): HealthEntry[] {
  return fs
    .readFileSync(HEALTH_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

// Both hooks share mcp-health.jsonl (append-only log) — combined into one
// describe block to avoid parallel race conditions between test files.
describe("mcp-health", () => {
  beforeEach(() => {
    try {
      backup = fs.readFileSync(HEALTH_FILE, "utf8");
    } catch {
      backup = null;
    }
    fs.mkdirSync(HEALTH_DIR, { recursive: true });
    try {
      fs.unlinkSync(HEALTH_FILE);
    } catch {
      /* may not exist */
    }
  });

  afterEach(() => {
    if (backup !== null) {
      fs.writeFileSync(HEALTH_FILE, backup);
    } else {
      try {
        fs.unlinkSync(HEALTH_FILE);
      } catch {
        /* may not exist */
      }
    }
  });

  // --- mcp-health-check tests ---
  describe("mcp-health-check", () => {
    it("exits 0 when no health file exists", () => {
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
    });

    it("exits 0 when health file has no entries for the server", () => {
      writeJsonl([
        { server: "other_server", timestamp: new Date().toISOString() },
        { server: "other_server", timestamp: new Date().toISOString() },
      ]);
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
    });

    it("exits 0 when server failCount is below threshold", () => {
      writeJsonl([
        { server: "context7", timestamp: new Date().toISOString() },
        { server: "context7", timestamp: new Date().toISOString() },
      ]);
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("exits 0 when failCount > 2 but lastFailure is older than 5 minutes", () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      writeJsonl([
        { server: "context7", timestamp: oldTime },
        { server: "context7", timestamp: oldTime },
        { server: "context7", timestamp: oldTime },
      ]);
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("warns when failCount > 2 and lastFailure within 5 minutes", () => {
      writeJsonl([
        {
          server: "context7",
          timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        },
        {
          server: "context7",
          timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        },
        {
          server: "context7",
          timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        },
        {
          server: "context7",
          timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        },
        { server: "context7", timestamp: new Date().toISOString() },
      ]);
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stderr).toContain("context7");
      expect(r.stderr).toContain("failed 5 times");
    });

    it("exits 0 on empty input", () => {
      const r = runCheck({});
      expect(r.code).toBe(0);
    });

    it("skips malformed JSONL lines without crashing", () => {
      const now = new Date().toISOString();
      const body = [
        "{ this is not valid json",
        JSON.stringify({ server: "context7", timestamp: now }),
        JSON.stringify({ server: "context7", timestamp: now }),
        JSON.stringify({ server: "context7", timestamp: now }),
      ].join("\n");
      fs.writeFileSync(HEALTH_FILE, body + "\n");
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stderr).toContain("failed 3 times");
    });
  });

  // --- mcp-health-failure tests ---
  describe("mcp-health-failure", () => {
    it("creates the JSONL file with one appended entry on first failure", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const entries = readJsonl();
      expect(entries).toHaveLength(1);
      expect(entries[0].server).toBe("context7");
      expect(entries[0].timestamp).toBeTruthy();
    });

    it("appends one line per subsequent failure instead of overwriting", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const entries = readJsonl();
      expect(entries).toHaveLength(3);
      expect(entries.every((e) => e.server === "context7")).toBe(true);
    });

    it("tracks multiple servers independently as separate lines", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__supabase__execute_sql" });
      runFailure({ tool_name: "mcp__context7__resolve-id" });
      const entries = readJsonl();
      expect(entries).toHaveLength(3);
      expect(entries.filter((e) => e.server === "context7")).toHaveLength(2);
      expect(entries.filter((e) => e.server === "supabase")).toHaveLength(1);
    });

    it("uses 'unknown' as server name when no __ separator", () => {
      runFailure({ tool_name: "some_tool" });
      const entries = readJsonl();
      expect(entries).toHaveLength(1);
      expect(entries[0].server).toBe("unknown");
    });

    it("exits 0 always", () => {
      expect(runFailure({ tool_name: "mcp__context7__query-docs" })).toBe(0);
      expect(runFailure({})).toBe(0);
    });

    it("preserves every write across many sequential invocations (lost-update regression)", () => {
      // Regression test for the read-modify-write race the old JSON-file
      // implementation had: it read the whole file, mutated an in-memory
      // object, and wrote the whole file back — so two near-simultaneous
      // invocations could clobber each other's update (last-writer-wins).
      // Pure append cannot lose a write regardless of interleaving: every
      // invocation unconditionally adds its own line via fs.appendFileSync
      // (O_APPEND), so N invocations must produce exactly N lines.
      const N = 20;
      for (let i = 0; i < N; i++) {
        runFailure({ tool_name: "mcp__context7__query-docs" });
      }
      const entries = readJsonl();
      expect(entries).toHaveLength(N);
      expect(entries.every((e) => e.server === "context7")).toBe(true);
    });

    it("rotates the log back to the cap once it grows well past it", () => {
      // Pre-seed the file past TRIM_THRESHOLD so the next append crosses
      // the rotation trigger. Rotation should trim back down to
      // MAX_LOG_LINES rather than growing unbounded.
      const seeded = Array.from({ length: TRIM_THRESHOLD }, () =>
        JSON.stringify({
          server: "context7",
          timestamp: new Date().toISOString(),
        }),
      ).join("\n");
      fs.writeFileSync(HEALTH_FILE, seeded + "\n");
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const entries = readJsonl();
      expect(entries.length).toBe(MAX_LOG_LINES);
    });

    it("does not rotate while under the trim threshold (stays pure append)", () => {
      const seeded = Array.from({ length: MAX_LOG_LINES }, () =>
        JSON.stringify({
          server: "context7",
          timestamp: new Date().toISOString(),
        }),
      ).join("\n");
      fs.writeFileSync(HEALTH_FILE, seeded + "\n");
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const entries = readJsonl();
      expect(entries.length).toBe(MAX_LOG_LINES + 1);
    });
  });
});
