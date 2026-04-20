// TDD [feniks] — plan-010 Phase 1 Step 1.1 — RED phase
// Tests for KADMON_RUNTIME_ROOT primitive in resolveRootDir and hook dynamic imports.
//
// Step 1.2 (NOT this file): implement env-var branch in resolveRootDir.
// Steps 1.3-1.6 (NOT this file): refactor hook dynamic imports to use resolveRootDir.
//
// RED/GREEN forecast per test:
//   Tests 1-2: RED today (resolveRootDir ignores env var). GREEN after Step 1.2.
//   Tests 3-4: GREEN today AND after Step 1.2 (fallback contract, must stay green).
//   Tests 5-8: RED today (fixture probe shows hooks load from real dist, not fixture).
//              GREEN after Steps 1.3-1.6.
//   Tests 9-10: RED today (hooks load from real dist → no broken-fixture error in output).
//               GREEN after Steps 1.3-1.4.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// ─── Paths ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(".");
const ENSURE_DIST = path.resolve(".claude/hooks/scripts/ensure-dist.js");
const HOOK_SESSION_START = path.resolve(".claude/hooks/scripts/session-start.js");
const HOOK_SESSION_END = path.resolve(".claude/hooks/scripts/session-end-all.js");
const HOOK_PRE_COMPACT = path.resolve(".claude/hooks/scripts/pre-compact-save.js");

// ─── Fixture stub content ────────────────────────────────────────────────────
// Each stub exports the same named exports as the real module PLUS a SENTINEL.
// SENTINEL proves which module was actually loaded at runtime.

const STATE_STORE_STUB = `
export const SENTINEL = "fixture-state-store";
export async function openDb() {}
export function getDb() {
  return {
    transaction: (fn) => (...args) => fn(...args),
    prepare: () => ({ run: () => {}, all: () => [], get: () => null }),
  };
}
export function closeDb() {}
export function upsertSession(s) { return s; }
export function getSession() { return null; }
export function getRecentSessions() { return []; }
export function getOrphanedSessions() { return []; }
export function deleteSession() {}
export function cleanupTestSessions() {}
export function upsertInstinct(i) { return i; }
export function getInstinct() { return null; }
export function getActiveInstincts() { return []; }
export function getCrossProjectPromotionCandidates() { return []; }
export function getPromotableInstincts() { return []; }
export function getInstinctCounts() { return {}; }
export function insertCostEvent() {}
export function getCostBySession() { return []; }
export function getCostSummaryByModel() { return []; }
export function queueSync() {}
export function getPendingSync() { return []; }
export function markSynced() {}
export function insertHookEvent() {}
export function getHookEventsBySession() { return []; }
export function getHookEventStats() { return []; }
export function clearSessionEndState() {}
export function insertAgentInvocation() {}
export function getAgentInvocationsBySession() { return []; }
export function getAgentInvocationStats() { return []; }
export function hasFTS5Support() { return false; }
export function _resetFTS5Cache() {}
export function createResearchReport(i) { return i; }
export function getResearchReport() { return null; }
export function getLastResearchReport() { return null; }
export function queryResearchReports() { return []; }
`;

const SESSION_MANAGER_STUB = `
export const SENTINEL = "fixture-session-manager";
export function startSession(id) {
  return { id, compactionCount: 0, messageCount: 0, filesModified: [], toolsUsed: [], tasks: [] };
}
export function endSession() { return null; }
export function getLastSession() { return null; }
`;

const INSTINCT_MANAGER_STUB = `
export const SENTINEL = "fixture-instinct-manager";
export function createInstinct() {}
export function reinforceInstinct() {}
export function contradictInstinct() {}
export function promoteInstinct() {}
export function pruneInstincts() { return 0; }
export function decayInstincts() { return { decayed: 0, totalLoss: 0 }; }
export function promoteToGlobal() { return 0; }
export function getInstinctSummary() { return "No active instincts."; }
`;

const COST_CALCULATOR_STUB = `
export const SENTINEL = "fixture-cost-calculator";
export function estimateCharsPerToken() { return 4; }
export function calculateCost() { return { totalCostUsd: 0, inputCostUsd: 0, outputCostUsd: 0 }; }
export function formatCost() { return "$0.0000"; }
`;

const PATTERN_ENGINE_STUB = `
export const SENTINEL = "fixture-pattern-engine";
export function detectSequence() { return false; }
export function detectCommandSequence() { return false; }
export function detectFileSequencePattern() { return false; }
export function detectToolArgPresencePattern() { return false; }
export function detectCluster() { return false; }
export function evaluatePatterns() { return []; }
export function loadPatternDefinitions() { return []; }
`;

// Broken state-store: openDb() throws a distinctive sentinel error.
// getActiveInstincts() and pruneInstincts() also throw their own sentinels so
// that Test 12 (evaluate-patterns-shared probe) can detect fixture load without
// relying on openDb() — evaluate-patterns-shared never calls openDb().
//
// Tests 9-11 are NOT affected by the getActiveInstincts/pruneInstincts throws
// because openDb() always throws FIRST in those hooks, so those calls never
// execute in the broken-fixture path.
const BROKEN_STATE_STORE_STUB = `
export const SENTINEL = "broken-fixture-state-store";
export async function openDb() {
  throw new Error("BROKEN_FIXTURE_SENTINEL_openDb_was_called");
}
export function getDb() { return null; }
export function closeDb() {}
export function upsertSession() {}
export function getSession() { return null; }
export function getRecentSessions() { return []; }
export function getOrphanedSessions() { return []; }
export function deleteSession() {}
export function cleanupTestSessions() {}
export function upsertInstinct() {}
export function getInstinct() { return null; }
export function getActiveInstincts() {
  throw new Error("BROKEN_FIXTURE_SENTINEL_getActiveInstincts_was_called");
}
export function pruneInstincts() {
  throw new Error("BROKEN_FIXTURE_SENTINEL_pruneInstincts_was_called");
}
export function getCrossProjectPromotionCandidates() { return []; }
export function getPromotableInstincts() { return []; }
export function getInstinctCounts() { return {}; }
export function insertCostEvent() {}
export function getCostBySession() { return []; }
export function getCostSummaryByModel() { return []; }
export function queueSync() {}
export function getPendingSync() { return []; }
export function markSynced() {}
export function insertHookEvent() {}
export function getHookEventsBySession() { return []; }
export function getHookEventStats() { return []; }
export function clearSessionEndState() {}
export function insertAgentInvocation() {}
export function getAgentInvocationsBySession() { return []; }
export function getAgentInvocationStats() { return []; }
export function hasFTS5Support() { return false; }
export function _resetFTS5Cache() {}
export function createResearchReport(i) { return i; }
export function getResearchReport() { return null; }
export function getLastResearchReport() { return null; }
export function queryResearchReports() { return []; }
`;

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function populateLibDir(libDir: string, stateStoreContent: string): void {
  fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(path.join(libDir, "state-store.js"), stateStoreContent);
  fs.writeFileSync(path.join(libDir, "session-manager.js"), SESSION_MANAGER_STUB);
  fs.writeFileSync(path.join(libDir, "instinct-manager.js"), INSTINCT_MANAGER_STUB);
  fs.writeFileSync(path.join(libDir, "cost-calculator.js"), COST_CALCULATOR_STUB);
  fs.writeFileSync(path.join(libDir, "pattern-engine.js"), PATTERN_ENGINE_STUB);
}

function createWorkingFixtureDir(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-runtime-root-"));
  populateLibDir(path.join(tmpDir, "dist", "scripts", "lib"), STATE_STORE_STUB);
  return tmpDir;
}

function createBrokenFixtureDir(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-broken-fixture-"));
  populateLibDir(path.join(tmpDir, "dist", "scripts", "lib"), BROKEN_STATE_STORE_STUB);
  return tmpDir;
}

// ─── Hook runner ──────────────────────────────────────────────────────────────

function runHook(
  hookPath: string,
  input: object,
  fixtureRootDir: string,
): { stdout: string; stderr: string; exitCode: number } {
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    KADMON_RUNTIME_ROOT: fixtureRootDir,
    KADMON_TEST_DB: ":memory:",
  };
  // spawnSync returns BOTH stdout and stderr — execFileSync discards stderr on
  // success, masking the broken-fixture sentinel that hooks log via console.error.
  const result = spawnSync("node", [hookPath], {
    encoding: "utf8",
    input: JSON.stringify(input),
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 30_000,
    cwd: REPO_ROOT,
    env,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

// Probe script: simulates the refactored hook import logic.
// Imports a module from path.join(resolveRootDir(import.meta.url), "dist/scripts/lib/X.js")
// where resolveRootDir honours KADMON_RUNTIME_ROOT. Exits 0 if SENTINEL found, 1 otherwise.
function buildProbeScript(moduleName: string): string {
  return `
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const envRoot = process.env.KADMON_RUNTIME_ROOT;
// resolveRootDir logic (post-refactor contract):
const resolvedRoot = (envRoot && envRoot.length > 0)
  ? path.resolve(envRoot)
  : path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");

const modulePath = path.join(resolvedRoot, "dist", "scripts", "lib", ${JSON.stringify(moduleName)});

try {
  const mod = await import(pathToFileURL(modulePath).href);
  if (mod.SENTINEL) {
    process.stdout.write("SENTINEL=" + mod.SENTINEL + "\\n");
    process.exit(0);
  } else {
    process.stderr.write("NO_SENTINEL\\n");
    process.exit(1);
  }
} catch (err) {
  process.stderr.write("IMPORT_ERROR: " + String(err.message) + "\\n");
  process.exit(1);
}
`;
}

function runProbeScript(
  scriptContent: string,
  fixtureRootDir: string,
): { stdout: string; stderr: string; exitCode: number } {
  // Write to temp file — npx tsx -e produces no output on Windows (harness memory pattern)
  const probeFile = path.join(os.tmpdir(), `kadmon-probe-${Date.now()}.mjs`);
  try {
    fs.writeFileSync(probeFile, scriptContent);
    try {
      const stdout = execFileSync("node", [probeFile], {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 15_000,
        env: {
          ...process.env as Record<string, string>,
          KADMON_RUNTIME_ROOT: fixtureRootDir,
        },
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? "",
        exitCode: e.status ?? 1,
      };
    }
  } finally {
    try { fs.unlinkSync(probeFile); } catch { /* ignore */ }
  }
}

// ─── Shared stdin payloads ────────────────────────────────────────────────────

const SESSION_INPUT = {
  session_id: "test-runtime-root-fixture",
  cwd: REPO_ROOT,
  transcript_path: "",
};

// ─── State — env var save/restore ────────────────────────────────────────────

let savedEnvVar: string | undefined;

beforeEach(() => {
  savedEnvVar = process.env.KADMON_RUNTIME_ROOT;
});

afterEach(() => {
  if (savedEnvVar === undefined) {
    delete process.env.KADMON_RUNTIME_ROOT;
  } else {
    process.env.KADMON_RUNTIME_ROOT = savedEnvVar;
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests 1-4: Unit — resolveRootDir env-var branch
// ═══════════════════════════════════════════════════════════════════════════════

describe("resolveRootDir — KADMON_RUNTIME_ROOT primitive", () => {
  // Dynamic imports use ?t= cache-busters so each test gets a fresh module.
  // resolveRootDir reads process.env at call time, not at import time —
  // so the env var set before the call is what matters.

  it(
    // Test 1 — RED today: current resolveRootDir ignores env var → returns 3-level walk,
    // not fixtureDir. Becomes GREEN after Step 1.2.
    "returns KADMON_RUNTIME_ROOT (absolute) when set to an absolute path",
    async () => {
      // Arrange
      const fixtureDir = createWorkingFixtureDir();
      try {
        process.env.KADMON_RUNTIME_ROOT = fixtureDir;

        // metaUrl from an unrelated location so the 3-level walk produces a DIFFERENT path.
        // os.tmpdir()/some-other-project/.claude/hooks/scripts/X.js → 3 levels up → os.tmpdir()/some-other-project
        // fixtureDir is mkdtempSync → different name → never equal to os.tmpdir()/some-other-project.
        const fakeMetaUrl = pathToFileURL(
          path.join(os.tmpdir(), "some-other-project", ".claude", "hooks", "scripts", "x.js"),
        ).href;

        const { resolveRootDir } = await import(`${pathToFileURL(ENSURE_DIST).href}?t=1`);

        // Act
        const result = resolveRootDir(fakeMetaUrl);

        // Confirm the 3-level walk would give a DIFFERENT result (test is meaningful)
        const threeLevel = path.resolve(
          fileURLToPath(new URL(".", fakeMetaUrl)), "..", "..", "..",
        );
        expect(threeLevel).not.toBe(path.resolve(fixtureDir));

        // Assert: env var must take precedence
        expect(result).toBe(path.resolve(fixtureDir));
      } finally {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    },
  );

  it(
    // Test 2 — RED today: current resolveRootDir ignores env var → 3-level walk result.
    // The 3-level walk from a tmpdir path is NOT equal to path.resolve(relPath).
    // Becomes GREEN after Step 1.2.
    "resolves relative KADMON_RUNTIME_ROOT to absolute via path.resolve",
    async () => {
      // Arrange: use a relative path to fixtureDir (relative to cwd = REPO_ROOT)
      const fixtureDir = createWorkingFixtureDir();
      try {
        const relPath = path.relative(process.cwd(), fixtureDir);
        // If fixtureDir is on a different drive than cwd (Windows edge case),
        // path.relative produces an absolute path — that's fine, test still works.
        process.env.KADMON_RUNTIME_ROOT = relPath;

        // metaUrl from deep inside os.tmpdir() so 3-level walk ≠ path.resolve(relPath)
        const fakeMetaUrl = pathToFileURL(
          path.join(os.tmpdir(), "some-other-project", ".claude", "hooks", "scripts", "x.js"),
        ).href;

        const { resolveRootDir } = await import(`${pathToFileURL(ENSURE_DIST).href}?t=2`);

        // Act
        const result = resolveRootDir(fakeMetaUrl);

        // Assert: path.resolve(relPath) is the expected result — not 3-level walk
        expect(result).toBe(path.resolve(relPath));
      } finally {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
      }
    },
  );

  it(
    // Test 3 — GREEN today AND after Step 1.2. Documents the fallback contract.
    "falls back to 3-level walk when KADMON_RUNTIME_ROOT is unset",
    async () => {
      // Arrange
      delete process.env.KADMON_RUNTIME_ROOT;
      const realMetaUrl = pathToFileURL(HOOK_SESSION_START).href;

      const { resolveRootDir } = await import(`${pathToFileURL(ENSURE_DIST).href}?t=3`);

      // Act
      const result = resolveRootDir(realMetaUrl);

      // Assert: 3-level walk from .claude/hooks/scripts/session-start.js = REPO_ROOT
      const expected = path.resolve(
        fileURLToPath(new URL(".", realMetaUrl)), "..", "..", "..",
      );
      expect(result).toBe(expected);
      expect(result).toBe(path.resolve(REPO_ROOT));
    },
  );

  it(
    // Test 4 — GREEN today AND after Step 1.2 (empty string must be treated as unset).
    "falls back to 3-level walk when KADMON_RUNTIME_ROOT is empty string",
    async () => {
      // Arrange
      process.env.KADMON_RUNTIME_ROOT = "";
      const realMetaUrl = pathToFileURL(HOOK_SESSION_START).href;

      const { resolveRootDir } = await import(`${pathToFileURL(ENSURE_DIST).href}?t=4`);

      // Act
      const result = resolveRootDir(realMetaUrl);

      // Assert: empty string is skipped → fallback 3-level walk
      const expected = path.resolve(
        fileURLToPath(new URL(".", realMetaUrl)), "..", "..", "..",
      );
      expect(result).toBe(expected);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests 5-8: Probe — verify fixture stubs are reachable via env var resolution
//
// These probes simulate the POST-refactor hook import logic:
//   resolvedRoot = KADMON_RUNTIME_ROOT → path.join(resolvedRoot, "dist/scripts/lib/X.js")
//
// Today: probes PASS (fixture stubs are correctly set up and reachable via env var).
// After Steps 1.3-1.6: probes still pass, AND the hooks themselves use this logic.
//
// Why include these if they're GREEN today? They document the fixture contract
// and catch any breakage in the stub files before the hook refactor step runs.
// They become the baseline for "env-var resolution works" that Step 1.3+ builds on.
// ═══════════════════════════════════════════════════════════════════════════════

describe("fixture probe — stubs are reachable via KADMON_RUNTIME_ROOT", () => {
  let fixtureDir: string;

  beforeEach(() => {
    fixtureDir = createWorkingFixtureDir();
  });

  afterEach(() => {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it(
    // Test 5 — GREEN today: state-store.js fixture has SENTINEL and is reachable
    "state-store.js fixture exports SENTINEL when loaded via KADMON_RUNTIME_ROOT path",
    () => {
      const result = runProbeScript(buildProbeScript("state-store.js"), fixtureDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("SENTINEL=fixture-state-store");
    },
  );

  it(
    // Test 6 — GREEN today: cost-calculator.js fixture has SENTINEL
    "cost-calculator.js fixture exports SENTINEL when loaded via KADMON_RUNTIME_ROOT path",
    () => {
      const result = runProbeScript(buildProbeScript("cost-calculator.js"), fixtureDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("SENTINEL=fixture-cost-calculator");
    },
  );

  it(
    // Test 7 — GREEN today: instinct-manager.js fixture has SENTINEL
    "instinct-manager.js fixture exports SENTINEL when loaded via KADMON_RUNTIME_ROOT path",
    () => {
      const result = runProbeScript(buildProbeScript("instinct-manager.js"), fixtureDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("SENTINEL=fixture-instinct-manager");
    },
  );

  it(
    // Test 8 — GREEN today: pattern-engine.js fixture has SENTINEL
    "pattern-engine.js fixture exports SENTINEL when loaded via KADMON_RUNTIME_ROOT path",
    () => {
      const result = runProbeScript(buildProbeScript("pattern-engine.js"), fixtureDir);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("SENTINEL=fixture-pattern-engine");
    },
  );

  it(
    // Test 8b — Windows path safety: KADMON_RUNTIME_ROOT containing a literal space
    // must resolve to a working file URL via pathToFileURL. Protects against the
    // "C:\Users\Joe Doe\.claude\plugins\kadmon\" failure class flagged by spektr.
    // GREEN today AND post-refactor — this is a Node API contract test, not a
    // hook integration test.
    "KADMON_RUNTIME_ROOT with embedded space resolves to a working import URL",
    () => {
      const baseTmp = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-space-"));
      const spacedDir = path.join(baseTmp, "dir with space");
      fs.mkdirSync(spacedDir);
      populateLibDir(path.join(spacedDir, "dist", "scripts", "lib"), STATE_STORE_STUB);
      try {
        const result = runProbeScript(buildProbeScript("state-store.js"), spacedDir);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("SENTINEL=fixture-state-store");
      } finally {
        fs.rmSync(baseTmp, { recursive: true, force: true });
      }
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests 9-10: Integration — hooks must honour KADMON_RUNTIME_ROOT for imports
//
// Strategy: broken fixture whose openDb() throws a DISTINCTIVE error string.
//   Before refactor: hooks use hardcoded relative URL → load from REAL dist →
//     openDb() from real state-store succeeds → sentinel string ABSENT from output.
//     → test asserts sentinel IS present → FAILS (RED).
//   After refactor: hooks use resolveRootDir + env var → load from broken fixture →
//     openDb() throws → hook catches it and logs the distinctive error to stderr →
//     sentinel IS present → test PASSES (GREEN).
//
// Hooks are contractually required to exit 0 even on db errors (safety rule),
// so we cannot use exit code as the discriminator. The sentinel in output is the
// only reliable signal.
// ═══════════════════════════════════════════════════════════════════════════════

describe("hook import isolation — broken fixture proves env-var is honoured", () => {
  let brokenFixtureDir: string;

  beforeEach(() => {
    brokenFixtureDir = createBrokenFixtureDir();
  });

  afterEach(() => {
    fs.rmSync(brokenFixtureDir, { recursive: true, force: true });
  });

  it(
    // Test 9 — RED today: session-start.js loads from real dist (ignores env var)
    // → real openDb() succeeds → BROKEN_FIXTURE_SENTINEL absent from output → assertion fails.
    // GREEN after Step 1.3: hook uses env var → broken openDb() throws →
    // → hook logs the error containing BROKEN_FIXTURE_SENTINEL → assertion passes.
    "session-start.js uses KADMON_RUNTIME_ROOT for db import: broken fixture error appears in output",
    () => {
      const result = runHook(HOOK_SESSION_START, SESSION_INPUT, brokenFixtureDir);

      // Hook must never exit non-zero (safety rule — always)
      expect(result.exitCode).toBe(0);

      // RED assertion: BROKEN_FIXTURE_SENTINEL must appear in combined output.
      // Currently FAILS because the hook loads from real dist, not broken fixture.
      const combined = result.stdout + result.stderr;
      expect(combined).toContain("BROKEN_FIXTURE_SENTINEL");
    },
  );

  it(
    // Test 10 — RED today: session-end-all.js loads from real dist (ignores env var)
    // → real openDb() succeeds → BROKEN_FIXTURE_SENTINEL absent from output → assertion fails.
    // GREEN after Step 1.4: same mechanism as Test 9.
    "session-end-all.js uses KADMON_RUNTIME_ROOT for db import: broken fixture error appears in output",
    () => {
      const result = runHook(HOOK_SESSION_END, SESSION_INPUT, brokenFixtureDir);

      expect(result.exitCode).toBe(0);

      const combined = result.stdout + result.stderr;
      expect(combined).toContain("BROKEN_FIXTURE_SENTINEL");
    },
  );

  it(
    // Test 11 — RED today: pre-compact-save.js loads from real dist (ignores env var)
    // → real openDb() succeeds → BROKEN_FIXTURE_SENTINEL absent from output → assertion fails.
    // GREEN after Step 1.5: hook uses env var → broken openDb() throws →
    // → hook catches error and logs it containing BROKEN_FIXTURE_SENTINEL → assertion passes.
    "pre-compact-save.js uses KADMON_RUNTIME_ROOT for db import: broken fixture error appears in output",
    () => {
      const result = runHook(HOOK_PRE_COMPACT, SESSION_INPUT, brokenFixtureDir);

      // Hook must never exit non-zero (safety rule — always)
      expect(result.exitCode).toBe(0);

      // RED assertion: BROKEN_FIXTURE_SENTINEL must appear in combined output.
      // Currently FAILS because the hook loads from real dist, not broken fixture.
      const combined = result.stdout + result.stderr;
      expect(combined).toContain("BROKEN_FIXTURE_SENTINEL");
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test 12: Integration — evaluate-patterns-shared.js must honour KADMON_RUNTIME_ROOT
//
// Strategy: evaluate-patterns-shared.js never calls openDb() — it calls
// getActiveInstincts() directly (state-store), plus createInstinct/reinforceInstinct
// (instinct-manager), and evaluatePatterns/loadPatternDefinitions (pattern-engine).
//
// BROKEN_STATE_STORE_STUB.getActiveInstincts() throws BROKEN_FIXTURE_SENTINEL.
// If evaluate-patterns-shared.js honours KADMON_RUNTIME_ROOT, it will load the
// broken fixture's state-store → getActiveInstincts() throws → probe catches and
// prints to stderr → sentinel appears → test PASSES.
//
// Today: module uses hardcoded relative import.meta.url path → loads real dist →
// real getActiveInstincts() returns [] → no throw → sentinel absent → RED.
// After Step 1.6: module honours env var → broken fixture loads → RED → GREEN.
// ═══════════════════════════════════════════════════════════════════════════════

const EVAL_PATTERNS_SHARED = path.resolve(
  ".claude/hooks/scripts/evaluate-patterns-shared.js",
);

describe("evaluate-patterns-shared.js import isolation — broken fixture proves env-var is honoured", () => {
  let brokenFixtureDir: string;
  let obsDir: string;
  let obsPath: string;
  const probeSid = "test-eval-patterns-probe";

  beforeEach(() => {
    brokenFixtureDir = createBrokenFixtureDir();
    // Pre-create observations.jsonl with 12 tool_pre lines to pass the minLines guard.
    // evaluate-patterns-shared.js reads os.tmpdir()/kadmon/<sid>/observations.jsonl.
    obsDir = path.join(os.tmpdir(), "kadmon", probeSid);
    obsPath = path.join(obsDir, "observations.jsonl");
    fs.mkdirSync(obsDir, { recursive: true });
    const toolPreLine = JSON.stringify({ eventType: "tool_pre", toolName: "Read" });
    fs.writeFileSync(obsPath, Array.from({ length: 12 }, () => toolPreLine).join("\n") + "\n");
  });

  afterEach(() => {
    fs.rmSync(brokenFixtureDir, { recursive: true, force: true });
    try { fs.rmSync(obsDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it(
    // Test 12 — RED today: evaluate-patterns-shared.js uses hardcoded relative URL →
    // loads real dist state-store → real getActiveInstincts() returns [] (no throw) →
    // BROKEN_FIXTURE_SENTINEL absent from probe stderr → assertion fails.
    // GREEN after Step 1.6: module honours env var → broken fixture's getActiveInstincts
    // throws BROKEN_FIXTURE_SENTINEL → probe catches it → sentinel appears → assertion passes.
    "evaluate-patterns-shared.js uses KADMON_RUNTIME_ROOT for state-store import: broken fixture error appears in output",
    () => {
      // Build a probe script that:
      // 1. Imports the REAL evaluate-patterns-shared.js (not a stub)
      // 2. Calls evaluateAndApplyPatterns() — this triggers the dynamic imports
      // 3. Catches any error and prints it to stderr so we can detect the sentinel
      // Note: REPO_ROOT is passed as cwd so git remote get-url succeeds (needed to
      // get past the early-return guard on line 56 of evaluate-patterns-shared.js).
      const probeScript = `
import { pathToFileURL } from "node:url";
import path from "node:path";

const evalPatternsSharedPath = ${JSON.stringify(EVAL_PATTERNS_SHARED)};
const repoRoot = ${JSON.stringify(REPO_ROOT)};
const sid = ${JSON.stringify(probeSid)};

try {
  const mod = await import(pathToFileURL(evalPatternsSharedPath).href);
  // minLines=10 — observations.jsonl has 12 lines so the guard is passed.
  // cwd=repoRoot so git remote get-url origin succeeds (needed to compute projectHash).
  await mod.evaluateAndApplyPatterns(sid, repoRoot, 10);
  // If we get here without throwing, the sentinel was NOT triggered.
  // Exit 0 so the test can detect absence of sentinel via stderr content alone.
  process.exit(0);
} catch (err) {
  // Write the error message to stderr so the test can assert on sentinel content.
  process.stderr.write(String(err instanceof Error ? err.message : err) + "\\n");
  process.exit(1);
}
`;

      const result = runProbeScript(probeScript, brokenFixtureDir);

      // RED assertion: BROKEN_FIXTURE_SENTINEL must appear in stderr.
      // Currently FAILS because the module loads from real dist.
      // The probe exits 1 only when the broken fixture throws; check both paths.
      const combined = result.stdout + result.stderr;
      expect(combined).toContain("BROKEN_FIXTURE_SENTINEL");
    },
  );
});
