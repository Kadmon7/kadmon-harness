import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertInstinct,
  getCrossProjectPromotionCandidates,
} from "../../scripts/lib/state-store.js";

// plan-018 Phase 4.2 — cross-project candidate detection
// Scope: status='active' AND scope='project'
// Criteria: COUNT(DISTINCT project_hash) >= minProjects AND AVG(confidence) >= minAvgConfidence
// Defaults: minProjects=2, minAvgConfidence=0.8
// normalizedPattern = pattern.trim().toLowerCase().replace(/\s+/g, ' ')

function seed(
  id: string,
  projectHash: string,
  pattern: string,
  confidence: number,
  extras: { scope?: "project" | "global"; status?: "active" | "promoted" | "contradicted" | "archived"; contradictions?: number } = {},
): void {
  upsertInstinct({
    id,
    projectHash,
    pattern,
    action: "a",
    confidence,
    occurrences: 3,
    contradictions: extras.contradictions ?? 0,
    status: extras.status ?? "active",
    scope: extras.scope ?? "project",
  });
}

describe("getCrossProjectPromotionCandidates", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  // ─── Plan specified tests (5) ───

  it("excludes single-project patterns", () => {
    seed("a1", "projA", "commit before push", 0.9);
    expect(getCrossProjectPromotionCandidates()).toEqual([]);
  });

  it("returns a candidate when 2 projects share a pattern at avg conf >= 0.8", () => {
    seed("a1", "projA", "commit before push", 0.85);
    seed("b1", "projB", "commit before push", 0.8);

    const candidates = getCrossProjectPromotionCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].projectCount).toBe(2);
    expect(candidates[0].avgConfidence).toBeCloseTo(0.825, 3);
    expect(candidates[0].instinctIds.sort()).toEqual(["a1", "b1"]);
    expect(candidates[0].normalizedPattern).toBe("commit before push");
  });

  it("excludes patterns whose average confidence is below the threshold", () => {
    seed("a1", "projA", "commit before push", 0.85);
    seed("b1", "projB", "commit before push", 0.7); // avg=0.775

    expect(getCrossProjectPromotionCandidates()).toEqual([]);
  });

  it("excludes already-global instincts from the pool", () => {
    seed("a1", "projA", "commit before push", 0.9, { scope: "global" });
    seed("b1", "projB", "commit before push", 0.9);

    // Only projB has a project-scoped copy; projA's is already global.
    // projectCount = 1 → NOT a candidate.
    expect(getCrossProjectPromotionCandidates()).toEqual([]);
  });

  it("matches patterns that differ only in whitespace or case", () => {
    seed("a1", "projA", "Commit Before Push", 0.85);
    seed("b1", "projB", "  commit  before   push  ", 0.8);

    const candidates = getCrossProjectPromotionCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].normalizedPattern).toBe("commit before push");
  });

  // ─── feniks-identified gaps ───

  it("excludes status='promoted' instincts (feniks gap #1)", () => {
    seed("a1", "projA", "commit before push", 0.9, { status: "promoted" });
    seed("b1", "projB", "commit before push", 0.9, { status: "promoted" });
    expect(getCrossProjectPromotionCandidates()).toEqual([]);
  });

  it("includes instincts with contradictions > 0 as long as status='active' (feniks gap #2)", () => {
    seed("a1", "projA", "commit before push", 0.85, { contradictions: 5 });
    seed("b1", "projB", "commit before push", 0.85, { contradictions: 5 });

    const candidates = getCrossProjectPromotionCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].instinctIds.sort()).toEqual(["a1", "b1"]);
  });

  it("hits the exact 0.800 boundary inclusively (feniks gap #3)", () => {
    seed("a1", "projA", "p", 0.85);
    seed("b1", "projB", "p", 0.75); // avg = 0.800 exactly

    const candidates = getCrossProjectPromotionCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].avgConfidence).toBeCloseTo(0.8, 3);
  });

  it("excludes at avg 0.795 (feniks gap #3 — just below boundary)", () => {
    seed("a1", "projA", "p", 0.84);
    seed("b1", "projB", "p", 0.75); // avg = 0.795

    expect(getCrossProjectPromotionCandidates()).toEqual([]);
  });

  it("counts distinct project_hashes, not raw rows (feniks gap #4)", () => {
    // Same project, two duplicate instincts with same pattern.
    seed("a1", "projA", "commit before push", 0.85);
    seed("a2", "projA", "commit before push", 0.85);
    seed("b1", "projB", "commit before push", 0.85);

    const candidates = getCrossProjectPromotionCandidates();
    expect(candidates).toHaveLength(1);
    // projectCount counts unique project_hashes, not rows
    expect(candidates[0].projectCount).toBe(2);
    // All 3 instinctIds are returned (so all can be promoted)
    expect(candidates[0].instinctIds.sort()).toEqual(["a1", "a2", "b1"]);
  });

  // ─── Parameter overrides ───

  it("respects custom minProjects threshold", () => {
    seed("a1", "projA", "p", 0.9);
    seed("b1", "projB", "p", 0.9);
    seed("c1", "projC", "p", 0.9);

    expect(getCrossProjectPromotionCandidates(3, 0.8)).toHaveLength(1);
    expect(getCrossProjectPromotionCandidates(4, 0.8)).toHaveLength(0);
  });

  it("respects custom minAvgConfidence threshold", () => {
    seed("a1", "projA", "p", 0.6);
    seed("b1", "projB", "p", 0.6);

    expect(getCrossProjectPromotionCandidates(2, 0.5)).toHaveLength(1);
    expect(getCrossProjectPromotionCandidates(2, 0.7)).toHaveLength(0);
  });
});
