import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  getDb,
  upsertSession,
  cleanupDuplicateHookEvents,
  cleanupDuplicateAgentInvocations,
  getHookEventsBySession,
  getAgentInvocationsBySession,
} from "../../scripts/lib/state-store.js";

describe("state-store migration cleanup (dedup sentinel)", () => {
  beforeEach(async () => {
    await openDb(":memory:");
    upsertSession({ id: "s1", projectHash: "p1" });
    // Simulate pre-migration DB by dropping the new UNIQUE indexes so raw
    // INSERTs can seed duplicate rows (ADR-022 tests the cleanup path).
    const db = getDb();
    db.exec(`DROP INDEX IF EXISTS idx_hook_events_natural_key;`);
    db.exec(`DROP INDEX IF EXISTS idx_agent_invocations_natural_key;`);
  });

  afterEach(() => {
    closeDb();
  });

  describe("cleanupDuplicateHookEvents", () => {
    it("collapses 5 duplicate rows to 1", () => {
      const db = getDb();
      for (let i = 0; i < 5; i++) {
        db.prepare(
          `INSERT INTO hook_events (id, session_id, hook_name, event_type, tool_name,
            exit_code, blocked, duration_ms, error, timestamp)
           VALUES (@id, 's1', 'git-push-reminder', 'pre_tool', 'Bash',
            1, 0, 10, NULL, '2026-04-22T02:00:00.000Z')`,
        ).run({ id: `dup-${i}` });
      }

      expect(getHookEventsBySession("s1")).toHaveLength(5);
      const removed = cleanupDuplicateHookEvents();
      expect(removed).toBe(4);
      expect(getHookEventsBySession("s1")).toHaveLength(1);
    });

    it("is a no-op when there are no duplicates", () => {
      const removed = cleanupDuplicateHookEvents();
      expect(removed).toBe(0);
    });

    it("preserves distinct rows across multiple dup groups", () => {
      const db = getDb();
      const now = Date.now();
      const insert = (
        id: string,
        hookName: string,
        timestamp: string,
      ): void => {
        db.prepare(
          `INSERT INTO hook_events (id, session_id, hook_name, event_type, tool_name,
            exit_code, blocked, duration_ms, error, timestamp)
           VALUES (@id, 's1', @hookName, 'pre_tool', 'Bash',
            0, 0, 10, NULL, @timestamp)`,
        ).run({ id, hookName, timestamp });
      };

      const ts1 = new Date(now).toISOString();
      const ts2 = new Date(now + 1000).toISOString();

      insert("a1", "hook-a", ts1);
      insert("a2", "hook-a", ts1);
      insert("b1", "hook-b", ts2);
      insert("b2", "hook-b", ts2);
      insert("b3", "hook-b", ts2);

      expect(getHookEventsBySession("s1")).toHaveLength(5);
      const removed = cleanupDuplicateHookEvents();
      expect(removed).toBe(3);
      expect(getHookEventsBySession("s1")).toHaveLength(2);
    });
  });

  describe("cleanupDuplicateAgentInvocations", () => {
    it("collapses duplicate agent invocations to 1", () => {
      const db = getDb();
      for (let i = 0; i < 3; i++) {
        db.prepare(
          `INSERT INTO agent_invocations (id, session_id, agent_type, model,
            description, duration_ms, success, error, timestamp)
           VALUES (@id, 's1', 'typescript-reviewer', 'sonnet',
            'review', 25000, 1, NULL, '2026-04-22T02:00:00.000Z')`,
        ).run({ id: `ai-${i}` });
      }

      expect(getAgentInvocationsBySession("s1")).toHaveLength(3);
      const removed = cleanupDuplicateAgentInvocations();
      expect(removed).toBe(2);
      expect(getAgentInvocationsBySession("s1")).toHaveLength(1);
    });

    it("is a no-op when there are no duplicates", () => {
      const removed = cleanupDuplicateAgentInvocations();
      expect(removed).toBe(0);
    });
  });
});
