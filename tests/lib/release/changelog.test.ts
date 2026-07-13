// TDD [feniks] — /release command: CHANGELOG.md consolidation (ADR-037, plan-037 Step 1.3)
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  isUnreleasedEmpty,
  previewChangelog,
  consolidateChangelog,
  hasReleasedHeading,
} from "../../../scripts/lib/release/changelog.js";
import type { ReleaseContext } from "../../../scripts/lib/release/types.js";

const EM_DASH = "—"; // U+2014 — matches CHANGELOG.md's released-heading format

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "release-changelog-test-"));
}

function writeChangelog(dir: string, content: string): string {
  const changelogPath = path.join(dir, "CHANGELOG.md");
  fs.writeFileSync(changelogPath, content, "utf-8");
  return changelogPath;
}

function makeContext(cwd: string, overrides: Partial<ReleaseContext> = {}): ReleaseContext {
  return {
    cwd,
    options: { level: "minor", dryRun: false, push: false },
    currentVersion: "1.3.0",
    ...overrides,
  };
}

/** Representative sample CHANGELOG: [Unreleased] with Added/Fixed/Docs + a prior release. */
function sampleChangelog(): string {
  return [
    "# Changelog",
    "",
    "All notable changes to Test Project are documented here.",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "- New feature A",
    "- New feature B",
    "",
    "### Fixed",
    "- Fixed bug C",
    "",
    "### Docs",
    "- Updated README",
    "",
    `## [1.3.0] ${EM_DASH} 2026-04-24`,
    "",
    "### Added",
    "- Old feature",
    "",
  ].join("\n");
}

describe("changelog (/release Step 1.3)", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function withTmpDir(): string {
    const dir = makeTmpDir();
    tmpDirs.push(dir);
    return dir;
  }

  describe("consolidateChangelog", () => {
    it("(a) renames [Unreleased] to a dated heading with exact em-dash + correct target/date", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      const result = consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");

      expect(result.status).toBe("applied");
      expect(result.filesTouched).toContain("CHANGELOG.md");

      const after = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");
      expect(after).toContain(`## [1.4.0] ${EM_DASH} 2026-07-13`);
      // Reject a plain hyphen impersonating the em-dash
      expect(after).not.toContain("## [1.4.0] - 2026-07-13");
    });

    it("(b) inserts a fresh empty [Unreleased] section above the dated section", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");

      const after = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");
      const unreleasedIdx = after.indexOf("## [Unreleased]");
      const datedIdx = after.indexOf(`## [1.4.0] ${EM_DASH} 2026-07-13`);

      expect(unreleasedIdx).toBeGreaterThanOrEqual(0);
      expect(datedIdx).toBeGreaterThan(unreleasedIdx);

      // The fresh [Unreleased] body (between the two headings) must be empty —
      // just the heading itself and blank-line spacing, no sub-sections/bullets.
      const freshBody = after.slice(unreleasedIdx + "## [Unreleased]".length, datedIdx);
      expect(freshBody.trim()).toBe("");

      // Exactly one [Unreleased] heading remains (the fresh one) — old one was renamed, not duplicated.
      const occurrences = after.split("## [Unreleased]").length - 1;
      expect(occurrences).toBe(1);
    });

    it("(c) preserves ### Added/Fixed/Docs sub-sections verbatim in the moved block", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");

      const after = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");
      const datedIdx = after.indexOf(`## [1.4.0] ${EM_DASH} 2026-07-13`);
      const nextHeadingIdx = after.indexOf(`## [1.3.0] ${EM_DASH} 2026-04-24`);
      const movedBlock = after.slice(datedIdx, nextHeadingIdx);

      expect(movedBlock).toContain("### Added\n- New feature A\n- New feature B");
      expect(movedBlock).toContain("### Fixed\n- Fixed bug C");
      expect(movedBlock).toContain("### Docs\n- Updated README");

      // The pre-existing released section further down stays untouched too.
      expect(after).toContain(`## [1.3.0] ${EM_DASH} 2026-04-24\n\n### Added\n- Old feature`);
    });

    it("(d) is idempotent — re-running when ## [target] already exists returns skipped, no change", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      const first = consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");
      expect(first.status).toBe("applied");
      const afterFirst = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");

      // Re-run — even with a different date, the existing target version heading gates it.
      const second = consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-14");
      expect(second.status).toBe("skipped");
      expect(second.filesTouched).toEqual([]);

      const afterSecond = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");
      expect(afterSecond).toBe(afterFirst);
    });

    it("(g) returns status 'failed' when no ## [Unreleased] heading exists (error path)", () => {
      const dir = withTmpDir();
      writeChangelog(
        dir,
        `# Changelog\n\n## [1.3.0] ${EM_DASH} 2026-04-24\n\n### Added\n- Old feature\n`,
      );

      const result = consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");

      expect(result.status).toBe("failed");
      expect(result.filesTouched).toEqual([]);
    });
  });

  describe("previewChangelog", () => {
    it("(e) returns the consolidated section text and leaves the file byte-identical on disk", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());
      const before = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");

      const preview = previewChangelog(dir, "1.4.0", "2026-07-13");

      expect(preview).toContain(`## [1.4.0] ${EM_DASH} 2026-07-13`);
      expect(preview).toContain("### Added\n- New feature A\n- New feature B");
      expect(preview).toContain("### Fixed\n- Fixed bug C");
      expect(preview).toContain("### Docs\n- Updated README");
      // Must not bleed into the next release section.
      expect(preview).not.toContain("Old feature");

      const after = fs.readFileSync(path.join(dir, "CHANGELOG.md"), "utf-8");
      expect(after).toBe(before);
    });
  });

  describe("isUnreleasedEmpty", () => {
    it("(f-1) returns true when [Unreleased] body is whitespace-only", () => {
      const dir = withTmpDir();
      writeChangelog(
        dir,
        `# Changelog\n\n## [Unreleased]\n\n\n## [1.3.0] ${EM_DASH} 2026-04-24\n\n### Added\n- x\n`,
      );

      expect(isUnreleasedEmpty(dir)).toBe(true);
    });

    it("(f-2) returns true when [Unreleased] body has only bare ### sub-headings", () => {
      const dir = withTmpDir();
      writeChangelog(
        dir,
        [
          "# Changelog",
          "",
          "## [Unreleased]",
          "",
          "### Added",
          "",
          "### Fixed",
          "",
          `## [1.3.0] ${EM_DASH} 2026-04-24`,
          "",
          "### Added",
          "- x",
          "",
        ].join("\n"),
      );

      expect(isUnreleasedEmpty(dir)).toBe(true);
    });

    it("(f-3) returns false when [Unreleased] body has a real bullet", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      expect(isUnreleasedEmpty(dir)).toBe(false);
    });

    it("(f-4) returns true when there is no [Unreleased] heading at all (edge case)", () => {
      const dir = withTmpDir();
      writeChangelog(dir, `# Changelog\n\n## [1.3.0] ${EM_DASH} 2026-04-24\n\n### Added\n- x\n`);

      expect(isUnreleasedEmpty(dir)).toBe(true);
    });
  });

  describe("hasReleasedHeading (R2 — independent recovery signal)", () => {
    it("(h-1) returns true when '## [1.4.0] — ...' is present", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      consolidateChangelog(makeContext(dir), "1.4.0", "2026-07-13");

      expect(hasReleasedHeading(dir, "1.4.0")).toBe(true);
    });

    it("(h-2) returns false when only [Unreleased] exists for that version", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      expect(hasReleasedHeading(dir, "1.4.0")).toBe(false);
    });

    it("(h-3) returns true for a pre-existing released heading unrelated to the target write path", () => {
      const dir = withTmpDir();
      writeChangelog(dir, sampleChangelog());

      expect(hasReleasedHeading(dir, "1.3.0")).toBe(true);
    });
  });
});
