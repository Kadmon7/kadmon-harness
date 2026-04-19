import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  getInstinct,
  upsertInstinct,
} from "../../scripts/lib/state-store.js";
import {
  createInstinct,
  reinforceInstinct,
  contradictInstinct,
  promoteInstinct,
  pruneInstincts,
  getInstinctSummary,
  decayInstincts,
  promoteToGlobal,
} from "../../scripts/lib/instinct-manager.js";

describe("instinct-manager", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("creates an instinct with default confidence 0.3", () => {
    const inst = createInstinct(
      "proj1",
      "always run tests",
      "run vitest",
      "sess-1",
    );
    expect(inst.confidence).toBe(0.3);
    expect(inst.occurrences).toBe(1);
    expect(inst.status).toBe("active");
    expect(inst.scope).toBe("project");
    expect(inst.sourceSessions).toEqual(["sess-1"]);
  });

  it("creates an instinct with domain parameter", () => {
    const inst = createInstinct(
      "proj1",
      "commit before push",
      "always commit first",
      "sess-1",
      "project",
      "git",
    );
    expect(inst.domain).toBe("git");
    expect(inst.scope).toBe("project");
    // Verify persisted to DB
    const stored = getInstinct(inst.id);
    expect(stored).not.toBeNull();
    expect(stored!.domain).toBe("git");
  });

  it("creates an instinct with global scope", () => {
    const inst = createInstinct(
      "proj1",
      "use strict types",
      "enable strict mode",
      "sess-1",
      "global",
    );
    expect(inst.scope).toBe("global");
    expect(inst.domain).toBeUndefined();
    // Verify persisted to DB
    const stored = getInstinct(inst.id);
    expect(stored).not.toBeNull();
    expect(stored!.scope).toBe("global");
  });

  it("reinforces instinct and increases confidence by 0.1", () => {
    const inst = createInstinct("proj1", "pattern", "action", "sess-1");
    const reinforced = reinforceInstinct(inst.id, "sess-2");
    expect(reinforced).not.toBeNull();
    expect(reinforced!.confidence).toBeCloseTo(0.4);
    expect(reinforced!.occurrences).toBe(2);
    expect(reinforced!.sourceSessions).toContain("sess-2");
  });

  it("caps confidence at 0.9", () => {
    const inst = createInstinct("proj1", "pattern", "action", "sess-1");
    let current = inst;
    for (let i = 0; i < 10; i++) {
      const r = reinforceInstinct(current.id, `sess-${i + 2}`);
      if (r) current = r;
    }
    expect(current.confidence).toBe(0.9);
  });

  it("does not duplicate session in sourceSessions", () => {
    const inst = createInstinct("proj1", "p", "a", "sess-1");
    const r = reinforceInstinct(inst.id, "sess-1");
    expect(r!.sourceSessions).toEqual(["sess-1"]);
    expect(r!.occurrences).toBe(2);
  });

  it("contradicts instinct and sets status when contradictions exceed occurrences", () => {
    const inst = createInstinct("proj1", "p", "a", "sess-1");
    // 1 occurrence, 0 contradictions → contradict twice
    const c1 = contradictInstinct(inst.id);
    expect(c1!.contradictions).toBe(1);
    expect(c1!.status).toBe("active"); // 1 contradiction = 1 occurrence, not >

    const c2 = contradictInstinct(inst.id);
    expect(c2!.contradictions).toBe(2);
    expect(c2!.status).toBe("contradicted"); // 2 > 1
  });

  it("promotes instinct when eligible", () => {
    const inst = createInstinct("proj1", "p", "a", "sess-1");
    // Build up to promotable: confidence >= 0.7, occurrences >= 3
    reinforceInstinct(inst.id, "sess-2"); // 0.4, occ=2
    reinforceInstinct(inst.id, "sess-3"); // 0.5, occ=3
    reinforceInstinct(inst.id, "sess-4"); // 0.6, occ=4
    reinforceInstinct(inst.id, "sess-5"); // 0.7, occ=5

    const promoted = promoteInstinct(inst.id, "my-new-skill");
    expect(promoted).not.toBeNull();
    expect(promoted!.status).toBe("promoted");
    expect(promoted!.promotedTo).toBe("my-new-skill");
  });

  it("refuses to promote when confidence too low", () => {
    const inst = createInstinct("proj1", "p", "a", "sess-1");
    // confidence 0.3, occurrences 1
    expect(promoteInstinct(inst.id, "skill")).toBeNull();
  });

  it("prunes low-confidence instincts", async () => {
    createInstinct("proj1", "weak", "a", "sess-1");
    // Default confidence is 0.3, which is >= 0.2, so it won't be pruned by confidence alone
    // Create one with low confidence manually
    const { upsertInstinct } = await import("../../scripts/lib/state-store.js");
    upsertInstinct({
      id: "low-inst",
      projectHash: "proj1",
      pattern: "lowconf",
      action: "a",
      confidence: 0.1,
      occurrences: 1,
      contradictions: 0,
      status: "active",
    });

    const count = pruneInstincts("proj1");
    expect(count).toBeGreaterThanOrEqual(1);

    const pruned = getInstinct("low-inst");
    expect(pruned!.status).toBe("archived");
  });

  it("getInstinctSummary returns formatted markdown", () => {
    createInstinct("proj1", "always lint", "run eslint", "sess-1");
    const summary = getInstinctSummary("proj1");
    expect(summary).toContain("### Active Instincts");
    expect(summary).toContain("always lint");
  });

  it("getInstinctSummary returns message when no instincts", () => {
    expect(getInstinctSummary("empty")).toBe("No active instincts.");
  });

  it("returns null for nonexistent instinct operations", () => {
    expect(reinforceInstinct("nonexistent", "sess-1")).toBeNull();
    expect(contradictInstinct("nonexistent")).toBeNull();
    expect(promoteInstinct("nonexistent", "skill")).toBeNull();
  });
});

describe("decayInstincts", () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("decays a stale instinct by 0.02 per full week since last_observed_at", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const fourteenDaysAgo = new Date(
      now.getTime() - 14 * MS_PER_DAY,
    ).toISOString();
    upsertInstinct({
      id: "stale-1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
      createdAt: fourteenDaysAgo,
      updatedAt: fourteenDaysAgo,
      lastObservedAt: fourteenDaysAgo,
    });

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(1);
    expect(result.totalLoss).toBeCloseTo(0.04, 2);

    const after = getInstinct("stale-1");
    expect(after!.confidence).toBeCloseTo(0.76, 2);
  });

  it("does not decay instincts observed within the last full week", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const threeDaysAgo = new Date(
      now.getTime() - 3 * MS_PER_DAY,
    ).toISOString();
    upsertInstinct({
      id: "fresh-1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.7,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
      createdAt: threeDaysAgo,
      updatedAt: threeDaysAgo,
      lastObservedAt: threeDaysAgo,
    });

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(0);
    expect(getInstinct("fresh-1")!.confidence).toBe(0.7);
  });

  it("clamps confidence to 0 and never below", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const weeksAgo = new Date(
      now.getTime() - 100 * 7 * MS_PER_DAY,
    ).toISOString();
    upsertInstinct({
      id: "ancient-1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.05,
      occurrences: 1,
      contradictions: 0,
      status: "active",
      scope: "project",
      createdAt: weeksAgo,
      updatedAt: weeksAgo,
      lastObservedAt: weeksAgo,
    });

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(1);
    expect(getInstinct("ancient-1")!.confidence).toBe(0);
  });

  it("skips promoted, contradicted, and archived instincts", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const weeksAgo = new Date(
      now.getTime() - 14 * MS_PER_DAY,
    ).toISOString();
    for (const status of ["promoted", "contradicted", "archived"] as const) {
      upsertInstinct({
        id: `frozen-${status}`,
        projectHash: "proj1",
        pattern: "p",
        action: "a",
        confidence: 0.8,
        occurrences: 3,
        contradictions: 0,
        status,
        scope: "project",
        createdAt: weeksAgo,
        updatedAt: weeksAgo,
        lastObservedAt: weeksAgo,
      });
    }

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(0);
    for (const status of ["promoted", "contradicted", "archived"] as const) {
      expect(getInstinct(`frozen-${status}`)!.confidence).toBe(0.8);
    }
  });

  it("falls back to updated_at when last_observed_at is null (pre-v0.5 rows)", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const weeksAgo = new Date(
      now.getTime() - 21 * MS_PER_DAY,
    ).toISOString();
    upsertInstinct({
      id: "legacy-1",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.7,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
      createdAt: weeksAgo,
      updatedAt: weeksAgo,
      // lastObservedAt intentionally undefined — pre-migration row
    });

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(1);
    // 3 full weeks = -0.06. 0.7 - 0.06 = 0.64
    expect(getInstinct("legacy-1")!.confidence).toBeCloseTo(0.64, 2);
  });

  it("silently skips instincts with an invalid last_observed_at string", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const weeksAgo = new Date(
      now.getTime() - 14 * MS_PER_DAY,
    ).toISOString();
    upsertInstinct({
      id: "bad-date",
      projectHash: "proj1",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
      createdAt: weeksAgo,
      updatedAt: weeksAgo,
      lastObservedAt: "NOT_AN_ISO_STRING",
    });

    const result = decayInstincts("proj1", now);
    expect(result.decayed).toBe(0);
    expect(getInstinct("bad-date")!.confidence).toBe(0.8);
  });

  it("scopes decay to the given projectHash only", () => {
    const now = new Date("2026-04-19T00:00:00.000Z");
    const weeksAgo = new Date(
      now.getTime() - 14 * MS_PER_DAY,
    ).toISOString();
    for (const ph of ["projA", "projB"]) {
      upsertInstinct({
        id: `i-${ph}`,
        projectHash: ph,
        pattern: "p",
        action: "a",
        confidence: 0.7,
        occurrences: 3,
        contradictions: 0,
        status: "active",
        scope: "project",
        createdAt: weeksAgo,
        updatedAt: weeksAgo,
        lastObservedAt: weeksAgo,
      });
    }

    const result = decayInstincts("projA", now);
    expect(result.decayed).toBe(1);
    expect(getInstinct("i-projA")!.confidence).toBeCloseTo(0.66, 2);
    expect(getInstinct("i-projB")!.confidence).toBe(0.7); // untouched
  });
});

describe("promoteToGlobal", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("flips scope from project to global on an eligible instinct", () => {
    upsertInstinct({
      id: "p-1",
      projectHash: "projA",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
    });

    const count = promoteToGlobal(["p-1"]);
    expect(count).toBe(1);

    const after = getInstinct("p-1");
    expect(after!.scope).toBe("global");
  });

  it("is idempotent — second call does not touch updated_at", async () => {
    upsertInstinct({
      id: "p-2",
      projectHash: "projA",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "global",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const before = getInstinct("p-2")!.updatedAt;
    const count = promoteToGlobal(["p-2"]);
    expect(count).toBe(0); // already global — skipped

    const after = getInstinct("p-2")!.updatedAt;
    expect(after).toBe(before); // unchanged
  });

  it("silently skips nonexistent ids", () => {
    const count = promoteToGlobal(["does-not-exist"]);
    expect(count).toBe(0);
  });

  it("handles mixed batch: promotes eligible, skips already-global", () => {
    upsertInstinct({
      id: "mix-a",
      projectHash: "projA",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "project",
    });
    upsertInstinct({
      id: "mix-b",
      projectHash: "projB",
      pattern: "p",
      action: "a",
      confidence: 0.8,
      occurrences: 3,
      contradictions: 0,
      status: "active",
      scope: "global",
    });

    const count = promoteToGlobal(["mix-a", "mix-b", "not-real"]);
    expect(count).toBe(1);
    expect(getInstinct("mix-a")!.scope).toBe("global");
    expect(getInstinct("mix-b")!.scope).toBe("global"); // stayed global
  });
});
