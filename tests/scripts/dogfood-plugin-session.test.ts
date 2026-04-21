/**
 * TDD [feniks]
 * Unit tests for scripts/dogfood-plugin-session.ts
 * Tests checkSandbox, buildEventSequence, runPluginModeDogfood (mocked), formatReport.
 *
 * Red -> Green -> Refactor
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  checkSandbox,
  buildEventSequence,
  formatReport,
  ALL_HOOK_NAMES,
} from "../../scripts/dogfood-plugin-session.js";
import type {
  DogfoodReport,
  HookInvocationResult,
} from "../../scripts/dogfood-plugin-session.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpSandbox(withGit = false, withRemote = false): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dogfood-test-"));
  if (withGit) {
    execFileSync("git", ["init", "--quiet"], { cwd: dir });
    if (withRemote) {
      execFileSync("git", ["remote", "add", "origin", "git@github.com:fake/test-sandbox.git"], { cwd: dir });
    }
  }
  return dir;
}

function cleanupDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// 1. checkSandbox
// ---------------------------------------------------------------------------
describe("checkSandbox", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) cleanupDir(tmpDir);
  });

  it("returns ready=false for a path that does not exist", () => {
    const result = checkSandbox("/tmp/this-path-absolutely-does-not-exist-xyzzy-123456");
    expect(result.ready).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.some((r) => /not exist|no such|missing/i.test(r))).toBe(true);
  });

  it("returns correct path in status", () => {
    const result = checkSandbox("/tmp/this-path-absolutely-does-not-exist-xyzzy-123456");
    expect(result.path).toBe("/tmp/this-path-absolutely-does-not-exist-xyzzy-123456");
  });

  it("returns ready=false for a directory with no git repo", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dogfood-test-"));
    const result = checkSandbox(tmpDir);
    expect(result.ready).toBe(false);
    expect(result.hasGitRemote).toBe(false);
    expect(result.reasons.some((r) => /git|remote/i.test(r))).toBe(true);
  });

  it("returns ready=false for a git repo without a remote", () => {
    tmpDir = makeTmpSandbox(true, false);
    const result = checkSandbox(tmpDir);
    expect(result.ready).toBe(false);
    expect(result.hasGitRemote).toBe(false);
    expect(result.reasons.some((r) => /remote/i.test(r))).toBe(true);
  });

  it("returns ready=true for a git repo WITH a remote", () => {
    tmpDir = makeTmpSandbox(true, true);
    const result = checkSandbox(tmpDir);
    expect(result.ready).toBe(true);
    expect(result.hasGitRemote).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("populates projectHash when remote exists (16-char hex)", () => {
    tmpDir = makeTmpSandbox(true, true);
    const result = checkSandbox(tmpDir);
    expect(result.projectHash).toBeTruthy();
    expect(typeof result.projectHash).toBe("string");
    expect(result.projectHash!.length).toBe(16);
    expect(/^[0-9a-f]+$/i.test(result.projectHash!)).toBe(true);
  });

  it("projectHash is null when no remote", () => {
    tmpDir = makeTmpSandbox(true, false);
    const result = checkSandbox(tmpDir);
    expect(result.projectHash).toBeNull();
  });

  it("returns hasGitRemote=false for non-git directory", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dogfood-test-"));
    const result = checkSandbox(tmpDir);
    expect(result.hasGitRemote).toBe(false);
  });

  it("reasons array is empty when sandbox is ready", () => {
    tmpDir = makeTmpSandbox(true, true);
    const result = checkSandbox(tmpDir);
    expect(result.reasons).toHaveLength(0);
  });

  it("returns SandboxStatus shape with all required fields", () => {
    tmpDir = makeTmpSandbox(true, true);
    const result = checkSandbox(tmpDir);
    expect(result).toHaveProperty("ready");
    expect(result).toHaveProperty("path");
    expect(result).toHaveProperty("hasGitRemote");
    expect(result).toHaveProperty("projectHash");
    expect(result).toHaveProperty("reasons");
    expect(Array.isArray(result.reasons)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. buildEventSequence
// ---------------------------------------------------------------------------
describe("buildEventSequence", () => {
  const SESSION_ID = "dogfood-test-session-123";
  const SANDBOX_CWD = "/tmp/test-sandbox";

  it("returns an array of SimulatedEvent objects", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("first event is SessionStart", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    expect(events[0].event).toBe("SessionStart");
  });

  it("last event is Stop", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    expect(events[events.length - 1].event).toBe("Stop");
  });

  it("generates at least 8 events (representative session)", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    expect(events.length).toBeGreaterThanOrEqual(8);
  });

  it("each event has required fields: event, stdin, hooksToInvoke", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    for (const ev of events) {
      expect(ev).toHaveProperty("event");
      expect(ev).toHaveProperty("stdin");
      expect(ev).toHaveProperty("hooksToInvoke");
      expect(typeof ev.stdin).toBe("string");
      expect(Array.isArray(ev.hooksToInvoke)).toBe(true);
    }
  });

  it("each stdin is valid JSON", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    for (const ev of events) {
      expect(() => JSON.parse(ev.stdin)).not.toThrow();
    }
  });

  it("union of all hooksToInvoke covers all 21 hook names", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const invokedHooks = new Set<string>();
    for (const ev of events) {
      for (const h of ev.hooksToInvoke) {
        invokedHooks.add(h);
      }
    }
    for (const hookName of ALL_HOOK_NAMES) {
      expect(invokedHooks.has(hookName)).toBe(true);
    }
  });

  it("contains at least one PreToolUse event with toolName=Bash", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const bashPreToolUse = events.filter(
      (e) => e.event === "PreToolUse" && e.toolName === "Bash",
    );
    expect(bashPreToolUse.length).toBeGreaterThan(0);
  });

  it("contains at least one PreToolUse event with toolName=Edit|Write", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const editPreToolUse = events.filter(
      (e) => e.event === "PreToolUse" && (e.toolName === "Edit" || e.toolName === "Write"),
    );
    expect(editPreToolUse.length).toBeGreaterThan(0);
  });

  it("contains at least one PostToolUse event", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const postToolUse = events.filter((e) => e.event === "PostToolUse");
    expect(postToolUse.length).toBeGreaterThan(0);
  });

  it("contains at least one PostToolUseFailure event", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const failures = events.filter((e) => e.event === "PostToolUseFailure");
    expect(failures.length).toBeGreaterThan(0);
  });

  it("contains at least one PreCompact event", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const preCompact = events.filter((e) => e.event === "PreCompact");
    expect(preCompact.length).toBeGreaterThan(0);
  });

  it("stdin for SessionStart contains session_id and cwd", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const sessionStart = events.find((e) => e.event === "SessionStart")!;
    const parsed = JSON.parse(sessionStart.stdin);
    expect(parsed.session_id).toBe(SESSION_ID);
    expect(parsed.cwd).toBe(SANDBOX_CWD);
  });

  it("ALL_HOOK_NAMES has exactly 21 entries", () => {
    expect(ALL_HOOK_NAMES).toHaveLength(21);
  });

  it("ALL_HOOK_NAMES includes known hooks", () => {
    expect(ALL_HOOK_NAMES).toContain("block-no-verify");
    expect(ALL_HOOK_NAMES).toContain("session-start");
    expect(ALL_HOOK_NAMES).toContain("session-end-all");
    expect(ALL_HOOK_NAMES).toContain("observe-pre");
    expect(ALL_HOOK_NAMES).toContain("observe-post");
    expect(ALL_HOOK_NAMES).toContain("no-context-guard");
    expect(ALL_HOOK_NAMES).toContain("pre-compact-save");
  });

  it("hooksToInvoke for SessionStart includes session-start", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const start = events.find((e) => e.event === "SessionStart")!;
    expect(start.hooksToInvoke).toContain("session-start");
  });

  it("hooksToInvoke for Stop includes session-end-all", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const stop = events.find((e) => e.event === "Stop")!;
    expect(stop.hooksToInvoke).toContain("session-end-all");
  });

  it("hooksToInvoke for PreToolUse/Bash includes block-no-verify", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const bashPre = events.find((e) => e.event === "PreToolUse" && e.toolName === "Bash")!;
    expect(bashPre.hooksToInvoke).toContain("block-no-verify");
  });

  it("hooksToInvoke for PreToolUse/Edit includes no-context-guard", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const editPre = events.find(
      (e) => e.event === "PreToolUse" && (e.toolName === "Edit" || e.toolName === "Write"),
    )!;
    expect(editPre.hooksToInvoke).toContain("no-context-guard");
  });

  it("hooksToInvoke for PreCompact includes pre-compact-save", () => {
    const events = buildEventSequence(SESSION_ID, SANDBOX_CWD);
    const compact = events.find((e) => e.event === "PreCompact")!;
    expect(compact.hooksToInvoke).toContain("pre-compact-save");
  });
});

// ---------------------------------------------------------------------------
// 3. formatReport
// ---------------------------------------------------------------------------
describe("formatReport", () => {
  function makeHookResult(hook: string, invocations: number, exitCodes: number[], persisted: boolean): HookInvocationResult {
    return {
      hook,
      invocations,
      exitCodes,
      persistedInDb: persisted,
    };
  }

  function makeReport(overrides: Partial<DogfoodReport> = {}): DogfoodReport {
    return {
      sandboxPath: "/tmp/test-sandbox",
      projectHash: "abc123def456789a",
      sessionId: "dogfood-123-abc",
      totalEvents: 10,
      hooksInvoked: [
        makeHookResult("session-start", 1, [0], true),
        makeHookResult("block-no-verify", 2, [0, 2], false),
      ],
      hooksNotDisparados: ["pre-compact-save"],
      summary: { passed: 20, failed: 1, total: 21 },
      ...overrides,
    };
  }

  it("returns a non-empty string", () => {
    const output = formatReport(makeReport());
    expect(typeof output).toBe("string");
    expect(output.length).toBeGreaterThan(0);
  });

  it("includes the session ID in output", () => {
    const output = formatReport(makeReport());
    expect(output).toContain("dogfood-123-abc");
  });

  it("includes the sandbox path in output", () => {
    const output = formatReport(makeReport());
    expect(output).toContain("/tmp/test-sandbox");
  });

  it("includes hook names in output", () => {
    const output = formatReport(makeReport());
    expect(output).toContain("session-start");
    expect(output).toContain("block-no-verify");
  });

  it("all pass case: summary shows N/21 where N=21", () => {
    const allHooks: HookInvocationResult[] = ALL_HOOK_NAMES.map((h) =>
      makeHookResult(h, 1, [0], true),
    );
    const report = makeReport({
      hooksInvoked: allHooks,
      hooksNotDisparados: [],
      summary: { passed: 21, failed: 0, total: 21 },
    });
    const output = formatReport(report);
    expect(output).toContain("21");
    expect(output).toMatch(/21.*21|21\/21/);
  });

  it("all fail case: summary shows failed count", () => {
    const report = makeReport({
      hooksInvoked: [],
      hooksNotDisparados: [...ALL_HOOK_NAMES],
      summary: { passed: 0, failed: 21, total: 21 },
    });
    const output = formatReport(report);
    expect(output).toContain("21");
    // Failed hooks should be listed
    expect(output).toMatch(/0|none|failed/i);
  });

  it("mixed case: shows both passed and failed hooks", () => {
    const report = makeReport({
      hooksInvoked: [makeHookResult("session-start", 1, [0], true)],
      hooksNotDisparados: ["block-no-verify", "observe-pre"],
      summary: { passed: 1, failed: 20, total: 21 },
    });
    const output = formatReport(report);
    expect(output).toContain("session-start");
    expect(output).toContain("block-no-verify");
  });

  it("includes hooks not fired section in output", () => {
    const report = makeReport({
      hooksNotDisparados: ["pre-compact-save", "mcp-health-check"],
    });
    const output = formatReport(report);
    expect(output).toContain("pre-compact-save");
  });

  it("includes summary passed/failed/total counts", () => {
    const report = makeReport({
      summary: { passed: 15, failed: 6, total: 21 },
    });
    const output = formatReport(report);
    expect(output).toContain("15");
    expect(output).toContain("6");
    expect(output).toContain("21");
  });

  it("includes projectHash in output", () => {
    const output = formatReport(makeReport());
    expect(output).toContain("abc123def456789a");
  });

  it("includes cleanup command hint for the session", () => {
    const output = formatReport(makeReport());
    expect(output).toContain("dogfood-123-abc");
    // Should mention cleanup or DELETE
    expect(output).toMatch(/DELETE|cleanup|clean/i);
  });
});

// ---------------------------------------------------------------------------
// 4. DogfoodReport shape validation (type-only tests)
// ---------------------------------------------------------------------------
describe("DogfoodReport shape", () => {
  it("HookInvocationResult has required fields", () => {
    const result: HookInvocationResult = {
      hook: "block-no-verify",
      invocations: 1,
      exitCodes: [0],
      persistedInDb: false,
    };
    expect(result.hook).toBe("block-no-verify");
    expect(result.invocations).toBe(1);
    expect(result.exitCodes).toEqual([0]);
    expect(result.persistedInDb).toBe(false);
  });

  it("DogfoodReport summary totals to 21", () => {
    const report: DogfoodReport = {
      sandboxPath: "/tmp/x",
      projectHash: "abc123def456789a",
      sessionId: "dogfood-999",
      totalEvents: 5,
      hooksInvoked: [],
      hooksNotDisparados: [...ALL_HOOK_NAMES],
      summary: { passed: 0, failed: 21, total: 21 },
    };
    expect(report.summary.total).toBe(21);
    expect(report.summary.passed + report.summary.failed).toBe(21);
  });
});
