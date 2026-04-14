// Kadmon Harness — Tests for evolve-report-reader (Phase 1, ADR-008)
// TDD: written before implementation. Run RED first, then GREEN.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readClusterReportsInWindow,
  mergeByInstinctId,
} from "../../scripts/lib/evolve-report-reader.js";
import {
  makeClusterReport,
  writeClusterReportToFile,
} from "../fixtures/make-cluster-report.js";
import type { ClusterReport } from "../../scripts/lib/types.js";

// ─── Helpers ───

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Suite ───

describe("readClusterReportsInWindow", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "kadmon-evolve-reader-test-"),
    );
    // Ensure any stray env override from a previous test is cleaned up
    delete process.env["KADMON_EVOLVE_WINDOW_DAYS"];
  });

  afterEach(() => {
    delete process.env["KADMON_EVOLVE_WINDOW_DAYS"];
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  // ─── Test 1: filters by projectHash only ───

  it("filters by projectHash only", () => {
    // Arrange: two reports for "aaaa", one for "bbbb"
    const now = new Date();
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-aaaa-1", generatedAt: daysAgo(1) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-aaaa-2", generatedAt: daysAgo(2) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "bbbb", sessionId: "s-bbbb-1", generatedAt: daysAgo(1) }),
      tmpDir,
    );

    // Act
    const results = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      windowDays: 7,
      now,
    });

    // Assert
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.projectHash === "aaaa")).toBe(true);
  });

  // ─── Test 2: respects windowDays ───

  it("respects windowDays", () => {
    // Arrange: reports at 0d ago, 5d ago, 10d ago
    const now = new Date();
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-0d", generatedAt: daysAgo(0) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-5d", generatedAt: daysAgo(5) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-10d", generatedAt: daysAgo(10) }),
      tmpDir,
    );

    // Act: window = 7d (should include 0d and 5d, exclude 10d)
    const results7 = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      windowDays: 7,
      now,
    });
    expect(results7).toHaveLength(2);
    expect(results7.map((r) => r.sessionId).sort()).toEqual(["s-0d", "s-5d"]);

    // Act: window = 14d (should include all three)
    const results14 = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      windowDays: 14,
      now,
    });
    expect(results14).toHaveLength(3);
  });

  // ─── Test 3: env var KADMON_EVOLVE_WINDOW_DAYS override ───

  it("env var KADMON_EVOLVE_WINDOW_DAYS override", () => {
    // Arrange: reports at 2d, 5d, 10d ago
    const now = new Date();
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-2d", generatedAt: daysAgo(2) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-5d-env", generatedAt: daysAgo(5) }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-10d-env", generatedAt: daysAgo(10) }),
      tmpDir,
    );

    // Override via env var: 3 days — only the 2d report is within window
    process.env["KADMON_EVOLVE_WINDOW_DAYS"] = "3";

    // Act: no windowDays option supplied — should fall back to env var
    const results = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      now,
    });

    // Assert: only the 2d report is returned
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("s-2d");
  });

  // ─── Test 4: returns empty array when no reports match ───

  it("returns empty array when no reports match", () => {
    // Arrange: only wrong-hash reports
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "wrong-hash", sessionId: "s-wrong-1" }),
      tmpDir,
    );
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "wrong-hash", sessionId: "s-wrong-2" }),
      tmpDir,
    );

    // Act
    const results = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "right-hash",
      windowDays: 7,
      now: new Date(),
    });

    // Assert: empty array, no throw
    expect(results).toEqual([]);
  });

  // ─── Test 5: rejects unknown schemaVersion ───

  it("rejects unknown schemaVersion — skips that report, does not throw", () => {
    // Arrange: one valid report + one with unknown schemaVersion
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-valid" }),
      tmpDir,
    );
    // Plant a report with schemaVersion: 99
    const badReport = makeClusterReport({ projectHash: "aaaa", sessionId: "s-bad-schema" });
    const badPath = path.join(tmpDir, "forge-clusters-s-bad-schema.json");
    fs.writeFileSync(
      badPath,
      JSON.stringify({ ...badReport, schemaVersion: 99 } as unknown as ClusterReport, null, 2) + "\n",
      "utf8",
    );

    // Act
    const results = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      windowDays: 7,
      now: new Date(),
    });

    // Assert: only the valid report returned; bad-schema report silently skipped
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("s-valid");
  });

  // ─── Test 6: handles missing reports dir gracefully ───

  it("handles missing reports dir gracefully", () => {
    // Arrange: use a path that definitely does not exist
    const nonExistentDir = path.join(os.tmpdir(), `kadmon-does-not-exist-${Date.now()}`);

    // Act + Assert: no crash, empty array
    const results = readClusterReportsInWindow({
      baseDir: nonExistentDir,
      projectHash: "aaaa",
      windowDays: 7,
      now: new Date(),
    });

    expect(results).toEqual([]);
  });

  // ─── Test 7: ignores non-JSON files in reports dir ───

  it("ignores non-JSON files in reports dir", () => {
    // Arrange: one valid JSON report + non-JSON files
    writeClusterReportToFile(
      makeClusterReport({ projectHash: "aaaa", sessionId: "s-json-only" }),
      tmpDir,
    );
    fs.writeFileSync(path.join(tmpDir, "README.txt"), "not a report\n", "utf8");
    fs.writeFileSync(path.join(tmpDir, "other.log"), "log content\n", "utf8");

    // Act
    const results = readClusterReportsInWindow({
      baseDir: tmpDir,
      projectHash: "aaaa",
      windowDays: 7,
      now: new Date(),
    });

    // Assert: only the JSON report is returned
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("s-json-only");
  });
});

// ─── mergeByInstinctId tests ───

describe("mergeByInstinctId", () => {
  // ─── Test 8: most-recent-report-wins on membership ───

  it("most-recent-report-wins on membership", () => {
    // Arrange: same instinctId in two reports, different membership, different generatedAt
    const older = makeClusterReport({
      projectHash: "test-hash-aaaa",
      sessionId: "merge-older",
      generatedAt: "2026-04-01T00:00:00.000Z",
      clusters: [
        {
          id: "cluster-A",
          suggestedCategory: "PROMOTE",
          label: "cluster A",
          members: [{ instinctId: "inst-merge-1", membership: 0.4 }],
          metrics: { meanConfidence: 0.4, totalOccurrences: 2, contradictionCount: 0, distinctSessions: 1 },
          rationale: "older",
        },
      ],
    });

    const newer = makeClusterReport({
      projectHash: "test-hash-aaaa",
      sessionId: "merge-newer",
      generatedAt: "2026-04-10T00:00:00.000Z",
      clusters: [
        {
          id: "cluster-A",
          suggestedCategory: "PROMOTE",
          label: "cluster A",
          members: [{ instinctId: "inst-merge-1", membership: 0.9 }],
          metrics: { meanConfidence: 0.9, totalOccurrences: 5, contradictionCount: 0, distinctSessions: 3 },
          rationale: "newer",
        },
      ],
    });

    // Act
    const merged = mergeByInstinctId([older, newer]);

    // Assert: membership from the newer report wins
    const memberRef = merged.clusters
      .flatMap((c) => c.members)
      .find((m) => m.instinctId === "inst-merge-1");
    expect(memberRef).toBeDefined();
    expect(memberRef!.membership).toBe(0.9);
  });

  // ─── Test 9: union of cluster members when clusterId matches ───

  it("union of cluster members when clusterId matches — membership from newer report", () => {
    // Arrange: two reports with same clusterId but different member sets
    const reportA = makeClusterReport({
      projectHash: "test-hash-aaaa",
      sessionId: "union-A",
      generatedAt: "2026-04-01T00:00:00.000Z",
      clusters: [
        {
          id: "cluster-union",
          suggestedCategory: "CREATE_AGENT",
          label: "union test",
          members: [
            { instinctId: "i1", membership: 0.5 },
            { instinctId: "i2", membership: 0.6 },
          ],
          metrics: { meanConfidence: 0.55, totalOccurrences: 4, contradictionCount: 0, distinctSessions: 2 },
          rationale: "older",
        },
      ],
    });

    const reportB = makeClusterReport({
      projectHash: "test-hash-aaaa",
      sessionId: "union-B",
      generatedAt: "2026-04-10T00:00:00.000Z",
      clusters: [
        {
          id: "cluster-union",
          suggestedCategory: "CREATE_AGENT",
          label: "union test",
          members: [
            { instinctId: "i2", membership: 0.8 },   // i2 appears again, newer membership
            { instinctId: "i3", membership: 0.7 },   // new member
          ],
          metrics: { meanConfidence: 0.75, totalOccurrences: 6, contradictionCount: 0, distinctSessions: 3 },
          rationale: "newer",
        },
      ],
    });

    // Act
    const merged = mergeByInstinctId([reportA, reportB]);

    // Assert: cluster-union has members i1, i2, i3 (union)
    const cluster = merged.clusters.find((c) => c.id === "cluster-union");
    expect(cluster).toBeDefined();
    const memberIds = cluster!.members.map((m) => m.instinctId).sort();
    expect(memberIds).toEqual(["i1", "i2", "i3"]);

    // i2's membership should come from the newer report (0.8)
    const i2 = cluster!.members.find((m) => m.instinctId === "i2");
    expect(i2!.membership).toBe(0.8);

    // i1's membership should be preserved from the older report (0.5)
    const i1 = cluster!.members.find((m) => m.instinctId === "i1");
    expect(i1!.membership).toBe(0.5);
  });

  // ─── Test 10: empty input returns empty result ───

  it("empty input returns empty result", () => {
    // Act
    const merged = mergeByInstinctId([]);

    // Assert: returns a sentinel ClusterReport with empty collections
    expect(merged.clusters).toEqual([]);
    expect(merged.unclustered).toEqual([]);
    expect(merged.totals.activeInstincts).toBe(0);
    expect(merged.totals.clusteredInstincts).toBe(0);
    expect(merged.totals.unclusteredInstincts).toBe(0);
    expect(merged.totals.promotableInstincts).toBe(0);
    expect(merged.schemaVersion).toBe(1);
    expect(merged.sessionId).toBe("merged");
    expect(merged.projectHash).toBe("");
  });
});
