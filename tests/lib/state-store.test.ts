import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  getSession,
  getRecentSessions,
  upsertInstinct,
  getInstinct,
  getActiveInstincts,
  getPromotableInstincts,
  insertCostEvent,
  getCostBySession,
  queueSync,
  getPendingSync,
  markSynced,
  deleteSession,
  cleanupTestSessions,
} from "../../scripts/lib/state-store.js";

describe("state-store", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  // ─── Sessions ───

  it("upserts and retrieves a session", () => {
    upsertSession({
      id: "s1",
      projectHash: "abc123",
      branch: "main",
      startedAt: "2026-01-01T00:00:00Z",
    });
    const s = getSession("s1");
    expect(s).not.toBeNull();
    expect(s!.id).toBe("s1");
    expect(s!.projectHash).toBe("abc123");
    expect(s!.branch).toBe("main");
  });

  it("updates existing session on conflict", () => {
    upsertSession({ id: "s1", projectHash: "abc", messageCount: 5 });
    upsertSession({
      id: "s1",
      projectHash: "abc",
      messageCount: 10,
      endedAt: "2026-01-01T01:00:00Z",
    });
    const s = getSession("s1");
    expect(s!.messageCount).toBe(10);
    expect(s!.endedAt).toBe("2026-01-01T01:00:00Z");
  });

  it("returns null for missing session", () => {
    expect(getSession("nonexistent")).toBeNull();
  });

  it("lists recent sessions by project", () => {
    upsertSession({
      id: "s1",
      projectHash: "proj1",
      startedAt: "2026-01-01T00:00:00Z",
    });
    upsertSession({
      id: "s2",
      projectHash: "proj1",
      startedAt: "2026-01-02T00:00:00Z",
    });
    upsertSession({
      id: "s3",
      projectHash: "proj2",
      startedAt: "2026-01-03T00:00:00Z",
    });
    const sessions = getRecentSessions("proj1");
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("s2"); // most recent first
  });

  // ─── Instincts ───

  it("creates and retrieves an instinct", () => {
    upsertInstinct({
      id: "i1",
      projectHash: "proj1",
      pattern: "always run tests",
      action: "run vitest after edits",
      confidence: 0.3,
      occurrences: 1,
    });
    const i = getInstinct("i1");
    expect(i).not.toBeNull();
    expect(i!.pattern).toBe("always run tests");
    expect(i!.confidence).toBe(0.3);
    expect(i!.status).toBe("active");
  });

  it("updates instinct on conflict", () => {
    upsertInstinct({
      id: "i1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.3,
    });
    upsertInstinct({
      id: "i1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.5,
      occurrences: 3,
    });
    const i = getInstinct("i1");
    expect(i!.confidence).toBe(0.5);
    expect(i!.occurrences).toBe(3);
  });

  it("returns active instincts sorted by confidence", () => {
    upsertInstinct({
      id: "i1",
      projectHash: "p1",
      pattern: "a",
      action: "a",
      confidence: 0.5,
    });
    upsertInstinct({
      id: "i2",
      projectHash: "p1",
      pattern: "b",
      action: "b",
      confidence: 0.8,
    });
    upsertInstinct({
      id: "i3",
      projectHash: "p1",
      pattern: "c",
      action: "c",
      confidence: 0.3,
      status: "contradicted",
    });
    const active = getActiveInstincts("p1");
    expect(active).toHaveLength(2);
    expect(active[0].confidence).toBe(0.8); // highest first
  });

  it("returns promotable instincts", () => {
    upsertInstinct({
      id: "i1",
      projectHash: "p1",
      pattern: "a",
      action: "a",
      confidence: 0.8,
      occurrences: 5,
    });
    upsertInstinct({
      id: "i2",
      projectHash: "p1",
      pattern: "b",
      action: "b",
      confidence: 0.6,
      occurrences: 5,
    }); // too low confidence
    upsertInstinct({
      id: "i3",
      projectHash: "p1",
      pattern: "c",
      action: "c",
      confidence: 0.8,
      occurrences: 2,
    }); // too few occurrences
    const promotable = getPromotableInstincts("p1");
    expect(promotable).toHaveLength(1);
    expect(promotable[0].id).toBe("i1");
  });

  // ─── Cost Events ───

  it("inserts and retrieves cost events", () => {
    upsertSession({ id: "s1", projectHash: "p1" });
    insertCostEvent({
      sessionId: "s1",
      timestamp: "2026-01-01T00:00:00Z",
      model: "sonnet",
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCostUsd: 0.0105,
    });
    insertCostEvent({
      sessionId: "s1",
      timestamp: "2026-01-01T00:01:00Z",
      model: "sonnet",
      inputTokens: 2000,
      outputTokens: 300,
      estimatedCostUsd: 0.0105,
    });
    const costs = getCostBySession("s1");
    expect(costs).toHaveLength(2);
    expect(costs[0].model).toBe("sonnet");
  });

  // ─── Sync Queue ───

  it("queues and retrieves pending sync items", () => {
    queueSync("sessions", "s1", "insert", { id: "s1" });
    queueSync("instincts", "i1", "update", { id: "i1" });
    const pending = getPendingSync();
    expect(pending).toHaveLength(2);
    expect(pending[0].tableName).toBe("sessions");
    expect(pending[0].operation).toBe("insert");
  });

  it("marks sync items as synced", () => {
    queueSync("sessions", "s1", "insert", { id: "s1" });
    const pending = getPendingSync();
    markSynced(pending[0].id!);
    const remaining = getPendingSync();
    expect(remaining).toHaveLength(0);
  });

  // ─── Delete Session ───

  it("deleteSession removes a session and returns true", () => {
    upsertSession({ id: "s1", projectHash: "p1" });
    expect(deleteSession("s1")).toBe(true);
    expect(getSession("s1")).toBeNull();
  });

  it("deleteSession returns false for nonexistent session", () => {
    expect(deleteSession("nonexistent")).toBe(false);
  });

  it("deleteSession also removes associated cost_events", () => {
    upsertSession({ id: "s1", projectHash: "p1" });
    insertCostEvent({
      sessionId: "s1",
      timestamp: "2026-01-01T00:00:00Z",
      model: "sonnet",
      inputTokens: 100,
      outputTokens: 50,
      estimatedCostUsd: 0.001,
    });
    deleteSession("s1");
    expect(getCostBySession("s1")).toHaveLength(0);
  });

  // ─── Cleanup Test Sessions ───

  it("cleanupTestSessions removes test sessions with 0 messages", () => {
    upsertSession({
      id: "test-abc",
      projectHash: "p1",
      messageCount: 0,
      endedAt: "2026-01-01T01:00:00Z",
    });
    upsertSession({
      id: "test-def",
      projectHash: "p1",
      messageCount: 0,
      endedAt: "2026-01-01T01:00:00Z",
    });
    upsertSession({
      id: "real-session",
      projectHash: "p1",
      messageCount: 5,
      endedAt: "2026-01-01T01:00:00Z",
    });
    const deleted = cleanupTestSessions();
    expect(deleted).toBe(2);
    expect(getSession("test-abc")).toBeNull();
    expect(getSession("test-def")).toBeNull();
    expect(getSession("real-session")).not.toBeNull();
  });

  it("cleanupTestSessions does NOT remove test sessions with messages > 0", () => {
    upsertSession({
      id: "test-active",
      projectHash: "p1",
      messageCount: 10,
      endedAt: "2026-01-01T01:00:00Z",
    });
    const deleted = cleanupTestSessions();
    expect(deleted).toBe(0);
    expect(getSession("test-active")).not.toBeNull();
  });

  it("cleanupTestSessions scoped by projectHash", () => {
    upsertSession({
      id: "test-p1",
      projectHash: "proj1",
      messageCount: 0,
      endedAt: "2026-01-01T01:00:00Z",
    });
    upsertSession({
      id: "test-p2",
      projectHash: "proj2",
      messageCount: 0,
      endedAt: "2026-01-01T01:00:00Z",
    });
    const deleted = cleanupTestSessions("proj1");
    expect(deleted).toBe(1);
    expect(getSession("test-p1")).toBeNull();
    expect(getSession("test-p2")).not.toBeNull();
  });

  it("cleanupTestSessions does NOT remove sessions with ended_at IS NULL (still running)", () => {
    upsertSession({
      id: "test-running",
      projectHash: "p1",
      messageCount: 0,
    });
    const deleted = cleanupTestSessions();
    expect(deleted).toBe(0);
    expect(getSession("test-running")).not.toBeNull();
  });

  // ─── Transaction rollback ───

  it("db.transaction() rolls back on error, resets inTransaction, re-throws", async () => {
    // Grab the already-opened :memory: singleton (beforeEach opened it)
    const db = await openDb(":memory:");

    // Seed a baseline row so we can verify rollback only affects the
    // transaction's writes, not pre-existing state.
    upsertSession({
      id: "rollback-baseline",
      projectHash: "test-project",
      startedAt: "2026-01-01T00:00:00Z",
    });

    // Run a transaction that performs a write then throws partway through.
    let caughtError: Error | null = null;
    try {
      db.transaction(() => {
        db.prepare(
          "INSERT INTO sessions (id, project_hash, started_at) VALUES (@id, @ph, @st)",
        ).run({
          id: "rollback-victim",
          ph: "test-project",
          st: "2026-01-01T00:00:00Z",
        });
        throw new Error("boom");
      })();
    } catch (err) {
      caughtError = err as Error;
    }

    // 1. Error propagates unchanged (re-throw)
    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe("boom");

    // 2. The sentinel row is NOT visible — rollback was applied
    expect(getSession("rollback-victim")).toBeNull();

    // 3. The baseline row IS still visible — unrelated state preserved
    expect(getSession("rollback-baseline")).not.toBeNull();

    // 4. inTransaction flag was reset — a subsequent normal write must persist
    upsertSession({
      id: "post-rollback",
      projectHash: "test-project",
      startedAt: "2026-01-02T00:00:00Z",
    });
    expect(getSession("post-rollback")).not.toBeNull();
  });
});
