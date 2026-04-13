import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  Cluster,
  ClusterMemberRef,
  ClusterReport,
  EvolutionCategory,
} from "../../scripts/lib/types.js";
import { CLUSTER_REPORT_SCHEMA_VERSION } from "../../scripts/lib/types.js";

// Test fixture — a minimal-but-realistic ClusterReport we can round-trip.
function makeFixture(overrides: Partial<ClusterReport> = {}): ClusterReport {
  const member1: ClusterMemberRef = {
    instinctId: "inst-001",
    membership: 0.85,
  };
  const member2: ClusterMemberRef = {
    instinctId: "inst-002",
    membership: 0.72,
  };

  const cluster: Cluster = {
    id: "cluster-1",
    suggestedCategory: "PROMOTE",
    label: "read-before-edit patterns",
    domain: "typescript",
    members: [member1, member2],
    metrics: {
      meanConfidence: 0.8,
      totalOccurrences: 12,
      contradictionCount: 0,
      distinctSessions: 4,
    },
    rationale: "Both instincts reinforce the no-context-guard discipline.",
  };

  const base: ClusterReport = {
    schemaVersion: 1,
    projectHash: "test-proj-hash",
    sessionId: "sess-abc",
    generatedAt: "2026-04-13T00:00:00.000Z",
    clusters: [cluster],
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

describe("ClusterReport type contract", () => {
  it("exports CLUSTER_REPORT_SCHEMA_VERSION sentinel equal to 1", () => {
    expect(CLUSTER_REPORT_SCHEMA_VERSION).toBe(1);
  });

  it("T1: round-trips through JSON with schemaVersion === 1 guard", () => {
    const report = makeFixture();
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as ClusterReport;

    expect(parsed).toEqual(report);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.clusters[0].members).toHaveLength(2);
    expect(parsed.clusters[0].suggestedCategory).toBe("PROMOTE");
    expect(parsed.totals.activeInstincts).toBe(2);
  });

  it("T2: meta field round-trips without loss (escape hatch for non-breaking extensions)", () => {
    const report = makeFixture({
      meta: {
        producerVersion: "forge-0.1.0",
        algorithm: "jaccard-mvp",
        nested: { tag: "experimental", weight: 0.5 },
        list: [1, 2, 3],
      },
    });

    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as ClusterReport;

    expect(parsed.meta).toBeDefined();
    expect(parsed.meta).toEqual(report.meta);
    expect((parsed.meta as Record<string, unknown>).producerVersion).toBe(
      "forge-0.1.0",
    );
  });

  it("ClusterMemberRef.instinctId is a string FK (type-level assertion)", () => {
    const member: ClusterMemberRef = { instinctId: "inst-001", membership: 0.9 };
    expectTypeOf(member.instinctId).toBeString();
    expectTypeOf(member.membership).toBeNumber();
  });

  it("EvolutionCategory includes all six categories", () => {
    const categories: EvolutionCategory[] = [
      "PROMOTE",
      "CREATE_AGENT",
      "CREATE_COMMAND",
      "CREATE_RULE",
      "CREATE_HOOK",
      "OPTIMIZE",
    ];
    expect(categories).toHaveLength(6);
    for (const c of categories) {
      const cluster: Cluster = {
        id: `c-${c}`,
        suggestedCategory: c,
        label: "x",
        members: [{ instinctId: "i-1", membership: 1 }],
        metrics: {
          meanConfidence: 0.5,
          totalOccurrences: 1,
          contradictionCount: 0,
          distinctSessions: 1,
        },
        rationale: "test",
      };
      expect(cluster.suggestedCategory).toBe(c);
    }
  });

  it("ClusterReport accepts empty clusters and unclustered arrays", () => {
    const report = makeFixture({
      clusters: [],
      unclustered: [{ instinctId: "inst-lone", membership: 1 }],
      totals: {
        activeInstincts: 1,
        clusteredInstincts: 0,
        unclusteredInstincts: 1,
        promotableInstincts: 0,
      },
    });

    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as ClusterReport;

    expect(parsed.clusters).toHaveLength(0);
    expect(parsed.unclustered).toHaveLength(1);
    expect(parsed.unclustered[0].instinctId).toBe("inst-lone");
  });
});
