// TDD — /medik module-based checks CLI runner (AUD-04/AUD-05, audit 2026-07-12).
// Covers: arg parsing, projectHash construction from --cwd, per-check error
// isolation, and DB lifecycle (never close a DB the runner did not open).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  parseCliArgs,
  resolveProjectHash,
  runChecks,
  DEFAULT_REGISTRY,
  type CheckRegistry,
} from "../../scripts/lib/medik-checks-cli.js";
import {
  openDb,
  closeDb,
  getDb,
  upsertSession,
  insertHookEvent,
} from "../../scripts/lib/state-store.js";
import { hashString } from "../../scripts/lib/utils.js";
import type { CheckResult } from "../../scripts/lib/medik-checks/types.js";

describe("medik-checks-cli", () => {
  describe("parseCliArgs", () => {
    it("defaults: cwd=process.cwd(), all registry checks sorted ascending", () => {
      const options = parseCliArgs([]);
      expect(options.cwd).toBe(process.cwd());
      expect(options.checks).toEqual([10, 11, 12, 13, 14, 15, 16]);
    });

    it("--cwd overrides target directory and resolves to absolute", () => {
      const options = parseCliArgs(["--cwd", tmpdir()]);
      expect(options.cwd).toBe(tmpdir());
      expect(options.checks).toEqual([10, 11, 12, 13, 14, 15, 16]);
    });

    it("--checks selects a subset", () => {
      const options = parseCliArgs(["--checks", "11,12"]);
      expect(options.checks).toEqual([11, 12]);
    });

    it("--checks dedupes, trims, and sorts", () => {
      const options = parseCliArgs(["--checks", "14, 10,14"]);
      expect(options.checks).toEqual([10, 14]);
    });

    it("throws on unknown argument", () => {
      expect(() => parseCliArgs(["--bogus"])).toThrow(/unknown argument/i);
    });

    it("throws when --cwd has no value", () => {
      expect(() => parseCliArgs(["--cwd"])).toThrow(/requires a value/i);
    });

    it("throws when --checks has no value", () => {
      expect(() => parseCliArgs(["--checks"])).toThrow(/requires a value/i);
    });

    it("throws on check number outside the registry", () => {
      expect(() => parseCliArgs(["--checks", "99"])).toThrow(/99/);
    });

    it("throws a friendly message (not a raw Zod error) on non-numeric check", () => {
      expect(() => parseCliArgs(["--checks", "ten"])).toThrow(
        "--checks expects a comma-separated list of check numbers, got: ten",
      );
    });

    it("throws the friendly message when only one item in a list is non-numeric", () => {
      expect(() => parseCliArgs(["--checks", "10,foo,12"])).toThrow(
        "--checks expects a comma-separated list of check numbers, got: 10,foo,12",
      );
    });

    it("throws when --cwd is not an existing directory", () => {
      expect(() =>
        parseCliArgs(["--cwd", join(tmpdir(), "definitely-missing-dir-xyz")]),
      ).toThrow(/not a directory/i);
    });
  });

  describe("resolveProjectHash", () => {
    let tmp: string;

    beforeEach(() => {
      tmp = mkdtempSync(join(tmpdir(), "medik-cli-hash-"));
    });

    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it("git repo with remote: hash equals hashString(remoteUrl) — the hooks' recipe", () => {
      const remoteUrl = "https://example.com/acme/consumer-repo.git";
      execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
      execFileSync("git", ["remote", "add", "origin", remoteUrl], {
        cwd: tmp,
        stdio: "ignore",
      });

      expect(resolveProjectHash(tmp)).toBe(hashString(remoteUrl));
    });

    it("non-git directory: deterministic cwd-derived fallback, never the 'cli' sentinel", () => {
      const first = resolveProjectHash(tmp);
      const second = resolveProjectHash(tmp);
      expect(first).toBe(second);
      expect(first).not.toBe("cli");
      expect(first).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe("runChecks", () => {
    afterEach(() => {
      closeDb();
    });

    const passResult: CheckResult = {
      status: "PASS",
      category: "runtime",
      message: "fine",
    };

    it("isolates per-check crashes as NOTE and keeps running the rest", async () => {
      const registry: CheckRegistry = new Map([
        [91, { name: "boom", needsDb: false, run: (): CheckResult => { throw new Error("kaboom"); } }],
        [92, { name: "ok", needsDb: false, run: (): CheckResult => passResult }],
      ]);

      const results = await runChecks({ cwd: process.cwd(), checks: [91, 92] }, registry);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ check: 91, name: "boom", status: "NOTE" });
      expect(results[0].message).toContain("kaboom");
      expect(results[1]).toMatchObject({ check: 92, name: "ok", status: "PASS" });
    });

    it("defensive: unknown check id yields a NOTE result instead of crashing", async () => {
      const registry: CheckRegistry = new Map([
        [92, { name: "ok", needsDb: false, run: (): CheckResult => passResult }],
      ]);

      const results = await runChecks({ cwd: process.cwd(), checks: [77, 92] }, registry);

      expect(results[0].check).toBe(77);
      expect(results[0].status).toBe("NOTE");
      expect(results[0].message).toMatch(/unknown check/i);
      expect(results[1].status).toBe("PASS");
    });

    it("passes the cwd-derived projectHash into checks (never a hardcoded sentinel)", async () => {
      const seen: string[] = [];
      const registry: CheckRegistry = new Map([
        [
          91,
          {
            name: "spy",
            needsDb: false,
            run: (ctx): CheckResult => {
              seen.push(ctx.projectHash);
              return passResult;
            },
          },
        ],
      ]);

      await runChecks({ cwd: process.cwd(), checks: [91] }, registry);

      expect(seen).toEqual([resolveProjectHash(process.cwd())]);
      expect(seen[0]).not.toBe("cli");
    });

    it("DB-filtered check #11 sees rows under the real project hash (regression: 'cli' hash = false PASS)", async () => {
      await openDb(":memory:");
      const projectHash = resolveProjectHash(process.cwd());
      upsertSession({ id: "medik-cli-sess", projectHash });
      insertHookEvent({
        sessionId: "medik-cli-sess",
        hookName: "no-context-guard",
        eventType: "pre_tool",
        toolName: "Write",
        exitCode: 2,
        blocked: true,
        durationMs: 80,
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });

      const results = await runChecks({ cwd: process.cwd(), checks: [11] });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ check: 11, name: "hook-health-24h", status: "WARN" });
      expect(results[0].message).toContain("no-context-guard");
    });

    it("does not close a DB it did not open", async () => {
      await openDb(":memory:");

      await runChecks({ cwd: process.cwd(), checks: [11, 12] });

      expect(() => getDb()).not.toThrow();
    });

    it("opens (via KADMON_TEST_DB) and closes its own DB when none is open", async () => {
      closeDb(); // ensure nothing is open
      const results = await runChecks({ cwd: process.cwd(), checks: [12] });

      expect(results[0]).toMatchObject({ check: 12, name: "instinct-decay-candidates" });
      // empty :memory: DB → no candidates
      expect(results[0].status).toBe("PASS");
      // runner opened it, runner closed it
      expect(() => getDb()).toThrow(/not opened/i);
    });

    it("integration: default registry runs non-DB checks 13+14 against the harness repo", async () => {
      const results = await runChecks({ cwd: process.cwd(), checks: [13, 14] });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.check)).toEqual([13, 14]);
      expect(results.map((r) => r.name)).toEqual([
        "skill-creator-probe",
        "capability-alignment",
      ]);
      for (const r of results) {
        expect(["PASS", "NOTE", "WARN", "FAIL"]).toContain(r.status);
        expect(r.message.length).toBeGreaterThan(0);
      }
    });

    it("DEFAULT_REGISTRY maps the seven module-based checks to their on-disk names", () => {
      expect([...DEFAULT_REGISTRY.keys()].sort((a, b) => a - b)).toEqual([10, 11, 12, 13, 14, 15, 16]);
      expect(DEFAULT_REGISTRY.get(10)?.name).toBe("stale-plans");
      expect(DEFAULT_REGISTRY.get(11)?.needsDb).toBe(true);
      expect(DEFAULT_REGISTRY.get(12)?.needsDb).toBe(true);
      expect(DEFAULT_REGISTRY.get(13)?.needsDb).toBe(false);
      expect(DEFAULT_REGISTRY.get(14)?.needsDb).toBe(false);
      expect(DEFAULT_REGISTRY.get(15)?.name).toBe("docs-status-lint");
      expect(DEFAULT_REGISTRY.get(15)?.needsDb).toBe(false);
      expect(DEFAULT_REGISTRY.get(16)?.name).toBe("graphify-health");
      expect(DEFAULT_REGISTRY.get(16)?.needsDb).toBe(false);
    });
  });

  describe("CLI entry point (subprocess)", () => {
    const SCRIPT = resolve("scripts/lib/medik-checks-cli.ts");

    function runCli(args: readonly string[]): {
      stdout: string;
      stderr: string;
      exitCode: number;
    } {
      // spawnSync with shell:true is required on Windows — npx is a .cmd
      // script, not a binary, so execFileSync cannot resolve it without the
      // shell (see tests/lib/migrate-v0.4.test.ts for the same pattern).
      const result = spawnSync("npx", ["tsx", SCRIPT, ...args], {
        encoding: "utf8",
        shell: true,
        cwd: resolve("."),
      });
      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        exitCode: result.status ?? 1,
      };
    }

    it("prints a friendly message and exits non-zero on a non-numeric --checks value", () => {
      const { stderr, exitCode } = runCli(["--checks", "foo"]);

      expect(exitCode).not.toBe(0);
      expect(stderr).toContain(
        "--checks expects a comma-separated list of check numbers, got: foo",
      );
    });

    it("still parses and runs a valid comma-separated --checks list", () => {
      // Check 13 (skill-creator-probe) needs no DB — safe against production DB.
      const { stdout, exitCode } = runCli(["--checks", "13"]);

      expect(exitCode).toBe(0);
      const results = JSON.parse(stdout) as Array<{ check: number; name: string }>;
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ check: 13, name: "skill-creator-probe" });
    });
  });
});
