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
  getInstinct,
  getActiveInstincts,
  getInstinctCounts,
} from "../../scripts/lib/state-store.js";
import type { Instinct } from "../../scripts/lib/types.js";
import {
  runForgePipeline,
  applyForgePreview,
  computeClusterReport,
} from "../../scripts/lib/forge-pipeline.js";

const OBS_MIN_LINES = 10;

function seedObservations(sessionId: string, lines: string[]): string {
  const dir = path.join(os.tmpdir(), "kadmon", sessionId);
  fs.mkdirSync(dir, { recursive: true });
  const obsPath = path.join(dir, "observations.jsonl");
  fs.writeFileSync(obsPath, lines.join("\n") + "\n");
  return obsPath;
}

function cleanupObservations(sessionId: string): void {
  const dir = path.join(os.tmpdir(), "kadmon", sessionId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function toolPreLine(toolName: string): string {
  return JSON.stringify({ eventType: "tool_pre", toolName });
}

// Generates Edit scripts/lib/types.ts → Bash vitest pairs that match the
// file_sequence pattern "Build + test after editing types.ts" (follows the
// active pattern-definitions.json — updated for ADR-006).
function editTypesPattern(times: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < times; i++) {
    out.push(
      JSON.stringify({
        eventType: "tool_pre",
        toolName: "Edit",
        filePath: "scripts/lib/types.ts",
        metadata: { command: null },
      }),
    );
    out.push(
      JSON.stringify({
        eventType: "tool_pre",
        toolName: "Bash",
        filePath: null,
        metadata: { command: "vitest" },
      }),
    );
  }
  while (out.length < OBS_MIN_LINES) {
    out.push(toolPreLine("Bash"));
  }
  return out;
}

function makeInstinct(overrides: Partial<Instinct> & { id: string }): Instinct {
  const now = "2026-04-13T00:00:00.000Z";
  return {
    id: overrides.id,
    projectHash: overrides.projectHash ?? "proj-test",
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

describe("forge-pipeline", () => {
  const sessionIds: string[] = [];

  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
    for (const sid of sessionIds) cleanupObservations(sid);
    sessionIds.length = 0;
  });

  // ─── Pipeline round-trip + apply ───

  it("T3: full pipeline round-trip — reinforces existing instinct on apply", async () => {
    const projectHash = "proj-abc";
    const sessionId = "sess-t3";
    sessionIds.push(sessionId);

    upsertInstinct(
      makeInstinct({
        id: "inst-1",
        projectHash,
        pattern: "Build + test after editing types.ts",
        action:
          "Run npm run build / tsc / vitest after editing scripts/lib/types.ts — ripple risk across consumers",
        confidence: 0.4,
        occurrences: 2,
        domain: "harness-maintenance",
      }),
    );

    seedObservations(sessionId, editTypesPattern(3));

    const preview = await runForgePipeline({ projectHash, sessionId });
    applyForgePreview(preview, { projectHash, sessionId });

    const after = getInstinct("inst-1");
    expect(after).not.toBeNull();
    expect(after!.confidence).toBeCloseTo(0.5, 5);
    expect(after!.occurrences).toBe(3);
    expect(preview.totals.reinforced).toBeGreaterThanOrEqual(1);
    // plan-018 Phase 1.8: reinforcement writes lastObservedAt
    expect(after!.lastObservedAt).toBeDefined();
    expect(after!.lastObservedAt).toBe(after!.updatedAt);
  });

  it("T3b: apply writes lastObservedAt on freshly created instincts", async () => {
    const projectHash = "proj-fresh";
    const sessionId = "sess-t3b";
    sessionIds.push(sessionId);

    // No pre-existing instinct → pipeline creates one
    seedObservations(sessionId, editTypesPattern(3));

    const preview = await runForgePipeline({ projectHash, sessionId });
    applyForgePreview(preview, { projectHash, sessionId });

    const all = getActiveInstincts(projectHash);
    expect(all.length).toBeGreaterThanOrEqual(1);
    for (const inst of all) {
      expect(typeof inst.lastObservedAt).toBe("string");
      expect(inst.lastObservedAt).toBe(inst.createdAt);
    }
  });

  it("T4: dry-run does NOT mutate the DB (byte-identical before/after)", async () => {
    const projectHash = "proj-dry";
    const sessionId = "sess-t4";
    sessionIds.push(sessionId);

    upsertInstinct(
      makeInstinct({
        id: "inst-d1",
        projectHash,
        pattern: "Build + test after editing types.ts",
        action:
          "Run npm run build / tsc / vitest after editing scripts/lib/types.ts — ripple risk across consumers",
        confidence: 0.5,
        occurrences: 3,
        domain: "harness-maintenance",
      }),
    );

    seedObservations(sessionId, editTypesPattern(3));

    const before = getActiveInstincts(projectHash);
    const countsBefore = getInstinctCounts(projectHash);

    const preview = await runForgePipeline({
      projectHash,
      sessionId,
      dryRun: true,
    });

    const after = getActiveInstincts(projectHash);
    const countsAfter = getInstinctCounts(projectHash);

    expect(after).toHaveLength(before.length);
    for (const inst of after) {
      const orig = before.find((i) => i.id === inst.id)!;
      expect(inst.confidence).toBe(orig.confidence);
      expect(inst.occurrences).toBe(orig.occurrences);
    }
    expect(countsAfter.active).toBe(countsBefore.active);
    expect(
      preview.would.reinforce.length + preview.would.create.length,
    ).toBeGreaterThan(0);
  });

  // ─── Preview gate variants ───

  it("T5: preview gate — new instinct appears in would.create", async () => {
    const projectHash = "proj-new";
    const sessionId = "sess-t5";
    sessionIds.push(sessionId);

    seedObservations(sessionId, editTypesPattern(3));

    const preview = await runForgePipeline({ projectHash, sessionId });

    expect(preview.would.create.length).toBeGreaterThanOrEqual(1);
    const created = preview.would.create.find(
      (i) => i.pattern === "Build + test after editing types.ts",
    );
    expect(created).toBeDefined();
    expect(created!.confidence).toBe(0.3);
    expect(created!.occurrences).toBe(1);
    expect(created!.projectHash).toBe(projectHash);
  });

  it("T6: preview gate — existing instinct appears in would.reinforce with updated confidence", async () => {
    const projectHash = "proj-r";
    const sessionId = "sess-t6";
    sessionIds.push(sessionId);

    upsertInstinct(
      makeInstinct({
        id: "inst-reinf",
        projectHash,
        pattern: "Build + test after editing types.ts",
        action:
          "Run npm run build / tsc / vitest after editing scripts/lib/types.ts — ripple risk across consumers",
        confidence: 0.5,
        occurrences: 3,
        domain: "harness-maintenance",
      }),
    );

    seedObservations(sessionId, editTypesPattern(3));

    const preview = await runForgePipeline({ projectHash, sessionId });

    const match = preview.would.reinforce.find(
      (r) => r.before.id === "inst-reinf",
    );
    expect(match).toBeDefined();
    expect(match!.before.confidence).toBe(0.5);
    expect(match!.after.confidence).toBeCloseTo(0.6, 5);
    expect(match!.after.occurrences).toBe(4);
  });

  it("T7: preview gate — promotable instinct (confidence >= 0.7, occurrences >= 3) appears in would.promote", async () => {
    const projectHash = "proj-prom";
    const sessionId = "sess-t7";
    sessionIds.push(sessionId);

    upsertInstinct(
      makeInstinct({
        id: "inst-prom",
        projectHash,
        pattern: "Verify before committing code",
        action: "Run vitest/tsc before git commit or push",
        confidence: 0.7,
        occurrences: 3,
        domain: "git",
      }),
    );

    // padding without triggering reinforcement
    seedObservations(
      sessionId,
      Array.from({ length: OBS_MIN_LINES }, () => toolPreLine("Bash")),
    );

    const preview = await runForgePipeline({ projectHash, sessionId });

    expect(preview.would.promote.some((i) => i.id === "inst-prom")).toBe(true);
  });

  it("T8: preview gate — contradicted instinct (contradictions > occurrences) appears in would.prune", async () => {
    const projectHash = "proj-prune";
    const sessionId = "sess-t8";
    sessionIds.push(sessionId);

    upsertInstinct(
      makeInstinct({
        id: "inst-bad",
        projectHash,
        pattern: "Some contradicted pattern",
        action: "Do not do",
        confidence: 0.3,
        occurrences: 2,
        contradictions: 3,
        status: "active",
        domain: "workflow",
      }),
    );

    seedObservations(
      sessionId,
      Array.from({ length: OBS_MIN_LINES }, () => toolPreLine("Bash")),
    );

    const preview = await runForgePipeline({ projectHash, sessionId });

    expect(preview.would.prune.some((i) => i.id === "inst-bad")).toBe(true);
  });

  // ─── Clustering ───

  it("T9: computeClusterReport — 2+ instincts same domain grouped into a cluster", () => {
    const instincts: Instinct[] = [
      makeInstinct({
        id: "i1",
        pattern: "Read files before editing them",
        action: "Always Read first",
        confidence: 0.6,
        occurrences: 3,
        domain: "workflow",
        projectHash: "ph1",
      }),
      makeInstinct({
        id: "i2",
        pattern: "Search before writing new code",
        action: "Use Grep/Glob first",
        confidence: 0.5,
        occurrences: 2,
        domain: "workflow",
        projectHash: "ph1",
      }),
    ];

    const report = computeClusterReport(instincts, "ph1", "sess-c1");

    expect(report.schemaVersion).toBe(1);
    expect(report.projectHash).toBe("ph1");
    expect(report.sessionId).toBe("sess-c1");
    expect(report.clusters.length).toBeGreaterThanOrEqual(1);

    const cluster = report.clusters[0];
    expect(cluster.members).toHaveLength(2);
    expect(cluster.members.map((m) => m.instinctId).sort()).toEqual([
      "i1",
      "i2",
    ]);
    expect(report.unclustered).toHaveLength(0);
    expect(report.totals.activeInstincts).toBe(2);
    expect(report.totals.clusteredInstincts).toBe(2);
    expect(report.totals.unclusteredInstincts).toBe(0);
  });

  it("T10: computeClusterReport — singleton instinct lands in unclustered", () => {
    const instincts: Instinct[] = [
      makeInstinct({
        id: "solo",
        pattern: "Unique pattern xyz",
        action: "Do something unique",
        confidence: 0.4,
        occurrences: 1,
        domain: "git",
        projectHash: "ph2",
      }),
    ];

    const report = computeClusterReport(instincts, "ph2", "sess-solo");

    expect(report.clusters).toHaveLength(0);
    expect(report.unclustered).toHaveLength(1);
    expect(report.unclustered[0].instinctId).toBe("solo");
    expect(report.totals.clusteredInstincts).toBe(0);
    expect(report.totals.unclusteredInstincts).toBe(1);
  });

  // ─── Edge cases ───

  it("T11: empty observations — pipeline returns empty would without throwing", async () => {
    const projectHash = "proj-empty";
    const sessionId = "sess-t11";
    // Deliberately do NOT seed observations — file does not exist

    const preview = await runForgePipeline({ projectHash, sessionId });

    expect(preview.would.create).toHaveLength(0);
    expect(preview.would.reinforce).toHaveLength(0);
    expect(preview.would.promote).toHaveLength(0);
    expect(preview.would.prune).toHaveLength(0);
    expect(preview.clusterReport.clusters).toHaveLength(0);
    expect(preview.totals.reinforced).toBe(0);
    expect(preview.totals.created).toBe(0);
  });

  // ─── Invariant: runForgePipeline NEVER mutates DB ───

  it("T12: runForgePipeline NEVER mutates DB even when dryRun is false (mutation is caller responsibility)", async () => {
    const projectHash = "proj-spy";
    const sessionId = "sess-t12";
    sessionIds.push(sessionId);

    seedObservations(sessionId, editTypesPattern(3));

    const before = getActiveInstincts(projectHash);
    const countsBefore = getInstinctCounts(projectHash);

    // Explicit dryRun: false — asserts the invariant holds regardless of flag
    await runForgePipeline({ projectHash, sessionId, dryRun: false });

    const after = getActiveInstincts(projectHash);
    const countsAfter = getInstinctCounts(projectHash);

    expect(after).toHaveLength(before.length);
    expect(countsAfter.active).toBe(countsBefore.active);
    expect(countsAfter.promotable).toBe(countsBefore.promotable);
    expect(countsAfter.archived).toBe(countsBefore.archived);
  });

  // ─── Security hardening: sessionId validation ───

  it("rejects path-traversal sessionId with clear error", async () => {
    await expect(
      runForgePipeline({
        projectHash: "proj-sec",
        sessionId: "../../etc",
      }),
    ).rejects.toThrowError(/unsafe sessionId/i);
  });

  it("rejects sessionId containing slash", async () => {
    await expect(
      runForgePipeline({
        projectHash: "proj-sec",
        sessionId: "foo/bar",
      }),
    ).rejects.toThrowError(/unsafe sessionId/i);
  });

  // ─── Determinism of clustering ───

  it("T13: computeClusterReport — deterministic output for same input (pure function)", () => {
    const instincts: Instinct[] = [
      makeInstinct({
        id: "a",
        pattern: "Read files before editing them",
        confidence: 0.6,
        occurrences: 3,
        domain: "workflow",
        projectHash: "ph-det",
      }),
      makeInstinct({
        id: "b",
        pattern: "Search before writing new code",
        confidence: 0.5,
        occurrences: 2,
        domain: "workflow",
        projectHash: "ph-det",
      }),
    ];

    const r1 = computeClusterReport(instincts, "ph-det", "sess-det");
    const r2 = computeClusterReport(instincts, "ph-det", "sess-det");

    expect(r1.clusters.length).toBe(r2.clusters.length);
    expect(r1.totals).toEqual(r2.totals);
    if (r1.clusters.length > 0) {
      expect(r1.clusters[0].members.map((m) => m.instinctId).sort()).toEqual(
        r2.clusters[0].members.map((m) => m.instinctId).sort(),
      );
      expect(r1.clusters[0].suggestedCategory).toBe(
        r2.clusters[0].suggestedCategory,
      );
    }
  });
});
