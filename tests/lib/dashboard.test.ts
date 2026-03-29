import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
  getCostRows,
  renderDashboard,
} from "../../scripts/lib/dashboard.js";
import { findActiveSessionDir } from "../../scripts/dashboard.js";
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

  // ─── getCostRows ───

  describe("getCostRows", () => {
    it("returns empty array when no cost events", () => {
      const rows = getCostRows("proj1");
      expect(rows).toEqual([]);
    });

    it("aggregates cost per session with model info", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        estimatedCostUsd: 0.45,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-24T10:30:00Z",
        model: "claude-opus-4",
        inputTokens: 50000,
        outputTokens: 10000,
        estimatedCostUsd: 0.15,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-24T10:45:00Z",
        model: "claude-sonnet-4",
        inputTokens: 30000,
        outputTokens: 5000,
        estimatedCostUsd: 0.02,
      });

      const rows = getCostRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].sessionId).toBe("s1");
      expect(rows[0].totalCost).toBeCloseTo(0.45, 2);
      expect(rows[0].eventCount).toBe(2);
      expect(rows[0].date).toBe("2026-03-24");
    });

    it("returns multiple sessions sorted by date desc", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-23T10:00:00Z",
        estimatedCostUsd: 0.1,
      });
      upsertSession({
        id: "s2",
        projectHash: "proj1",
        branch: "feat/x",
        startedAt: "2026-03-24T10:00:00Z",
        estimatedCostUsd: 0.5,
      });

      const rows = getCostRows("proj1");
      expect(rows).toHaveLength(2);
      expect(rows[0].sessionId).toBe("s2"); // most recent first
      expect(rows[1].sessionId).toBe("s1");
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

    it("renders (live) tag for sessions without endedAt", () => {
      upsertSession({
        id: "s-live",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-29T10:00:00Z",
        estimatedCostUsd: 0.0,
      });
      upsertSession({
        id: "s-ended",
        projectHash: "proj1",
        branch: "feat/x",
        startedAt: "2026-03-28T10:00:00Z",
        endedAt: "2026-03-28T11:00:00Z",
        estimatedCostUsd: 0.5,
      });

      const output = renderDashboard("proj1", []);
      expect(output).toContain("(live)");
      // The ended session line should not have (live)
      const lines = output.split("\n");
      const liveLines = lines.filter((l) => l.includes("(live)"));
      expect(liveLines).toHaveLength(2); // one in sessions, one in costs
    });
  });

  // ─── getSessionRows isLive ───

  describe("getSessionRows isLive", () => {
    it("marks sessions without endedAt as live", () => {
      upsertSession({
        id: "s-active",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-29T10:00:00Z",
        estimatedCostUsd: 0.0,
      });

      const rows = getSessionRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].isLive).toBe(true);
    });

    it("marks sessions with endedAt as not live", () => {
      upsertSession({
        id: "s-done",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-29T10:00:00Z",
        endedAt: "2026-03-29T11:00:00Z",
        estimatedCostUsd: 0.3,
      });

      const rows = getSessionRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].isLive).toBe(false);
    });
  });
});

// ─── findActiveSessionDir ───

describe("findActiveSessionDir", () => {
  let tmpBase: string;

  beforeEach(() => {
    tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("returns null when no directories exist", () => {
    expect(findActiveSessionDir(tmpBase)).toBeNull();
  });

  it("returns null when directories have no observations.jsonl", () => {
    fs.mkdirSync(path.join(tmpBase, "test-artifact"));
    fs.mkdirSync(path.join(tmpBase, "another-dir"));
    expect(findActiveSessionDir(tmpBase)).toBeNull();
  });

  it("selects directory with observations.jsonl", () => {
    const realSession = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const artifactDir = "test-session-123";

    fs.mkdirSync(path.join(tmpBase, artifactDir));
    fs.mkdirSync(path.join(tmpBase, realSession));
    fs.writeFileSync(
      path.join(tmpBase, realSession, "observations.jsonl"),
      '{"eventType":"tool_post"}\n',
    );

    expect(findActiveSessionDir(tmpBase)).toBe(realSession);
  });

  it("selects directory with most recent observations.jsonl mtime", () => {
    const older = "11111111-1111-1111-1111-111111111111";
    const newer = "22222222-2222-2222-2222-222222222222";

    fs.mkdirSync(path.join(tmpBase, older));
    fs.mkdirSync(path.join(tmpBase, newer));

    // Write older file first
    fs.writeFileSync(
      path.join(tmpBase, older, "observations.jsonl"),
      '{"eventType":"tool_post"}\n',
    );

    // Small delay to ensure different mtime
    const olderMtime = new Date(Date.now() - 5000);
    fs.utimesSync(
      path.join(tmpBase, older, "observations.jsonl"),
      olderMtime,
      olderMtime,
    );

    // Write newer file
    fs.writeFileSync(
      path.join(tmpBase, newer, "observations.jsonl"),
      '{"eventType":"tool_post"}\n',
    );

    expect(findActiveSessionDir(tmpBase)).toBe(newer);
  });
});
