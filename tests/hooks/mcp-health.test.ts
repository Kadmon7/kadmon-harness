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
const HEALTH_FILE = path.join(HEALTH_DIR, "mcp-health.json");

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

// Both hooks share mcp-health.json — combined into one file to avoid parallel race conditions
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

    it("exits 0 when health file has no entry for the server", () => {
      fs.writeFileSync(
        HEALTH_FILE,
        JSON.stringify({
          other_server: {
            failCount: 5,
            lastFailure: new Date().toISOString(),
          },
        }),
      );
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
    });

    it("exits 0 when server failCount is below threshold", () => {
      fs.writeFileSync(
        HEALTH_FILE,
        JSON.stringify({
          context7: { failCount: 2, lastFailure: new Date().toISOString() },
        }),
      );
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("exits 0 when failCount > 2 but lastFailure is older than 5 minutes", () => {
      const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      fs.writeFileSync(
        HEALTH_FILE,
        JSON.stringify({
          context7: { failCount: 5, lastFailure: oldTime },
        }),
      );
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stdout).toBe("");
    });

    it("warns when failCount > 2 and lastFailure within 5 minutes", () => {
      fs.writeFileSync(
        HEALTH_FILE,
        JSON.stringify({
          context7: {
            failCount: 5,
            lastFailure: new Date().toISOString(),
          },
        }),
      );
      const r = runCheck({ tool_name: "mcp__context7__query-docs" });
      expect(r.code).toBe(0);
      expect(r.stderr).toContain("context7");
      expect(r.stderr).toContain("failed 5 times");
    });

    it("exits 0 on empty input", () => {
      const r = runCheck({});
      expect(r.code).toBe(0);
    });
  });

  // --- mcp-health-failure tests ---
  describe("mcp-health-failure", () => {
    it("creates health file with failCount=1 on first failure", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      expect(health.context7).toBeDefined();
      expect(health.context7.failCount).toBe(1);
      expect(health.context7.lastFailure).toBeTruthy();
    });

    it("increments failCount on subsequent failures", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__context7__query-docs" });
      const health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      expect(health.context7.failCount).toBe(3);
    });

    it("tracks multiple servers independently", () => {
      runFailure({ tool_name: "mcp__context7__query-docs" });
      runFailure({ tool_name: "mcp__supabase__execute_sql" });
      runFailure({ tool_name: "mcp__context7__resolve-id" });
      const health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      expect(health.context7.failCount).toBe(2);
      expect(health.supabase.failCount).toBe(1);
    });

    it("uses 'unknown' as server name when no __ separator", () => {
      runFailure({ tool_name: "some_tool" });
      const health = JSON.parse(fs.readFileSync(HEALTH_FILE, "utf8"));
      expect(health.unknown).toBeDefined();
      expect(health.unknown.failCount).toBe(1);
    });

    it("exits 0 always", () => {
      expect(runFailure({ tool_name: "mcp__context7__query-docs" })).toBe(0);
      expect(runFailure({})).toBe(0);
    });
  });
});
