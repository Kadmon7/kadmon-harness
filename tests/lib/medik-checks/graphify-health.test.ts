// TDD [feniks] — Check #16 graphify-health
import { describe, it, expect, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// Mock child_process at module level so graphify-health.ts picks it up.
// Prod code uses execFileSync (arg-array, no shell interpolation — security rule).
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn().mockReturnValue(""),
  execSync: vi.fn().mockReturnValue(""),
}));

import * as childProcess from "node:child_process";
const mockExecFileSync = childProcess.execFileSync as unknown as ReturnType<
  typeof vi.fn
>;

import {
  evaluateGraphHealth,
  runCheck,
} from "../../../scripts/lib/medik-checks/graphify-health.js";

describe("graphify-health check (#16)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("evaluateGraphHealth (pure)", () => {
    it("NOTEs when graphify-out/ does not exist", () => {
      const result = evaluateGraphHealth({ dirExists: false });
      expect(result.status).toBe("NOTE");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toBe(
        "no graphify-out/ in this project — knowledge graph not adopted here, skipped",
      );
    });

    it("WARNs when graphify-out/ exists but graph.json is missing", () => {
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: false,
      });
      expect(result.status).toBe("WARN");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toBe(
        "graphify-out/ present but graph.json missing — run `graphify .` to build the graph",
      );
    });

    // The invalid state (graph.json present but its mtime unknown) is a
    // compile-time impossibility under the GraphHealthInput union — the
    // third variant structurally requires `graphMtimeMs: number` whenever
    // `graphJsonExists: true`, so no runtime test is needed for it.

    it("PASSes with a freshness-skipped message when git is unavailable", () => {
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs: Date.now(),
        headCommitMs: null,
      });
      expect(result.status).toBe("PASS");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toBe(
        "graphify-out/graph.json present (freshness check skipped: git unavailable)",
      );
    });

    it("NOTEs staleness when graph.json mtime is exactly 1 day behind HEAD", () => {
      const headCommitMs = 10_000_000_000;
      const graphMtimeMs = headCommitMs - 86_400_000; // exactly 1 day
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs,
        headCommitMs,
      });
      expect(result.status).toBe("NOTE");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toBe(
        "graphify-out/graph.json is 1 day(s) behind HEAD — consider `graphify update .`",
      );
    });

    it("rounds a 1.5-day gap up to 2 days (ceil — a partial day counts as 1)", () => {
      const headCommitMs = 10_000_000_000;
      const graphMtimeMs = headCommitMs - 1.5 * 86_400_000;
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs,
        headCommitMs,
      });
      expect(result.status).toBe("NOTE");
      expect(result.message).toBe(
        "graphify-out/graph.json is 2 day(s) behind HEAD — consider `graphify update .`",
      );
    });

    it("PASSes fresh when graph.json mtime equals the HEAD commit time", () => {
      const headCommitMs = 10_000_000_000;
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs: headCommitMs,
        headCommitMs,
      });
      expect(result.status).toBe("PASS");
      expect(result.category).toBe("knowledge-hygiene");
      expect(result.message).toBe(
        "graphify-out/graph.json fresh (built at/after HEAD commit)",
      );
    });

    it("PASSes fresh when graph.json mtime is after the HEAD commit time", () => {
      const headCommitMs = 10_000_000_000;
      const result = evaluateGraphHealth({
        dirExists: true,
        graphJsonExists: true,
        graphMtimeMs: headCommitMs + 1000,
        headCommitMs,
      });
      expect(result.status).toBe("PASS");
    });
  });

  describe("runCheck (integration)", () => {
    function makeTmpDir(): string {
      return fs.mkdtempSync(path.join(os.tmpdir(), "graphify-health-test-"));
    }
    function cleanup(dir: string): void {
      fs.rmSync(dir, { recursive: true, force: true });
    }

    it("NOTEs and does not crash when graphify-out/ is missing", () => {
      const tmpDir = makeTmpDir();
      try {
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("NOTE");
        expect(result.category).toBe("knowledge-hygiene");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("WARNs when graphify-out/ exists without graph.json", () => {
      const tmpDir = makeTmpDir();
      try {
        fs.mkdirSync(path.join(tmpDir, "graphify-out"), { recursive: true });
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("WARN");
      } finally {
        cleanup(tmpDir);
      }
    });

    it("PASSes (git-unavailable freshness-skipped path) when graph.json is present in a bare tmpdir", () => {
      const tmpDir = makeTmpDir();
      try {
        const graphOutDir = path.join(tmpDir, "graphify-out");
        fs.mkdirSync(graphOutDir, { recursive: true });
        fs.writeFileSync(path.join(graphOutDir, "graph.json"), "{}", "utf8");
        const result = runCheck({ projectHash: "test-proj", cwd: tmpDir });
        expect(result.status).toBe("PASS");
        expect(result.category).toBe("knowledge-hygiene");
      } finally {
        cleanup(tmpDir);
      }
    });

    describe("perf guard (spektr LOW-1: skip the git spawn for graphify-less repos)", () => {
      it("does NOT spawn git when graphify-out/ is missing", () => {
        const tmpDir = makeTmpDir();
        try {
          runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(mockExecFileSync).not.toHaveBeenCalled();
        } finally {
          cleanup(tmpDir);
        }
      });

      it("does NOT spawn git when graphify-out/ exists without graph.json", () => {
        const tmpDir = makeTmpDir();
        try {
          fs.mkdirSync(path.join(tmpDir, "graphify-out"), { recursive: true });
          runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(mockExecFileSync).not.toHaveBeenCalled();
        } finally {
          cleanup(tmpDir);
        }
      });

      it("DOES spawn git exactly once when graph.json exists (freshness check needed)", () => {
        const tmpDir = makeTmpDir();
        try {
          const graphOutDir = path.join(tmpDir, "graphify-out");
          fs.mkdirSync(graphOutDir, { recursive: true });
          fs.writeFileSync(path.join(graphOutDir, "graph.json"), "{}", "utf8");
          runCheck({ projectHash: "test-proj", cwd: tmpDir });
          expect(mockExecFileSync).toHaveBeenCalledTimes(1);
        } finally {
          cleanup(tmpDir);
        }
      });
    });
  });
});
