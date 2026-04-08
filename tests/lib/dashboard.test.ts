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
  getInstinctCounts,
} from "../../scripts/lib/state-store.js";
import {
  renderConfidenceBar,
  getInstinctRows,
  getSessionRows,
  getHookHealthRows,
  getModelCostRows,
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

    it("marks promotable instincts with isPromotable flag", () => {
      upsertInstinct({
        id: "i1",
        projectHash: "proj1",
        pattern: "Promotable pattern",
        action: "Promote me",
        confidence: 0.8,
        occurrences: 5,
        status: "active",
      });
      upsertInstinct({
        id: "i2",
        projectHash: "proj1",
        pattern: "Not ready",
        action: "Wait",
        confidence: 0.4,
        occurrences: 1,
        status: "active",
      });

      const rows = getInstinctRows("proj1");
      expect(rows).toHaveLength(2);
      expect(rows[0].isPromotable).toBe(true);
      expect(rows[1].isPromotable).toBe(false);
    });
  });

  // ─── getInstinctCounts ───

  describe("getInstinctCounts", () => {
    it("returns zeros when no instincts", () => {
      const counts = getInstinctCounts("proj1");
      expect(counts).toEqual({ active: 0, promotable: 0, archived: 0 });
    });

    it("counts active, promotable, and archived correctly", () => {
      upsertInstinct({
        id: "i1",
        projectHash: "proj1",
        pattern: "Active low",
        action: "x",
        confidence: 0.4,
        occurrences: 1,
        status: "active",
      });
      upsertInstinct({
        id: "i2",
        projectHash: "proj1",
        pattern: "Active promotable",
        action: "x",
        confidence: 0.9,
        occurrences: 5,
        status: "active",
      });
      upsertInstinct({
        id: "i3",
        projectHash: "proj1",
        pattern: "Archived",
        action: "x",
        confidence: 0.9,
        occurrences: 10,
        status: "archived",
      });

      const counts = getInstinctCounts("proj1");
      expect(counts.active).toBe(2);
      expect(counts.promotable).toBe(1);
      expect(counts.archived).toBe(1);
    });
  });

  // ─── getSessionRows ───

  describe("getSessionRows", () => {
    it("returns empty array when no sessions", () => {
      const rows = getSessionRows("proj1");
      expect(rows).toEqual([]);
    });

    it("returns recent sessions with enriched fields", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        endedAt: "2026-03-24T11:00:00Z",
        durationMs: 3600000,
        filesModified: ["a.ts", "b.ts"],
        messageCount: 42,
        compactionCount: 1,
        estimatedCostUsd: 0.45,
      });
      upsertSession({
        id: "s2",
        projectHash: "proj1",
        branch: "feat/dashboard",
        startedAt: "2026-03-24T12:00:00Z",
        messageCount: 100,
        compactionCount: 3,
        estimatedCostUsd: 0.12,
      });

      const rows = getSessionRows("proj1", 5);
      expect(rows).toHaveLength(2);
      // Most recent first (s2 is live, kept as first live)
      expect(rows[0].branch).toBe("feat/dashboard");
      expect(rows[0].messageCount).toBe(100);
      expect(rows[0].compactionCount).toBe(3);
      expect(rows[1].branch).toBe("main");
      expect(rows[1].filesCount).toBe(2);
      expect(rows[1].messageCount).toBe(42);
      expect(rows[1].durationMs).toBe(3600000);
    });

    it("filters ghost sessions (0 msgs, 0 files, ended)", () => {
      upsertSession({
        id: "s-ghost",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        endedAt: "2026-03-24T10:01:00Z",
        messageCount: 0,
        estimatedCostUsd: 0,
      });
      upsertSession({
        id: "s-real",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T12:00:00Z",
        endedAt: "2026-03-24T13:00:00Z",
        filesModified: ["a.ts"],
        messageCount: 30,
        estimatedCostUsd: 0.3,
      });

      const rows = getSessionRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].messageCount).toBe(30);
    });

    it("keeps only the most recent live session", () => {
      upsertSession({
        id: "s-live-old",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        estimatedCostUsd: 0,
      });
      upsertSession({
        id: "s-live-new",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T12:00:00Z",
        estimatedCostUsd: 0,
      });

      const rows = getSessionRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].isLive).toBe(true);
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

  // ─── getModelCostRows ───

  describe("getModelCostRows", () => {
    it("returns empty array when no cost events", () => {
      const rows = getModelCostRows("proj1");
      expect(rows).toEqual([]);
    });

    it("aggregates cost by model across sessions", () => {
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
        estimatedCostUsd: 0.4,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-24T10:45:00Z",
        model: "claude-sonnet-4",
        inputTokens: 30000,
        outputTokens: 5000,
        estimatedCostUsd: 0.05,
      });

      const rows = getModelCostRows("proj1");
      expect(rows).toHaveLength(2);

      const opusRow = rows.find((r) => r.model === "claude-opus-4");
      expect(opusRow).toBeDefined();
      expect(opusRow!.inputTokens).toBe(50000);
      expect(opusRow!.outputTokens).toBe(10000);
      expect(opusRow!.totalCost).toBeCloseTo(0.4, 2);
      expect(opusRow!.sessionCount).toBe(1);

      const sonnetRow = rows.find((r) => r.model === "claude-sonnet-4");
      expect(sonnetRow).toBeDefined();
      expect(sonnetRow!.totalCost).toBeCloseTo(0.05, 2);
    });

    it("counts distinct sessions per model", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-23T10:00:00Z",
        estimatedCostUsd: 0.3,
      });
      upsertSession({
        id: "s2",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        estimatedCostUsd: 0.5,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-23T10:30:00Z",
        model: "claude-opus-4",
        inputTokens: 50000,
        outputTokens: 10000,
        estimatedCostUsd: 0.3,
      });
      insertCostEvent({
        sessionId: "s2",
        timestamp: "2026-03-24T10:30:00Z",
        model: "claude-opus-4",
        inputTokens: 60000,
        outputTokens: 15000,
        estimatedCostUsd: 0.5,
      });

      const rows = getModelCostRows("proj1");
      expect(rows).toHaveLength(1);
      expect(rows[0].model).toBe("claude-opus-4");
      expect(rows[0].sessionCount).toBe(2);
      expect(rows[0].inputTokens).toBe(110000);
      expect(rows[0].totalCost).toBeCloseTo(0.8, 2);
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
        messageCount: 50,
        compactionCount: 1,
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
      expect(output).toContain("1 active");
      expect(output).toContain("1 promotable");
      expect(output).toContain("promote");
      expect(output).toContain("RECENT SESSIONS");
      expect(output).toContain("main");
      expect(output).toContain("Msgs");
      expect(output).toContain("Cmps");
      expect(output).toContain("Duration");
      expect(output).toContain("COST SUMMARY");
      expect(output).toContain("LIVE SESSION");
      expect(output).toContain("Edit");
    });

    it("renders empty state gracefully", () => {
      const output = renderDashboard("empty-proj", []);
      expect(output).toContain("INSTINCTS");
      expect(output).toContain("0 active");
      expect(output).toContain("No active instincts");
      expect(output).toContain("RECENT SESSIONS");
      expect(output).toContain("No recent sessions");
      expect(output).toContain("COST SUMMARY");
      expect(output).toContain("No cost data");
      expect(output).toContain("HOOK EVENTS");
      expect(output).toContain("No hook events recorded yet");
    });

    it("renders live indicator for current session", () => {
      upsertSession({
        id: "s-live",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-29T10:00:00Z",
        messageCount: 10,
        estimatedCostUsd: 0.0,
      });
      upsertSession({
        id: "s-ended",
        projectHash: "proj1",
        branch: "feat/x",
        startedAt: "2026-03-28T10:00:00Z",
        endedAt: "2026-03-28T11:00:00Z",
        filesModified: ["a.ts"],
        messageCount: 20,
        estimatedCostUsd: 0.5,
      });

      const output = renderDashboard("proj1", []);
      expect(output).toContain("\u{26A1}");
      expect(output).toContain("\u{26A1} = live session");
    });

    it("shows promotable markers inline in INSTINCTS section", () => {
      upsertInstinct({
        id: "i-promo",
        projectHash: "proj1",
        pattern: "High confidence pattern",
        action: "Promote it",
        confidence: 0.9,
        occurrences: 5,
        status: "active",
      });
      upsertInstinct({
        id: "i-low",
        projectHash: "proj1",
        pattern: "Low pattern",
        action: "Wait",
        confidence: 0.4,
        occurrences: 1,
        status: "active",
      });

      const output = renderDashboard("proj1", []);
      // Should NOT have a separate PROMOTABLE section
      expect(output).not.toMatch(/── PROMOTABLE ──/);
      // Should have inline promote marker
      expect(output).toContain("promote");
      // Should show counts in header
      expect(output).toContain("2 active");
      expect(output).toContain("1 promotable");
    });

    it("renders COST SUMMARY with model breakdown", () => {
      upsertSession({
        id: "s1",
        projectHash: "proj1",
        branch: "main",
        startedAt: "2026-03-24T10:00:00Z",
        messageCount: 10,
        estimatedCostUsd: 0.45,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-24T10:30:00Z",
        model: "claude-opus-4",
        inputTokens: 50000,
        outputTokens: 10000,
        estimatedCostUsd: 0.4,
      });
      insertCostEvent({
        sessionId: "s1",
        timestamp: "2026-03-24T10:45:00Z",
        model: "claude-sonnet-4",
        inputTokens: 30000,
        outputTokens: 5000,
        estimatedCostUsd: 0.05,
      });

      const output = renderDashboard("proj1", []);
      expect(output).toContain("COST SUMMARY");
      expect(output).toContain("claude-opus-4");
      expect(output).toContain("claude-sonnet-4");
      expect(output).toContain("Total");
    });

    it("uses wider tool column in HOOK HEALTH", () => {
      const events: ObservabilityEvent[] = [
        {
          timestamp: "2026-03-24T10:00:00Z",
          sessionId: "s1",
          eventType: "tool_post",
          toolName: "ExitPlanMode",
          success: true,
        },
      ];

      const output = renderDashboard("proj1", events);
      // Should show "ExitPlanMode" without truncation (14 chars column)
      expect(output).toContain("ExitPlanMode");
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
        messageCount: 5,
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
        filesModified: ["a.ts"],
        messageCount: 20,
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
