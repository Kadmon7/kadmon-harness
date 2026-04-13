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
  openDb,
  closeDb,
  upsertInstinct,
} from "../../scripts/lib/state-store.js";
import type {
  ClusterReport,
  Instinct,
} from "../../scripts/lib/types.js";
import {
  writeClusterReport,
  readClusterReport,
  pruneOldReports,
  exportInstinctsToJson,
} from "../../scripts/lib/forge-report-writer.js";

function makeReport(overrides: Partial<ClusterReport> = {}): ClusterReport {
  const base: ClusterReport = {
    schemaVersion: 1,
    projectHash: "proj-writer-test",
    sessionId: "sess-xyz",
    generatedAt: "2026-04-13T12:00:00.000Z",
    clusters: [
      {
        id: "c-01",
        suggestedCategory: "PROMOTE",
        label: "workflow: 2 related patterns",
        domain: "workflow",
        members: [
          { instinctId: "inst-a", membership: 0.8 },
          { instinctId: "inst-b", membership: 0.6 },
        ],
        metrics: {
          meanConfidence: 0.7,
          totalOccurrences: 8,
          contradictionCount: 0,
          distinctSessions: 3,
        },
        rationale: "test cluster",
      },
    ],
    unclustered: [],
    totals: {
      activeInstincts: 2,
      clusteredInstincts: 2,
      unclusteredInstincts: 0,
      promotableInstincts: 1,
    },
  };
  return { ...base, ...overrides };
}

function makeInstinct(
  overrides: Partial<Instinct> & { id: string; projectHash: string },
): Instinct {
  const now = "2026-04-13T00:00:00.000Z";
  return {
    id: overrides.id,
    projectHash: overrides.projectHash,
    pattern: overrides.pattern ?? "Test pattern",
    action: overrides.action ?? "Test action",
    confidence: overrides.confidence ?? 0.3,
    occurrences: overrides.occurrences ?? 1,
    contradictions: overrides.contradictions ?? 0,
    sourceSessions: overrides.sourceSessions ?? ["sess-seed"],
    status: overrides.status ?? "active",
    scope: overrides.scope ?? "project",
    domain: overrides.domain,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    promotedTo: overrides.promotedTo,
  };
}

describe("forge-report-writer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "kadmon-forge-report-test-"),
    );
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  // ─── T11: write to expected path ───

  it("T11: writeClusterReport writes forge-clusters-<sessionId>.json to the expected path", () => {
    const report = makeReport({ sessionId: "sess-t11" });

    const written = writeClusterReport(report, tmpDir);

    expect(written).toBe(
      path.join(tmpDir, "forge-clusters-sess-t11.json"),
    );
    expect(fs.existsSync(written)).toBe(true);

    const roundTrip = readClusterReport(written);
    expect(roundTrip.schemaVersion).toBe(1);
    expect(roundTrip.sessionId).toBe("sess-t11");
    expect(roundTrip.clusters).toHaveLength(1);
    expect(roundTrip.clusters[0].members).toHaveLength(2);
  });

  // ─── T12: reader rejects unknown schemaVersion ───

  it("T12: readClusterReport throws a clear error on unknown schemaVersion", () => {
    const bogusPath = path.join(tmpDir, "forge-clusters-sess-bogus.json");
    fs.writeFileSync(
      bogusPath,
      JSON.stringify({
        schemaVersion: 99,
        projectHash: "p",
        sessionId: "s",
        generatedAt: "2026-04-13T00:00:00.000Z",
        clusters: [],
        unclustered: [],
        totals: {
          activeInstincts: 0,
          clusteredInstincts: 0,
          unclusteredInstincts: 0,
          promotableInstincts: 0,
        },
      }),
    );

    expect(() => readClusterReport(bogusPath)).toThrowError(
      /schemaVersion/i,
    );
  });

  // ─── T13: retention keeps newest 20 ───

  it("T13: pruneOldReports keeps the 20 newest by generatedAt and deletes the rest", () => {
    // Seed 25 reports with sortable timestamps
    for (let i = 0; i < 25; i++) {
      const iso = `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`;
      const report = makeReport({
        sessionId: `sess-ret-${String(i).padStart(2, "0")}`,
        generatedAt: iso,
      });
      writeClusterReport(report, tmpDir);
    }

    const before = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("forge-clusters-"));
    expect(before).toHaveLength(25);

    const pruned = pruneOldReports(tmpDir, 20);

    expect(pruned).toBe(5);

    const after = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("forge-clusters-"));
    expect(after).toHaveLength(20);

    // Oldest 5 (sessions 00-04) should be gone
    for (let i = 0; i < 5; i++) {
      const oldName = `forge-clusters-sess-ret-${String(i).padStart(
        2,
        "0",
      )}.json`;
      expect(after.includes(oldName)).toBe(false);
    }
    // Newest (session 24) should survive
    expect(after.includes("forge-clusters-sess-ret-24.json")).toBe(true);
  });

  it("pruneOldReports is a no-op when total <= keep", () => {
    for (let i = 0; i < 5; i++) {
      const iso = `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`;
      writeClusterReport(
        makeReport({
          sessionId: `sess-small-${i}`,
          generatedAt: iso,
        }),
        tmpDir,
      );
    }

    const pruned = pruneOldReports(tmpDir, 20);
    expect(pruned).toBe(0);

    const files = fs
      .readdirSync(tmpDir)
      .filter((f) => f.startsWith("forge-clusters-"));
    expect(files).toHaveLength(5);
  });

  it("pruneOldReports handles empty directory gracefully", () => {
    const pruned = pruneOldReports(tmpDir, 20);
    expect(pruned).toBe(0);
  });

  // ─── T14: /forge export serializer ───

  it("T14: exportInstinctsToJson writes valid JSON with header { project_hash, exported_at, schema_version: 1 } and an instincts payload", async () => {
    await openDb(":memory:");
    try {
      const projectHash = "proj-export-test";
      upsertInstinct(
        makeInstinct({
          id: "exp-1",
          projectHash,
          pattern: "Test pattern 1",
          domain: "workflow",
          confidence: 0.6,
          occurrences: 3,
        }),
      );
      upsertInstinct(
        makeInstinct({
          id: "exp-2",
          projectHash,
          pattern: "Test pattern 2",
          domain: "git",
          confidence: 0.4,
          occurrences: 2,
        }),
      );

      const destPath = path.join(tmpDir, "instincts-export.json");
      const written = exportInstinctsToJson(projectHash, destPath);

      expect(written).toBe(destPath);
      expect(fs.existsSync(destPath)).toBe(true);

      const raw = fs.readFileSync(destPath, "utf8");
      const parsed = JSON.parse(raw) as {
        project_hash: string;
        exported_at: string;
        schema_version: number;
        instincts: Instinct[];
      };

      expect(parsed.project_hash).toBe(projectHash);
      expect(parsed.schema_version).toBe(1);
      expect(typeof parsed.exported_at).toBe("string");
      expect(parsed.instincts).toHaveLength(2);
      expect(parsed.instincts.map((i) => i.id).sort()).toEqual([
        "exp-1",
        "exp-2",
      ]);
    } finally {
      closeDb();
    }
  });

  it("exportInstinctsToJson returns path with empty instincts array for unknown projectHash", async () => {
    await openDb(":memory:");
    try {
      const destPath = path.join(tmpDir, "empty-export.json");
      const written = exportInstinctsToJson("proj-does-not-exist", destPath);
      expect(written).toBe(destPath);

      const parsed = JSON.parse(fs.readFileSync(destPath, "utf8")) as {
        instincts: unknown[];
      };
      expect(parsed.instincts).toHaveLength(0);
    } finally {
      closeDb();
    }
  });

  // ─── Safety: writer creates baseDir if missing ───

  it("writeClusterReport creates baseDir recursively if it does not exist", () => {
    const nested = path.join(tmpDir, "nested", "dir", "that", "does", "not", "exist");
    const report = makeReport({ sessionId: "sess-nested" });

    const written = writeClusterReport(report, nested);

    expect(fs.existsSync(nested)).toBe(true);
    expect(fs.existsSync(written)).toBe(true);
  });
});
