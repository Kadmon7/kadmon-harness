// TDD [feniks] — /release backlog-prune (plan-037 Step 1.4, ARCHITECT OVERRIDE)
// AMBIGUITY-1 resolved to PRUNE-ONLY + WARN (not the plan's machine sub-heading append):
//   pruneBacklog removes [x] lines from BACKLOG.md and leaves CHANGELOG.md byte-identical.
//   As a safety net, it surfaces UnnarratedPruneWarning for any pruned id NOT found in the
//   (read-only) changelog text, so nothing marked done-but-never-narrated is silently dropped.
import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ReleaseContext } from "../../../scripts/lib/release/types.js";
import { collectDoneItems, pruneBacklog } from "../../../scripts/lib/release/backlog-prune.js";

const BACKLOG_FIXTURE = `# BACKLOG — Test

## P0 — broken now

- [x] AUD-01 First done item (narrated in changelog)
- [ ] AUD-02 Open item, must survive prune
- [x] AUD-03 Second done item (NOT narrated in changelog)

## P1 — consistency

- [~] AUD-04 In progress item, must survive prune
- [x] R-01 Third done item (narrated in changelog)
- [-] AUD-05 Dropped item, must survive prune

## P2 — features

- [d] AUD-06 Deferred item, must survive prune
- [x] R-02 Fourth done item (NOT narrated in changelog)
`;

const CHANGELOG_FIXTURE = `# Changelog

## [Unreleased]

### Added
- Fixed AUD-01 issue with the observation logger
- Shipped the R-01 improvement to session summaries

## [1.3.0] — 2026-04-24

### Added
- Initial release
`;

const EMPTY_DONE_BACKLOG = `# BACKLOG — Test

## P0 — broken now

- [ ] AUD-10 Open item only
- [~] AUD-11 In progress only
- [-] AUD-12 Dropped only
- [d] AUD-13 Deferred only
`;

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "backlog-prune-test-"));
}

function writeFixture(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function makeCtx(cwd: string): ReleaseContext {
  return {
    cwd,
    options: { level: "patch", dryRun: false, push: false },
    currentVersion: "1.3.0",
  };
}

describe("backlog-prune", () => {
  let tmpDir: string | undefined;

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  describe("collectDoneItems", () => {
    it("(a) returns only [x] lines, excludes [ ]/[~]/[-]/[d]", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);

      const done = collectDoneItems(tmpDir);

      expect(done).toHaveLength(4);
      expect(done).toContain("- [x] AUD-01 First done item (narrated in changelog)");
      expect(done).toContain("- [x] AUD-03 Second done item (NOT narrated in changelog)");
      expect(done).toContain("- [x] R-01 Third done item (narrated in changelog)");
      expect(done).toContain("- [x] R-02 Fourth done item (NOT narrated in changelog)");
      for (const line of done) {
        expect(line.startsWith("- [x] ")).toBe(true);
      }
    });

    it("(h-collect) returns empty array when no [x] items exist", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", EMPTY_DONE_BACKLOG);

      const done = collectDoneItems(tmpDir);

      expect(done).toEqual([]);
    });
  });

  describe("pruneBacklog", () => {
    it("(b) removes [x] lines from BACKLOG.md", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      pruneBacklog(makeCtx(tmpDir), changelogPath);

      const backlogAfter = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");
      expect(backlogAfter).not.toMatch(/\[x\] AUD-01/);
      expect(backlogAfter).not.toMatch(/\[x\] AUD-03/);
      expect(backlogAfter).not.toMatch(/\[x\] R-01/);
      expect(backlogAfter).not.toMatch(/\[x\] R-02/);
    });

    it("(c) preserves ## P0/P1/P2 headers and every non-[x] item", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      pruneBacklog(makeCtx(tmpDir), changelogPath);

      const backlogAfter = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");
      expect(backlogAfter).toContain("## P0 — broken now");
      expect(backlogAfter).toContain("## P1 — consistency");
      expect(backlogAfter).toContain("## P2 — features");
      expect(backlogAfter).toContain("- [ ] AUD-02 Open item, must survive prune");
      expect(backlogAfter).toContain("- [~] AUD-04 In progress item, must survive prune");
      expect(backlogAfter).toContain("- [-] AUD-05 Dropped item, must survive prune");
      expect(backlogAfter).toContain("- [d] AUD-06 Deferred item, must survive prune");
    });

    it("(d) leaves CHANGELOG.md byte-identical (prune-only — no CHANGELOG write)", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);
      const changelogBefore = fs.readFileSync(changelogPath, "utf8");
      const statBefore = fs.statSync(changelogPath);

      pruneBacklog(makeCtx(tmpDir), changelogPath);

      const changelogAfter = fs.readFileSync(changelogPath, "utf8");
      const statAfter = fs.statSync(changelogPath);
      expect(changelogAfter).toBe(changelogBefore);
      expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
    });

    it("(e) idempotent — re-run with no [x] left is skipped, BACKLOG untouched", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      const first = pruneBacklog(makeCtx(tmpDir), changelogPath);
      expect(first.status).toBe("applied");
      const backlogAfterFirst = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");

      const second = pruneBacklog(makeCtx(tmpDir), changelogPath);

      expect(second.status).toBe("skipped");
      const backlogAfterSecond = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");
      expect(backlogAfterSecond).toBe(backlogAfterFirst);
    });

    it("(f) a pruned item whose id IS narrated in the changelog produces no warning", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      const result = pruneBacklog(makeCtx(tmpDir), changelogPath);

      const details = result.details as { warnings: readonly { line: string; id: string }[] };
      const warningIds = details.warnings.map((w) => w.id);
      expect(warningIds).not.toContain("AUD-01");
      expect(warningIds).not.toContain("R-01");
    });

    it("(g) a pruned item whose id is NOT in the changelog surfaces as a warning", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      const result = pruneBacklog(makeCtx(tmpDir), changelogPath);

      const details = result.details as { warnings: readonly { line: string; id: string }[] };
      const warningIds = details.warnings.map((w) => w.id);
      expect(warningIds).toContain("AUD-03");
      expect(warningIds).toContain("R-02");
      const auD03 = details.warnings.find((w) => w.id === "AUD-03");
      expect(auD03?.line).toBe("- [x] AUD-03 Second done item (NOT narrated in changelog)");
    });

    it("(h) empty done-set is skipped, BACKLOG untouched, no warnings", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", EMPTY_DONE_BACKLOG);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);
      const backlogBefore = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");

      const result = pruneBacklog(makeCtx(tmpDir), changelogPath);

      expect(result.status).toBe("skipped");
      expect(result.filesTouched).toEqual([]);
      const backlogAfter = fs.readFileSync(path.join(tmpDir, "BACKLOG.md"), "utf8");
      expect(backlogAfter).toBe(backlogBefore);
    });

    it("returns filesTouched: ['BACKLOG.md'] and step:'backlog-prune' on apply", () => {
      tmpDir = makeTmpDir();
      writeFixture(tmpDir, "BACKLOG.md", BACKLOG_FIXTURE);
      const changelogPath = writeFixture(tmpDir, "CHANGELOG.md", CHANGELOG_FIXTURE);

      const result = pruneBacklog(makeCtx(tmpDir), changelogPath);

      expect(result.step).toBe("backlog-prune");
      expect(result.status).toBe("applied");
      expect(result.filesTouched).toEqual(["BACKLOG.md"]);
    });
  });
});
