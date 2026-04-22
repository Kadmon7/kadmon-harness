import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  deleteSession,
  insertHookEvent,
  getHookEventsBySession,
  getHookEventStats,
} from "../../scripts/lib/state-store.js";

describe("state-store hook_events", () => {
  beforeEach(async () => {
    await openDb(":memory:");
    upsertSession({ id: "s1", projectHash: "p1" });
  });

  afterEach(() => {
    closeDb();
  });

  it("inserts and retrieves a hook event", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "no-context-guard",
      eventType: "pre_tool",
      toolName: "Edit",
      exitCode: 2,
      blocked: true,
      durationMs: 45,
      timestamp: "2026-01-01T00:00:00Z",
    });

    const events = getHookEventsBySession("s1");
    expect(events).toHaveLength(1);
    expect(events[0].hookName).toBe("no-context-guard");
    expect(events[0].eventType).toBe("pre_tool");
    expect(events[0].toolName).toBe("Edit");
    expect(events[0].exitCode).toBe(2);
    expect(events[0].blocked).toBe(true);
    expect(events[0].durationMs).toBe(45);
  });

  it("returns empty array for session with no hook events", () => {
    expect(getHookEventsBySession("s1")).toHaveLength(0);
  });

  it("returns events ordered by timestamp", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-a",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:02:00Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-b",
      eventType: "post_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:01:00Z",
    });

    const events = getHookEventsBySession("s1");
    expect(events).toHaveLength(2);
    expect(events[0].hookName).toBe("hook-b"); // earlier timestamp first
    expect(events[1].hookName).toBe("hook-a");
  });

  it("handles optional fields as undefined", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "observe-pre",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:00:00Z",
    });

    const events = getHookEventsBySession("s1");
    expect(events[0].toolName).toBeUndefined();
    expect(events[0].durationMs).toBeUndefined();
    expect(events[0].error).toBeUndefined();
  });

  it("stores error messages", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "commit-quality",
      eventType: "pre_tool",
      exitCode: 2,
      blocked: true,
      error: "Found console.log in production code",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const events = getHookEventsBySession("s1");
    expect(events[0].error).toBe("Found console.log in production code");
  });

  it("cascade deletes hook events when session is deleted", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-a",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-b",
      eventType: "post_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:01:00Z",
    });

    deleteSession("s1");
    expect(getHookEventsBySession("s1")).toHaveLength(0);
  });

  it("computes hook event stats by project", () => {
    upsertSession({ id: "s2", projectHash: "p1" });

    insertHookEvent({
      sessionId: "s1",
      hookName: "no-context-guard",
      eventType: "pre_tool",
      exitCode: 2,
      blocked: true,
      durationMs: 30,
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "no-context-guard",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      durationMs: 20,
      timestamp: "2026-01-01T00:01:00Z",
    });
    insertHookEvent({
      sessionId: "s2",
      hookName: "observe-pre",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      durationMs: 10,
      timestamp: "2026-01-01T00:02:00Z",
    });

    const stats = getHookEventStats("p1");
    expect(stats).toHaveLength(2);

    const ncgStats = stats.find((s) => s.hookName === "no-context-guard");
    expect(ncgStats).toBeDefined();
    expect(ncgStats!.total).toBe(2);
    expect(ncgStats!.blocks).toBe(1);
    expect(ncgStats!.avgDurationMs).toBe(25);

    const obsStats = stats.find((s) => s.hookName === "observe-pre");
    expect(obsStats).toBeDefined();
    expect(obsStats!.total).toBe(1);
    expect(obsStats!.blocks).toBe(0);
  });

  it("filters stats by since parameter", () => {
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-a",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertHookEvent({
      sessionId: "s1",
      hookName: "hook-a",
      eventType: "pre_tool",
      exitCode: 0,
      blocked: false,
      timestamp: "2026-06-01T00:00:00Z",
    });

    const stats = getHookEventStats("p1", "2026-03-01T00:00:00Z");
    expect(stats).toHaveLength(1);
    expect(stats[0].total).toBe(1);
  });

  describe("dedup via UNIQUE INDEX (natural key)", () => {
    it("collapses exact duplicates to a single row", () => {
      const payload = {
        sessionId: "s1",
        hookName: "git-push-reminder",
        eventType: "pre_tool" as const,
        toolName: "Bash",
        exitCode: 1,
        blocked: false,
        durationMs: 12,
        timestamp: "2026-04-22T02:00:00.000Z",
      };

      insertHookEvent(payload);
      insertHookEvent(payload);
      insertHookEvent(payload);

      expect(getHookEventsBySession("s1")).toHaveLength(1);
    });

    it("allows different timestamps for the same hook to coexist", () => {
      insertHookEvent({
        sessionId: "s1",
        hookName: "ts-review-reminder",
        eventType: "post_tool",
        exitCode: 0,
        blocked: false,
        timestamp: "2026-04-22T02:00:00.000Z",
      });
      insertHookEvent({
        sessionId: "s1",
        hookName: "ts-review-reminder",
        eventType: "post_tool",
        exitCode: 0,
        blocked: false,
        timestamp: "2026-04-22T02:00:00.001Z",
      });

      expect(getHookEventsBySession("s1")).toHaveLength(2);
    });

    it("allows different event_type at the same timestamp to coexist", () => {
      const ts = "2026-04-22T02:00:00.000Z";
      insertHookEvent({
        sessionId: "s1",
        hookName: "observe-pre",
        eventType: "pre_tool",
        exitCode: 0,
        blocked: false,
        timestamp: ts,
      });
      insertHookEvent({
        sessionId: "s1",
        hookName: "observe-pre",
        eventType: "post_tool",
        exitCode: 0,
        blocked: false,
        timestamp: ts,
      });

      expect(getHookEventsBySession("s1")).toHaveLength(2);
    });
  });
});
