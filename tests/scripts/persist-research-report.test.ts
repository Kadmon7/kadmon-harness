// TDD [feniks] — Commit 3 of plan-015
// Tests for scripts/persist-research-report.ts — the bridge between
// skavenger's proposed report markdown and the research_reports table.
//
// RED: imports will fail until the script exists.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  openDb,
  closeDb,
  upsertSession,
  getResearchReport,
  queryResearchReports,
  createResearchReport,
} from "../../scripts/lib/state-store.js";
import {
  runPersistReport,
  type PersistReportInput,
} from "../../scripts/persist-research-report.js";

const PROJECT = "projhash-persist";

function sample(overrides: Partial<PersistReportInput> = {}): PersistReportInput {
  return {
    sessionId: "s1",
    projectHash: PROJECT,
    topic: "Example research topic",
    slug: "example-research-topic",
    subQuestions: ["Q1?", "Q2?"],
    sourcesCount: 4,
    confidence: "High",
    capsHit: [],
    openQuestions: ["What about edge case X?"],
    summary: "Short summary.",
    bodyMarkdown: "## TL;DR\nSomething.\n\n## Body\nDetails.\n",
    untrustedSources: true,
    ...overrides,
  };
}

describe("persist-research-report", () => {
  let tmpDir: string;

  beforeEach(async () => {
    await openDb(":memory:");
    upsertSession({ id: "s1", projectHash: PROJECT });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "kadmon-persist-test-"));
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes a markdown file at docs/research/research-NNN-<slug>.md and inserts a DB row", async () => {
    const out = await runPersistReport(sample(), { repoRoot: tmpDir });
    expect(out.reportNumber).toBe(1);

    const expectedFile = path.join(
      tmpDir,
      "docs",
      "research",
      "research-001-example-research-topic.md",
    );
    expect(fs.existsSync(expectedFile)).toBe(true);

    const row = getResearchReport(PROJECT, 1);
    expect(row).not.toBeNull();
    expect(row!.path).toBe(
      "docs/research/research-001-example-research-topic.md",
    );
    expect(row!.topic).toBe("Example research topic");
    expect(row!.openQuestions).toEqual(["What about edge case X?"]);
  });

  it("embeds a complete YAML frontmatter in the written markdown", async () => {
    await runPersistReport(sample(), { repoRoot: tmpDir });
    const file = fs.readFileSync(
      path.join(tmpDir, "docs/research/research-001-example-research-topic.md"),
      "utf8",
    );
    expect(file).toMatch(/^---\n/);
    expect(file).toContain("number: 1");
    expect(file).toContain('title: "Example research topic"');
    expect(file).toContain("agent: skavenger");
    expect(file).toContain("confidence: High");
    expect(file).toContain("sources_count: 4");
    expect(file).toContain("untrusted_sources: true");
    expect(file).toMatch(/---\n\n## TL;DR/);
  });

  it("zero-pads the report number to 3 digits (research-042-slug.md)", async () => {
    // Seed 41 prior rows
    for (let i = 1; i <= 41; i++) {
      await runPersistReport(
        sample({ slug: `prior-${i}`, topic: `Prior ${i}` }),
        { repoRoot: tmpDir },
      );
    }
    const out = await runPersistReport(
      sample({ slug: "forty-second", topic: "Forty-second" }),
      { repoRoot: tmpDir },
    );
    expect(out.reportNumber).toBe(42);
    expect(
      fs.existsSync(
        path.join(tmpDir, "docs/research/research-042-forty-second.md"),
      ),
    ).toBe(true);
  });

  it("monotonically increments across calls within the same project", async () => {
    const a = await runPersistReport(sample({ slug: "a" }), { repoRoot: tmpDir });
    const b = await runPersistReport(sample({ slug: "b" }), { repoRoot: tmpDir });
    const c = await runPersistReport(sample({ slug: "c" }), { repoRoot: tmpDir });
    expect(a.reportNumber).toBe(1);
    expect(b.reportNumber).toBe(2);
    expect(c.reportNumber).toBe(3);
  });

  it("respects KADMON_RESEARCH_AUTOWRITE=off — skips file write AND DB insert", async () => {
    const original = process.env.KADMON_RESEARCH_AUTOWRITE;
    process.env.KADMON_RESEARCH_AUTOWRITE = "off";
    try {
      const out = await runPersistReport(sample(), { repoRoot: tmpDir });
      expect(out.skipped).toBe(true);
      expect(out.reportNumber).toBeUndefined();
      // No file
      expect(
        fs.existsSync(
          path.join(tmpDir, "docs/research/research-001-example-research-topic.md"),
        ),
      ).toBe(false);
      // No DB row
      expect(queryResearchReports({ projectHash: PROJECT })).toHaveLength(0);
    } finally {
      if (original === undefined) delete process.env.KADMON_RESEARCH_AUTOWRITE;
      else process.env.KADMON_RESEARCH_AUTOWRITE = original;
    }
  });

  it("creates the docs/research/ directory if it does not exist", async () => {
    // tmpDir has no docs/research yet
    expect(fs.existsSync(path.join(tmpDir, "docs/research"))).toBe(false);
    await runPersistReport(sample(), { repoRoot: tmpDir });
    expect(fs.existsSync(path.join(tmpDir, "docs/research"))).toBe(true);
  });

  it("round-trips the body markdown verbatim below the frontmatter", async () => {
    const body =
      "## Custom section\nParagraph with [link](https://example.com).\n\n## Another\nMore text.\n";
    await runPersistReport(sample({ bodyMarkdown: body }), { repoRoot: tmpDir });
    const file = fs.readFileSync(
      path.join(tmpDir, "docs/research/research-001-example-research-topic.md"),
      "utf8",
    );
    expect(file.endsWith(body)).toBe(true);
  });

  it("slugifies defensively — rejects paths with traversal", async () => {
    await expect(
      runPersistReport(sample({ slug: "../etc/passwd" }), {
        repoRoot: tmpDir,
      }),
    ).rejects.toThrow(/slug/i);
  });

  // AUD-32 (Wave 3 audit) — createResearchReport() assigned report_number
  // via MAX(report_number)+1 against the git-ignored local kadmon.db only.
  // On a fresh machine that DB can be empty while docs/research/ (git-tracked,
  // the REAL source of truth) already has files occupying those numbers,
  // producing a filename collision on the next /skavenger run.
  describe("disk-scan reconciliation (AUD-32)", () => {
    it("reconciles the next report number against disk when the DB is empty but docs/research/ already has files", async () => {
      const researchDir = path.join(tmpDir, "docs", "research");
      fs.mkdirSync(researchDir, { recursive: true });
      fs.writeFileSync(
        path.join(researchDir, "research-009-prior-topic.md"),
        "---\nnumber: 9\n---\n\nOld content, not indexed in this fresh DB.\n",
      );

      // beforeEach opened a fresh :memory: DB — zero rows for PROJECT.
      const out = await runPersistReport(
        sample({ slug: "new-topic", topic: "New topic" }),
        { repoRoot: tmpDir },
      );

      expect(out.reportNumber).toBe(10);
      expect(
        fs.existsSync(path.join(researchDir, "research-010-new-topic.md")),
      ).toBe(true);
      // The stale disk file is untouched — no overwrite, no renumbering.
      expect(
        fs.existsSync(path.join(researchDir, "research-009-prior-topic.md")),
      ).toBe(true);
    });

    it("prefers the DB max over the disk max when the DB is further ahead", async () => {
      const researchDir = path.join(tmpDir, "docs", "research");
      fs.mkdirSync(researchDir, { recursive: true });
      fs.writeFileSync(
        path.join(researchDir, "research-002-stale-disk-file.md"),
        "---\nnumber: 2\n---\n\nStale — disk lags behind DB (e.g. files pruned).\n",
      );

      // Seed the DB directly (bypassing disk) so its max (5) exceeds the
      // disk max (2) — e.g. rows persisted before a crash between the
      // INSERT and the file write (see the crash-safety note above
      // runPersistReport's placeholder-path INSERT).
      createResearchReport({
        sessionId: "s1",
        projectHash: PROJECT,
        slug: "db-only-5",
        topic: "DB-only report 5",
        path: "docs/research/research-005-db-only-5.md",
        capsHit: [],
        subQuestions: [],
        sourcesCount: 0,
        openQuestions: [],
        untrustedSources: true,
        reportNumber: 5,
      });

      const out = await runPersistReport(
        sample({ slug: "sixth", topic: "Sixth" }),
        { repoRoot: tmpDir },
      );
      expect(out.reportNumber).toBe(6);
    });
  });
});
