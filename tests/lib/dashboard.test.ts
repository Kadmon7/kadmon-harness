import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  upsertInstinct,
  insertCostEvent,
} from "../../scripts/lib/state-store.js";
import {
  renderConfidenceBar,
  getInstinctRows,
  getSessionRows,
  getHookHealthRows,
  renderDashboard,
} from "../../scripts/lib/dashboard.js";
import type { ObservabilityEvent } from "../../scripts/lib/types.js";

describe("dashboard", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  // ─── renderConfidenceBar ───

  describe("renderConfidenceBar", () => {
    it("renders 0.0 as empty bar", () => {
      const bar = renderConfidenceBar(0.0);
      expect(bar).toContain("░░░░░░░░░░");
      expect(bar).toContain("0.0");
    });

    it("renders 1.0 as full bar", () => {
      const bar = renderConfidenceBar(1.0);
      expect(bar).toContain("██████████");
      expect(bar).toContain("1.0");
    });

    it("renders 0.6 as 6 filled + 4 empty", () => {
      const bar = renderConfidenceBar(0.6);
      expect(bar).toContain("██████░░░░");
      expect(bar).toContain("0.6");
    });

    it("renders 0.3 as 3 filled + 7 empty", () => {
      const bar = renderConfidenceBar(0.3);
      expect(bar).toContain("███░░░░░░░");
      expect(bar).toContain("0.3");
    });
  });

  // ─── getInstinctRows ───

  describe("getInstinctRows", () => {
    it("returns empty array when no instincts", () => {
      const rows = getInstinctRows("proj1");
      expect(rows).toEqual([]);
    });

    it("returns active instincts sorted by confidence desc", () => {
      upsertInstinct({
        id: "i1",
        projectHash: "proj1",
        pattern: "Read before edit",
        action: "Always read first",
        confidence: 0.6,
        occurrences: 3,
        status: "active",
      });
      upsertInstinct({
        id: "i2",
        projectHash: "proj1",
        pattern: "Batch edits",
        action: "Group related changes",
        confidence: 0.8,
        occurrences: 5,
        status: "active",
      });
      upsertInstinct({
        id: "i3",
        projectHash: "proj1",
        pattern: "Archived one",
        action: "Old",
        confidence: 0.9,
        occurrences: 10,
        status: "archived",
      });

      const rows = getInstinctRows("proj1");
      expect(rows).toHaveLength(2);
      expect(rows[0].pattern).toBe("Batch edits");
      expect(rows[0].confidence).toBe(0.8);
      expect(rows[0].bar).toContain("████████░░");
      expect(rows[1].pattern).toBe("Read before edit");
    });
  });

  // ─── getSessionRows ───

  describe("getSessionRows", () => {
    it("returns empty array when no sessions", () => {
      const rows = getSessionRows("proj1");
      expect(rows).toEqual([]);
    });

    it("returns recent sessions with cost", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        endedAt: "2026-03-24T11:00:00Z",
        durationMs: 3600000,
        filesModified: ["a.ts", "b.ts"],
        estimatedCostUsd: 0.45,
      });
      upsertSession({
        id: "s2",
        projectHash: "proj1",
        branch: "feat/dashboard",
        startedAt: "2026-03-24T12:00:00Z",
        estimatedCostUsd: 0.12,
      });

      const rows = getSessionRows("proj1", 5);
      expect(rows).toHaveLength(2);
      // Most recent first
      expect(rows[0].branch).toBe("feat/dashboard");
      expect(rows[0].cost).toBe("$0.12");
      expect(rows[1].branch).toBe("main");
      expect(rows[1].filesCount).toBe(2);
    });
  });

  // ─── getHookHealthRows ───

  describe("getHookHealthRows", () => {
    it("returns empty array when no events", () => {
      const rows = getHookHealthRows([]);
      expect(rows).toEqual([]);
    });

    it("computes pass/fail counts per hook", () => {
      const events: ObservabilityEvent[] = [
        {
          timestamp: "2026-03-24T10:00:00Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Edit",
          success: true,
        },
        {
          timestamp: "2026-03-24T10:00:01Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Edit",
          success: true,
        },
        {
          timestamp: "2026-03-24T10:00:02Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Edit",
          success: false,
        },
        {
          timestamp: "2026-03-24T10:00:03Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Read",
          success: true,
        },
        {
          timestamp: "2026-03-24T10:00:04Z",
          sessionId: "s1",
          eventType: "tool_fail",
          toolName: "Bash",
          success: false,
        },
      ];

      const rows = getHookHealthRows(events);
      const editRow = rows.find((r) => r.tool === "Edit");
      expect(editRow).toBeDefined();
      expect(editRow!.total).toBe(3);
      expect(editRow!.failures).toBe(1);
      expect(editRow!.status).toBe("WARN");

      const readRow = rows.find((r) => r.tool === "Read");
      expect(readRow!.status).toBe("OK");

      const bashRow = rows.find((r) => r.tool === "Bash");
      expect(bashRow!.failures).toBe(1);
      expect(bashRow!.status).toBe("FAIL");
    });

    it("ignores tool_pre events (only counts post and fail)", () => {
      const events: ObservabilityEvent[] = [
        {
          timestamp: "2026-03-24T10:00:00Z",
          sessionId: "s1",
          eventType: "tool_pre",
          toolName: "Edit",
        },
        {
          timestamp: "2026-03-24T10:00:01Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Edit",
          success: true,
        },
      ];

      const rows = getHookHealthRows(events);
      expect(rows).toHaveLength(1);
      expect(rows[0].total).toBe(1);
    });
  });

  // ─── renderDashboard ───

  describe("renderDashboard", () => {
    it("renders complete dashboard with all sections", () => {
      upsertInstinct({
        id: "i1",
        projectHash: "proj1",
        pattern: "Read first",
        action: "Read before edit",
        confidence: 0.7,
        occurrences: 4,
        status: "active",
      });
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        estimatedCostUsd: 0.3,
      });

      const events: ObservabilityEvent[] = [
        {
          timestamp: "2026-03-24T10:00:00Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "Edit",
          success: true,
        },
      ];

      const output = renderDashboard("proj1", events);
      expect(output).toContain("INSTINCTS");
      expect(output).toContain("Read first");
      expect(output).toContain("SESSIONS");
      expect(output).toContain("main");
      expect(output).toContain("HOOK HEALTH");
      expect(output).toContain("Edit");
    });

    it("renders empty state gracefully", () => {
      const output = renderDashboard("empty-proj", []);
      expect(output).toContain("INSTINCTS");
      expect(output).toContain("No active instincts");
      expect(output).toContain("SESSIONS");
      expect(output).toContain("No recent sessions");
      expect(output).toContain("HOOK HEALTH");
      expect(output).toContain("No observations");
    });
  });
});
