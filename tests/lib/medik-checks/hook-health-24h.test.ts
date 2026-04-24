// TDD [feniks] — Check #11 hook-health-24h (plan-028 Phase 4.4)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  openDb,
  closeDb,
  upsertSession,
  insertHookEvent,
} from "../../../scripts/lib/state-store.js";
import { runCheck } from "../../../scripts/lib/medik-checks/hook-health-24h.js";

const PROJECT = "hook-health-test-proj";

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("hook-health-24h check (#11)", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("returns PASS on empty hook_events table", () => {
    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/no hook health issues/i);
  });

  it("returns WARN when blocks > 0 in last 24h", () => {
    const sessionId = "sess-blocks";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    // Insert a blocking event (blocked = true)
    insertHookEvent({
      sessionId,
      hookName: "no-context-guard",
      eventType: "pre_tool",
      toolName: "Write",
      exitCode: 2,
      blocked: true,
      durationMs: 80,
      timestamp: nowIso(-1000 * 60 * 30), // 30 min ago
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("WARN");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/no-context-guard/);
  });

  it("returns WARN when avgDurationMs > budget for observe-pre (budget=50ms)", () => {
    const sessionId = "sess-slow-observe";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    // observe-pre budget = 50ms, seed with 80ms events (non-blocking)
    for (let i = 0; i < 3; i++) {
      insertHookEvent({
        sessionId,
        hookName: "observe-pre",
        eventType: "pre_tool",
        toolName: "Bash",
        exitCode: 0,
        blocked: false,
        durationMs: 80,
        timestamp: nowIso(-1000 * 60 * (10 + i)), // stagger timestamps
      });
    }

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/observe-pre/);
  });

  it("returns WARN when avgDurationMs > budget for no-context-guard (budget=100ms)", () => {
    const sessionId = "sess-slow-ncg";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    for (let i = 0; i < 3; i++) {
      insertHookEvent({
        sessionId,
        hookName: "no-context-guard",
        eventType: "pre_tool",
        toolName: "Edit",
        exitCode: 0,
        blocked: false,
        durationMs: 150, // > 100ms budget
        timestamp: nowIso(-1000 * 60 * (5 + i)),
      });
    }

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/no-context-guard/);
  });

  it("returns WARN when avgDurationMs > 500ms default budget for an unlisted hook", () => {
    const sessionId = "sess-slow-default";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    for (let i = 0; i < 3; i++) {
      insertHookEvent({
        sessionId,
        hookName: "commit-format-guard",
        eventType: "pre_tool",
        toolName: "Bash",
        exitCode: 0,
        blocked: false,
        durationMs: 600, // > 500ms default budget
        timestamp: nowIso(-1000 * 60 * (2 + i)),
      });
    }

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/commit-format-guard/);
  });

  it("returns PASS when hook duration is within budget", () => {
    const sessionId = "sess-fast";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    insertHookEvent({
      sessionId,
      hookName: "observe-pre",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 0,
      blocked: false,
      durationMs: 30, // well under 50ms budget
      timestamp: nowIso(-1000 * 60 * 5),
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });

  it("only looks at events from the last 24h (older events excluded)", () => {
    const sessionId = "sess-old";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    // Block event from 25h ago — should be excluded
    insertHookEvent({
      sessionId,
      hookName: "block-no-verify",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 2,
      blocked: true,
      durationMs: 50,
      timestamp: nowIso(-1000 * 60 * 60 * 25), // 25h ago
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });

  it("query contains LIMIT 100 (grep-assertable contract)", () => {
    const src = readFileSync(
      join(process.cwd(), "scripts/lib/medik-checks/hook-health-24h.ts"),
      "utf-8",
    );
    expect(src).toMatch(/LIMIT 100/);
  });
});
