import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  insertCostEvent,
  insertHookEvent,
  insertAgentInvocation,
} from "../../scripts/lib/state-store.js";
import { getDbHealthReport } from "../../scripts/lib/db-health.js";

const PROJECT = "test-proj";

function nowIso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

describe("db-health", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("flags table_empty for all non-sync_queue tables on empty DB", () => {
    const report = getDbHealthReport();

    expect(report.tableCounts.sessions).toBe(0);
    expect(report.tableCounts.instincts).toBe(0);
    expect(report.tableCounts.cost_events).toBe(0);
    expect(report.tableCounts.hook_events).toBe(0);
    expect(report.tableCounts.agent_invocations).toBe(0);
    expect(report.tableCounts.sync_queue).toBe(0);

    expect(report.freshness.sessions).toBeNull();
    expect(report.lastSessions).toHaveLength(0);

    expect(report.anomalies).toContain("table_empty: sessions");
    expect(report.anomalies).toContain("table_empty: instincts");
    expect(report.anomalies).toContain("table_empty: cost_events");
    expect(report.anomalies).toContain("table_empty: hook_events");
    expect(report.anomalies).toContain("table_empty: agent_invocations");
    expect(
      report.anomalies.some((a) => a.startsWith("table_empty: sync_queue")),
    ).toBe(false);
  });

  it("returns clean report for a seeded DB with valid data", () => {
    const sessionId = "sess-seed";
    const started = nowIso(-1000 * 60 * 10);
    const ended = nowIso();

    upsertSession({
      id: sessionId,
      projectHash: PROJECT,
      branch: "main",
      startedAt: started,
      endedAt: ended,
      messageCount: 42,
      estimatedCostUsd: 0.15,
    });

    insertCostEvent({
      sessionId,
      timestamp: nowIso(-1000 * 60 * 5),
      model: "opus",
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.1,
    });

    insertHookEvent({
      sessionId,
      hookName: "git-push-reminder",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 0,
      blocked: false,
      durationMs: 120,
      timestamp: nowIso(-1000 * 60 * 3),
    });

    insertAgentInvocation({
      sessionId,
      agentType: "kody",
      durationMs: 15000,
      success: true,
      timestamp: nowIso(-1000 * 60 * 2),
    });

    const report = getDbHealthReport();

    expect(report.tableCounts.sessions).toBe(1);
    expect(report.tableCounts.cost_events).toBe(1);
    expect(report.tableCounts.hook_events).toBe(1);
    expect(report.tableCounts.agent_invocations).toBe(1);

    expect(report.lastSessions).toHaveLength(1);
    expect(report.lastSessions[0].id).toBe(sessionId);
    expect(report.lastSessions[0].branch).toBe("main");
    expect(report.lastSessions[0].msgs).toBe(42);

    expect(report.hookEvents24h).toHaveLength(1);
    expect(report.hookEvents24h[0].hookName).toBe("git-push-reminder");
    expect(report.hookEvents24h[0].maxMs).toBe(120);

    expect(report.agentInvocations24h).toHaveLength(1);
    expect(report.agentInvocations24h[0].agentType).toBe("kody");
    expect(report.agentInvocations24h[0].avgMs).toBe(15000);

    expect(report.costEvents24h).toHaveLength(1);
    expect(report.costEvents24h[0].model).toBe("opus");

    expect(
      report.anomalies.some((a) => a.startsWith("hook_duration_missing")),
    ).toBe(false);
    expect(
      report.anomalies.some((a) =>
        a.startsWith("sessions_timestamp_inversion"),
      ),
    ).toBe(false);
    expect(report.anomalies.some((a) => a.startsWith("sessions_stale"))).toBe(
      false,
    );
  });

  it("detects sessions_timestamp_inversion when ended_at < started_at", () => {
    upsertSession({
      id: "sess-inverted",
      projectHash: PROJECT,
      startedAt: "2026-04-12T23:54:40.953Z",
      endedAt: "2026-04-12T23:50:33.492Z",
    });

    const report = getDbHealthReport();

    expect(
      report.anomalies.some((a) =>
        a.startsWith("sessions_timestamp_inversion"),
      ),
    ).toBe(true);
    expect(report.anomalies).toContain(
      "sessions_timestamp_inversion: 1 rows",
    );
  });

  it("detects sessions_stale when newest session is older than threshold", () => {
    const eightDaysAgo = nowIso(-1000 * 60 * 60 * 24 * 8);
    upsertSession({
      id: "sess-stale",
      projectHash: PROJECT,
      startedAt: eightDaysAgo,
    });

    const report = getDbHealthReport();

    expect(report.anomalies.some((a) => a.startsWith("sessions_stale"))).toBe(
      true,
    );
  });

  it("detects hook_duration_missing when all 24h hook_events have NULL duration_ms", () => {
    const sessionId = "sess-no-dur";
    upsertSession({ id: sessionId, projectHash: PROJECT });

    for (let i = 0; i < 3; i++) {
      insertHookEvent({
        sessionId,
        hookName: "ts-review-reminder",
        eventType: "post_tool",
        exitCode: 0,
        blocked: false,
        timestamp: nowIso(-1000 * 60 * i),
      });
    }

    const report = getDbHealthReport();

    expect(report.hookEvents24h).toHaveLength(1);
    expect(report.hookEvents24h[0].count).toBe(3);
    expect(report.hookEvents24h[0].maxMs).toBeNull();
    expect(
      report.anomalies.some((a) => a.startsWith("hook_duration_missing")),
    ).toBe(true);
    expect(report.anomalies).toContain(
      "hook_duration_missing: 3/3 rows NULL in 24h",
    );
  });
});
