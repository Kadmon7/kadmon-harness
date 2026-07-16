// TDD [feniks] — /release Wave 1: status-flips.ts (plan-037 Step 1.5, ADR-037 D5)
// Propose-only ADR/plan/roadmap status flips referenced by the ## [Unreleased] CHANGELOG
// section. This module NEVER writes — every test in the (f) family asserts byte-identical
// files after the call. Fixtures live entirely under a mkdtempSync tmp dir; real repo docs
// are never touched.
import { describe, it, expect, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { proposeStatusFlips } from "../../../scripts/lib/release/status-flips.js";
import type { ReleaseContext } from "../../../scripts/lib/release/types.js";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "release-status-flips-test-"));
}

function writeChangelog(dir: string, unreleasedBody: string): void {
  const content = `# Changelog\n\nAll notable changes.\n\n## [Unreleased]\n\n${unreleasedBody}\n\n## [1.0.0] — 2026-01-01\n\n### Added\n- Initial release\n`;
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), content, "utf8");
}

function writeAdr(dir: string, num: string, status: string): string {
  const decisionsDir = path.join(dir, "docs", "decisions");
  fs.mkdirSync(decisionsDir, { recursive: true });
  const filePath = path.join(decisionsDir, `ADR-${num}-test-decision.md`);
  fs.writeFileSync(
    filePath,
    `---\nnumber: ${num}\ntitle: Test ADR\ndate: 2026-07-13\nstatus: ${status}\n---\n\n# ADR-${num}: Test\n`,
    "utf8",
  );
  return filePath;
}

function writePlan(dir: string, num: string, status: string): string {
  const plansDir = path.join(dir, "docs", "plans");
  fs.mkdirSync(plansDir, { recursive: true });
  const filePath = path.join(plansDir, `plan-${num}-test-plan.md`);
  fs.writeFileSync(
    filePath,
    `---\nnumber: ${num}\ntitle: Test Plan\ndate: 2026-07-13\nstatus: ${status}\n---\n\n# Plan\n`,
    "utf8",
  );
  return filePath;
}

function writeRoadmap(dir: string, filename: string, body: string): string {
  const roadmapDir = path.join(dir, "docs", "roadmap");
  fs.mkdirSync(roadmapDir, { recursive: true });
  const filePath = path.join(roadmapDir, filename);
  fs.writeFileSync(filePath, body, "utf8");
  return filePath;
}

function makeContext(cwd: string): ReleaseContext {
  return {
    cwd,
    options: { level: "patch", dryRun: true, push: false },
    currentVersion: "1.0.0",
  };
}

describe("proposeStatusFlips", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("(a) proposes accepted for a referenced ADR at status: proposed", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(tmpDir, "### Added\n- New /release command — see ADR-037 for design.\n");
      writeAdr(tmpDir, "037", "proposed");

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toHaveLength(1);
      expect(proposals[0].current).toBe("proposed");
      expect(proposals[0].proposed).toBe("accepted");
      expect(proposals[0].file.replace(/\\/g, "/")).toMatch(/ADR-037-test-decision\.md$/);
      expect(proposals[0].reason).toMatch(/ADR-037/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(b) proposes completed for a referenced plan at status: in-progress", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(tmpDir, "### Added\n- New /release command — tracked in plan-037.\n");
      writePlan(tmpDir, "037", "in-progress");

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toHaveLength(1);
      expect(proposals[0].current).toBe("in-progress");
      expect(proposals[0].proposed).toBe("completed");
      expect(proposals[0].file.replace(/\\/g, "/")).toMatch(/plan-037-test-plan\.md$/);
      expect(proposals[0].reason).toMatch(/plan-037/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(c) yields no proposal when the referenced ADR is already accepted", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(tmpDir, "### Added\n- New /release command — see ADR-037 for design.\n");
      writeAdr(tmpDir, "037", "accepted");

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(d) proposes [x] for an open roadmap checkbox item referenced in [Unreleased]", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(
        tmpDir,
        "### Added\n- Perf follow-up tracked at docs/roadmap/v1.4-perf.md.\n",
      );
      writeRoadmap(
        tmpDir,
        "v1.4-perf.md",
        "# v1.4 Perf Roadmap\n\n- [ ] Batch git spawns in stale-plans check\n",
      );

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toHaveLength(1);
      expect(proposals[0].current).toBe("[ ]");
      expect(proposals[0].proposed).toBe("[x]");
      expect(proposals[0].file).toBe("docs/roadmap/v1.4-perf.md");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(e) returns [] when [Unreleased] references no ADR/plan/roadmap docs", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(tmpDir, "### Added\n- A change with no doc references at all.\n");

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(f) writes nothing — referenced ADR/plan/CHANGELOG files are byte-identical after the call", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(
        tmpDir,
        "### Added\n- New /release command — see ADR-037 and plan-037.\n",
      );
      const adrPath = writeAdr(tmpDir, "037", "proposed");
      const planPath = writePlan(tmpDir, "037", "in-progress");
      const changelogPath = path.join(tmpDir, "CHANGELOG.md");

      const adrBefore = fs.readFileSync(adrPath, "utf8");
      const planBefore = fs.readFileSync(planPath, "utf8");
      const changelogBefore = fs.readFileSync(changelogPath, "utf8");

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals.length).toBeGreaterThan(0);
      expect(fs.readFileSync(adrPath, "utf8")).toBe(adrBefore);
      expect(fs.readFileSync(planPath, "utf8")).toBe(planBefore);
      expect(fs.readFileSync(changelogPath, "utf8")).toBe(changelogBefore);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(g) skips a referenced-but-missing doc without throwing", () => {
    const tmpDir = makeTmpDir();
    try {
      writeChangelog(
        tmpDir,
        "### Added\n- References ADR-999 and plan-999 which do not exist on disk.\n",
      );
      // Intentionally no docs/decisions or docs/plans dirs created at all.

      let proposals: ReturnType<typeof proposeStatusFlips> = [];
      expect(() => {
        proposals = proposeStatusFlips(makeContext(tmpDir));
      }).not.toThrow();
      expect(proposals).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(h) returns [] gracefully when CHANGELOG.md does not exist", () => {
    const tmpDir = makeTmpDir();
    // Muted: the silent-swallow fix now logs a real warn line to stderr on this
    // path (readFileSafe can't find CHANGELOG.md) — this test predates that
    // logging and asserts only the return-value contract, so keep it silent
    // rather than leaking JSON into test output.
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      expect(() => proposeStatusFlips(makeContext(tmpDir))).not.toThrow();
      expect(proposeStatusFlips(makeContext(tmpDir))).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("(i) readFileSafe logs a warn when CHANGELOG.md is missing, and proposeStatusFlips still falls back to [] (silent-swallow fix)", () => {
    const tmpDir = makeTmpDir();
    try {
      stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

      const proposals = proposeStatusFlips(makeContext(tmpDir));

      expect(proposals).toEqual([]);
      expect(stderrSpy).toHaveBeenCalled();

      const entry = JSON.parse(String(stderrSpy.mock.calls[0][0]).trim());
      expect(entry.level).toBe("warn");
      expect(entry.operation).toBe("readFileSafe");
      expect(entry.filePath).toBe(path.join(tmpDir, "CHANGELOG.md"));
      expect(entry.fallback).toMatch(/null/i);
      expect(typeof entry.error).toBe("string");
      expect(entry.error.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
