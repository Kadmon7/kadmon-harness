// TDD [feniks] — Check #12 instinct-decay-candidates (plan-028 Phase 4.6)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertInstinct,
} from "../../../scripts/lib/state-store.js";
import { runCheck } from "../../../scripts/lib/medik-checks/instinct-decay-candidates.js";

const PROJECT = "decay-test-proj";

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("instinct-decay-candidates check (#12)", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("returns PASS on empty instincts table", () => {
    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
    expect(result.category).toBe("knowledge-hygiene");
    expect(result.message).toMatch(/no instinct decay candidates/i);
  });

  it("returns NOTE when instinct has confidence < 0.3 and last_observed_at > 30d ago", () => {
    upsertInstinct({
      id: "inst-low-conf",
      projectHash: PROJECT,
      pattern: "stale pattern",
      action: "some action",
      confidence: 0.2,
      status: "active",
      lastObservedAt: daysAgoISO(35),
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("NOTE");
    expect(result.category).toBe("knowledge-hygiene");
    expect(result.message).toMatch(/1 instinct/i);
    expect(result.message).toMatch(/archive/i);
    expect(result.message).toMatch(/\/forge/);
  });

  it("returns NOTE when instinct has confidence < 0.3 and last_observed_at IS NULL (treated as idle)", () => {
    upsertInstinct({
      id: "inst-null-obs",
      projectHash: PROJECT,
      pattern: "never observed",
      action: "some action",
      confidence: 0.15,
      status: "active",
      // lastObservedAt intentionally left null
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("NOTE");
    expect(result.message).toMatch(/1 instinct/i);
  });

  it("returns NOTE with count N when multiple decay candidates exist", () => {
    for (let i = 0; i < 3; i++) {
      upsertInstinct({
        id: `inst-decay-${i}`,
        projectHash: PROJECT,
        pattern: `stale pattern ${i}`,
        action: "some action",
        confidence: 0.1,
        status: "active",
        lastObservedAt: daysAgoISO(40),
      });
    }

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("NOTE");
    expect(result.message).toMatch(/3 instinct/i);
  });

  it("does NOT count archived instincts", () => {
    upsertInstinct({
      id: "inst-archived",
      projectHash: PROJECT,
      pattern: "archived pattern",
      action: "some action",
      confidence: 0.1,
      status: "archived",
      lastObservedAt: daysAgoISO(40),
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });

  it("does NOT count instincts with confidence >= 0.3", () => {
    upsertInstinct({
      id: "inst-healthy",
      projectHash: PROJECT,
      pattern: "healthy pattern",
      action: "some action",
      confidence: 0.5,
      status: "active",
      lastObservedAt: daysAgoISO(40),
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });

  it("does NOT count instincts with confidence < 0.3 but recently observed (<= 30d)", () => {
    upsertInstinct({
      id: "inst-recent",
      projectHash: PROJECT,
      pattern: "recently seen",
      action: "some action",
      confidence: 0.2,
      status: "active",
      lastObservedAt: daysAgoISO(10), // only 10 days ago
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });

  it("is read-only — row count in instincts stays stable across invocations", async () => {
    upsertInstinct({
      id: "inst-ro",
      projectHash: PROJECT,
      pattern: "read-only test",
      action: "some action",
      confidence: 0.1,
      status: "active",
      lastObservedAt: daysAgoISO(40),
    });

    // Run the check twice
    runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    runCheck({ projectHash: PROJECT, cwd: process.cwd() });

    // Verify the instinct still exists and wasn't mutated
    const { getDb } = await import("../../../scripts/lib/state-store.js");
    const db = getDb();
    const row = db
      .prepare("SELECT COUNT(*) as c FROM instincts WHERE project_hash = ?")
      .get(PROJECT) as { c: number };
    expect(row.c).toBe(1);
  });

  it("does NOT count instincts from other projects", () => {
    upsertInstinct({
      id: "inst-other-proj",
      projectHash: "other-project",
      pattern: "other project pattern",
      action: "some action",
      confidence: 0.1,
      status: "active",
      lastObservedAt: daysAgoISO(40),
    });

    const result = runCheck({ projectHash: PROJECT, cwd: process.cwd() });
    expect(result.status).toBe("PASS");
  });
});
