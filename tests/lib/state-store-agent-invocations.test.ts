import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  deleteSession,
  insertAgentInvocation,
  getAgentInvocationsBySession,
  getAgentInvocationStats,
} from "../../scripts/lib/state-store.js";

describe("state-store agent_invocations", () => {
  beforeEach(async () => {
    await openDb(":memory:");
    upsertSession({ id: "s1", projectHash: "p1" });
  });

  afterEach(() => {
    closeDb();
  });

  it("inserts and retrieves an agent invocation", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      model: "sonnet",
      description: "Code review for commit",
      durationMs: 15000,
      success: true,
      timestamp: "2026-01-01T00:00:00Z",
    });

    const invocations = getAgentInvocationsBySession("s1");
    expect(invocations).toHaveLength(1);
    expect(invocations[0].agentType).toBe("kody");
    expect(invocations[0].model).toBe("sonnet");
    expect(invocations[0].description).toBe("Code review for commit");
    expect(invocations[0].durationMs).toBe(15000);
    expect(invocations[0].success).toBe(true);
  });

  it("returns empty array for session with no agent invocations", () => {
    expect(getAgentInvocationsBySession("s1")).toHaveLength(0);
  });

  it("returns invocations ordered by timestamp", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "spektr",
      timestamp: "2026-01-01T00:02:00Z",
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      timestamp: "2026-01-01T00:01:00Z",
    });

    const invocations = getAgentInvocationsBySession("s1");
    expect(invocations).toHaveLength(2);
    expect(invocations[0].agentType).toBe("kody"); // earlier first
    expect(invocations[1].agentType).toBe("spektr");
  });

  it("handles optional fields as undefined", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "arkitect",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const invocations = getAgentInvocationsBySession("s1");
    expect(invocations[0].model).toBeUndefined();
    expect(invocations[0].description).toBeUndefined();
    expect(invocations[0].durationMs).toBeUndefined();
    expect(invocations[0].success).toBeUndefined();
    expect(invocations[0].error).toBeUndefined();
  });

  it("stores failure with error message", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "mekanik",
      model: "sonnet",
      success: false,
      error: "TypeScript compilation failed",
      timestamp: "2026-01-01T00:00:00Z",
    });

    const invocations = getAgentInvocationsBySession("s1");
    expect(invocations[0].success).toBe(false);
    expect(invocations[0].error).toBe("TypeScript compilation failed");
  });

  it("cascade deletes agent invocations when session is deleted", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "spektr",
      timestamp: "2026-01-01T00:01:00Z",
    });

    deleteSession("s1");
    expect(getAgentInvocationsBySession("s1")).toHaveLength(0);
  });

  it("computes agent invocation stats by project", () => {
    upsertSession({ id: "s2", projectHash: "p1" });

    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      model: "sonnet",
      durationMs: 10000,
      success: true,
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      model: "sonnet",
      durationMs: 20000,
      success: true,
      timestamp: "2026-01-01T00:01:00Z",
    });
    insertAgentInvocation({
      sessionId: "s2",
      agentType: "spektr",
      model: "opus",
      durationMs: 30000,
      success: false,
      timestamp: "2026-01-01T00:02:00Z",
    });

    const stats = getAgentInvocationStats("p1");
    expect(stats).toHaveLength(2);

    const kodyStats = stats.find((s) => s.agentType === "kody");
    expect(kodyStats).toBeDefined();
    expect(kodyStats!.total).toBe(2);
    expect(kodyStats!.avgDurationMs).toBe(15000);
    expect(kodyStats!.failureRate).toBe(0);

    const spektrStats = stats.find((s) => s.agentType === "spektr");
    expect(spektrStats).toBeDefined();
    expect(spektrStats!.total).toBe(1);
    expect(spektrStats!.failureRate).toBe(1);
  });

  it("filters stats by since parameter", () => {
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      success: true,
      timestamp: "2026-01-01T00:00:00Z",
    });
    insertAgentInvocation({
      sessionId: "s1",
      agentType: "kody",
      success: true,
      timestamp: "2026-06-01T00:00:00Z",
    });

    const stats = getAgentInvocationStats("p1", "2026-03-01T00:00:00Z");
    expect(stats).toHaveLength(1);
    expect(stats[0].total).toBe(1);
  });
});
