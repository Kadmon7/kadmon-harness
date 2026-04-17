import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertSession,
  createResearchReport,
  getResearchReport,
  getLastResearchReport,
  queryResearchReports,
  hasFTS5Support,
  _resetFTS5Cache,
} from "../../scripts/lib/state-store.js";

const PROJECT_A = "projhash_a";
const PROJECT_B = "projhash_b";

function sampleInput(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s1",
    projectHash: PROJECT_A,
    slug: "example-topic",
    topic: "Example topic",
    path: "docs/research/research-001-example-topic.md",
    summary: "Short summary.",
    confidence: "High" as const,
    capsHit: [],
    subQuestions: ["Q1", "Q2"],
    sourcesCount: 5,
    openQuestions: ["What about X?"],
    untrustedSources: true,
    ...overrides,
  };
}

describe("state-store research_reports", () => {
  beforeEach(async () => {
    await openDb(":memory:");
    upsertSession({ id: "s1", projectHash: PROJECT_A });
    upsertSession({ id: "s2", projectHash: PROJECT_A });
    upsertSession({ id: "s3", projectHash: PROJECT_B });
    _resetFTS5Cache();
  });

  afterEach(() => {
    closeDb();
  });

  describe("createResearchReport", () => {
    it("inserts a report and assigns reportNumber = 1 for the first in a project", () => {
      const report = createResearchReport(sampleInput());
      expect(report.reportNumber).toBe(1);
      expect(report.id).toBeTruthy();
      expect(report.generatedAt).toBeTruthy();
      expect(report.topic).toBe("Example topic");
    });

    it("monotonically increments reportNumber per project", () => {
      const r1 = createResearchReport(sampleInput({ slug: "a", topic: "A" }));
      const r2 = createResearchReport(sampleInput({ slug: "b", topic: "B" }));
      const r3 = createResearchReport(sampleInput({ slug: "c", topic: "C" }));
      expect(r1.reportNumber).toBe(1);
      expect(r2.reportNumber).toBe(2);
      expect(r3.reportNumber).toBe(3);
    });

    it("keeps counters independent across projects", () => {
      const a1 = createResearchReport(sampleInput({ projectHash: PROJECT_A }));
      const b1 = createResearchReport(
        sampleInput({ projectHash: PROJECT_B, sessionId: "s3" }),
      );
      const a2 = createResearchReport(sampleInput({ projectHash: PROJECT_A, slug: "a2" }));
      expect(a1.reportNumber).toBe(1);
      expect(b1.reportNumber).toBe(1);
      expect(a2.reportNumber).toBe(2);
    });

    it("round-trips JSON array fields (capsHit, subQuestions, openQuestions)", () => {
      const created = createResearchReport(
        sampleInput({
          capsHit: ["web_search", "web_fetch"],
          subQuestions: ["a", "b", "c"],
          openQuestions: ["left open 1", "left open 2"],
        }),
      );
      const read = getResearchReport(PROJECT_A, created.reportNumber);
      expect(read).not.toBeNull();
      expect(read!.capsHit).toEqual(["web_search", "web_fetch"]);
      expect(read!.subQuestions).toEqual(["a", "b", "c"]);
      expect(read!.openQuestions).toEqual(["left open 1", "left open 2"]);
    });

    it("persists untrustedSources as boolean (stored as INTEGER 0/1)", () => {
      const trusted = createResearchReport(
        sampleInput({ slug: "t", topic: "Trusted", untrustedSources: false }),
      );
      const untrusted = createResearchReport(
        sampleInput({ slug: "u", topic: "Untrusted", untrustedSources: true }),
      );
      const tRead = getResearchReport(PROJECT_A, trusted.reportNumber)!;
      const uRead = getResearchReport(PROJECT_A, untrusted.reportNumber)!;
      expect(tRead.untrustedSources).toBe(false);
      expect(uRead.untrustedSources).toBe(true);
    });

    it("allows caller-provided reportNumber override (for migration/import)", () => {
      const forced = createResearchReport(
        sampleInput({ reportNumber: 42, slug: "forced" }),
      );
      expect(forced.reportNumber).toBe(42);
      // Next auto should take max+1 = 43
      const next = createResearchReport(sampleInput({ slug: "next" }));
      expect(next.reportNumber).toBe(43);
    });

    it("rejects duplicate (projectHash, reportNumber) via UNIQUE constraint", () => {
      createResearchReport(sampleInput({ reportNumber: 5, slug: "a" }));
      expect(() =>
        createResearchReport(sampleInput({ reportNumber: 5, slug: "b" })),
      ).toThrow();
    });
  });

  describe("getResearchReport", () => {
    it("finds a report by (projectHash, reportNumber)", () => {
      const created = createResearchReport(sampleInput());
      const read = getResearchReport(PROJECT_A, created.reportNumber);
      expect(read).not.toBeNull();
      expect(read!.id).toBe(created.id);
      expect(read!.topic).toBe(created.topic);
    });

    it("returns null when the report does not exist", () => {
      expect(getResearchReport(PROJECT_A, 999)).toBeNull();
    });

    it("scopes by projectHash (same number in different projects returns correct row)", () => {
      const a = createResearchReport(sampleInput({ projectHash: PROJECT_A, slug: "a" }));
      const b = createResearchReport(
        sampleInput({ projectHash: PROJECT_B, sessionId: "s3", slug: "b" }),
      );
      // both have reportNumber 1 but in different projects
      expect(a.reportNumber).toBe(1);
      expect(b.reportNumber).toBe(1);
      expect(getResearchReport(PROJECT_A, 1)!.id).toBe(a.id);
      expect(getResearchReport(PROJECT_B, 1)!.id).toBe(b.id);
    });
  });

  describe("getLastResearchReport", () => {
    it("returns the most recent report for a session", () => {
      createResearchReport(
        sampleInput({
          sessionId: "s1",
          slug: "first",
          generatedAt: "2026-01-01T00:00:00Z",
        }),
      );
      const second = createResearchReport(
        sampleInput({
          sessionId: "s1",
          slug: "second",
          generatedAt: "2026-01-02T00:00:00Z",
        }),
      );
      const last = getLastResearchReport("s1");
      expect(last).not.toBeNull();
      expect(last!.id).toBe(second.id);
      expect(last!.slug).toBe("second");
    });

    it("returns null for a session with no reports", () => {
      expect(getLastResearchReport("s2")).toBeNull();
    });

    it("is session-scoped (does not leak across sessions)", () => {
      createResearchReport(sampleInput({ sessionId: "s1", slug: "s1-only" }));
      expect(getLastResearchReport("s1")).not.toBeNull();
      expect(getLastResearchReport("s2")).toBeNull();
    });
  });

  describe("queryResearchReports", () => {
    beforeEach(() => {
      createResearchReport(
        sampleInput({ slug: "pgvector-hnsw", topic: "pgvector HNSW indexing", summary: "About HNSW" }),
      );
      createResearchReport(
        sampleInput({ slug: "pgvector-ivfflat", topic: "pgvector IVFFlat indexing", summary: "About IVFFlat" }),
      );
      createResearchReport(
        sampleInput({ slug: "claude-prompt-caching", topic: "Claude prompt caching", summary: "Cost savings" }),
      );
    });

    it("returns all reports for a project when no text filter", () => {
      const results = queryResearchReports({ projectHash: PROJECT_A });
      expect(results).toHaveLength(3);
    });

    it("respects the limit parameter", () => {
      const results = queryResearchReports({ projectHash: PROJECT_A, limit: 2 });
      expect(results).toHaveLength(2);
    });

    it("orders by generatedAt descending", () => {
      const results = queryResearchReports({ projectHash: PROJECT_A });
      expect(results[0].reportNumber).toBeGreaterThan(results[results.length - 1].reportNumber);
    });

    it("filters by text in topic (LIKE fallback)", () => {
      const results = queryResearchReports({
        projectHash: PROJECT_A,
        text: "pgvector",
      });
      expect(results).toHaveLength(2);
      for (const r of results) expect(r.topic).toContain("pgvector");
    });

    it("filters by text in slug", () => {
      const results = queryResearchReports({
        projectHash: PROJECT_A,
        text: "prompt-caching",
      });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe("claude-prompt-caching");
    });

    it("filters by text in summary", () => {
      const results = queryResearchReports({
        projectHash: PROJECT_A,
        text: "Cost savings",
      });
      expect(results).toHaveLength(1);
      expect(results[0].slug).toBe("claude-prompt-caching");
    });

    it("returns empty array when no match", () => {
      const results = queryResearchReports({
        projectHash: PROJECT_A,
        text: "nonexistent-term-xyz",
      });
      expect(results).toEqual([]);
    });

    it("scopes by projectHash (does not leak across projects)", () => {
      createResearchReport(
        sampleInput({
          projectHash: PROJECT_B,
          sessionId: "s3",
          slug: "other-project",
          topic: "pgvector something in other project",
        }),
      );
      const a = queryResearchReports({ projectHash: PROJECT_A, text: "pgvector" });
      const b = queryResearchReports({ projectHash: PROJECT_B, text: "pgvector" });
      expect(a).toHaveLength(2);
      expect(b).toHaveLength(1);
      expect(b[0].slug).toBe("other-project");
    });
  });

  describe("hasFTS5Support", () => {
    it("returns a boolean and caches the result across calls", () => {
      const first = hasFTS5Support();
      const second = hasFTS5Support();
      expect(typeof first).toBe("boolean");
      expect(first).toBe(second);
    });

    it("resets via _resetFTS5Cache for tests", () => {
      const before = hasFTS5Support();
      _resetFTS5Cache();
      // After reset, the probe re-runs. The answer must still be deterministic
      // for the current sql.js build (not toggling mid-process).
      const after = hasFTS5Support();
      expect(after).toBe(before);
    });
  });
});
