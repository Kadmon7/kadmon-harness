// TDD [feniks] — /release Step 2.2: orchestrate.ts — sequence the phases (ADR-037, plan-037)
// Real tmp-git fixture — NEVER mocks child_process, NEVER touches the real repo.
// Injected green runVerify + fixed now — these tests never spawn the real toolchain.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  planRelease,
  applyReleaseWrites,
  commitAndTag,
} from "../../../scripts/lib/release/orchestrate.js";
import { hasReleasedHeading } from "../../../scripts/lib/release/changelog.js";
import type {
  ReleaseContext,
  ReleaseDeps,
  VerifyResult,
} from "../../../scripts/lib/release/types.js";

const EM_DASH = "—"; // U+2014 — matches CHANGELOG.md's released-heading format
const FIXED_NOW = new Date("2026-07-13T12:00:00Z");

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function commitCount(cwd: string): number {
  return Number(runGit(cwd, ["rev-list", "--count", "HEAD"]).trim());
}

function tagList(cwd: string): string[] {
  return runGit(cwd, ["tag", "-l"])
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function pluginVersion(dir: string): string {
  const raw = fs.readFileSync(path.join(dir, ".claude-plugin", "plugin.json"), "utf8");
  return (JSON.parse(raw) as { version: string }).version;
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function initGitRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-orchestrate-test-"));
  runGit(dir, ["init"]);
  runGit(dir, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  runGit(dir, ["config", "user.email", "test@test.com"]);
  runGit(dir, ["config", "user.name", "Test"]);
  return dir;
}

function seedRepo(dir: string, opts: { changelogUnreleasedBody?: string } = {}): void {
  fs.mkdirSync(path.join(dir, ".claude-plugin"), { recursive: true });
  writeJson(path.join(dir, ".claude-plugin", "plugin.json"), {
    name: "kadmon-harness",
    version: "1.3.0",
  });
  writeJson(path.join(dir, "package.json"), { name: "kadmon-harness", version: "1.3.0" });

  const unreleasedBody = (opts.changelogUnreleasedBody ?? "### Added\n- New feature A\n").trimEnd();
  const changelog = [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    unreleasedBody,
    "",
    `## [1.3.0] ${EM_DASH} 2026-04-24`,
    "",
    "### Added",
    "- Old feature",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), changelog, "utf8");

  const backlog = [
    "# BACKLOG",
    "",
    "## P0 — broken now",
    "",
    "- [x] AUD-01 Done item",
    "- [ ] AUD-02 Open item, must survive",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "BACKLOG.md"), backlog, "utf8");

  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", "init"]);
}

function makeCtx(cwd: string, overrides: Partial<ReleaseContext> = {}): ReleaseContext {
  return {
    cwd,
    options: { level: "minor", dryRun: false, push: false },
    currentVersion: "1.3.0",
    ...overrides,
  };
}

function makeDeps(runVerifyResult: VerifyResult = { ok: true, failures: [] }): ReleaseDeps {
  return {
    runVerify: () => runVerifyResult,
    now: () => FIXED_NOW,
  };
}

describe("release/orchestrate", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function withRepo(opts?: { changelogUnreleasedBody?: string }): string {
    const dir = initGitRepo();
    tmpDirs.push(dir);
    seedRepo(dir, opts);
    return dir;
  }

  it("(a) planRelease on a clean fixture computes nextVersion/tagName/releaseDate, blocked empty", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);

    const plan = planRelease(ctx, makeDeps());

    expect(plan.currentVersion).toBe("1.3.0");
    expect(plan.nextVersion).toBe("1.4.0");
    expect(plan.tagName).toBe("v1.4.0");
    expect(plan.releaseDate).toBe("2026-07-13");
    expect(plan.blocked).toEqual([]);
    expect(plan.changelogPreview).toContain(`## [1.4.0] ${EM_DASH} 2026-07-13`);
    expect(plan.backlogPrune).toContain("- [x] AUD-01 Done item");
    expect(["patch", "minor", "major"]).toContain(plan.suggestedLevel);
  });

  it("(b) applyReleaseWrites writes files but leaves them uncommitted (no commit, no tag)", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);
    const commitsBefore = commitCount(dir);

    const results = applyReleaseWrites(ctx, plan, deps);

    expect(results.map((r) => r.status)).toEqual(["applied", "applied", "applied"]);
    expect(pluginVersion(dir)).toBe("1.4.0");
    expect(runGit(dir, ["status", "--porcelain"]).trim()).not.toBe("");
    expect(commitCount(dir)).toBe(commitsBefore);
    expect(tagList(dir)).toEqual([]);
  });

  it("(c) commitAndTag produces exactly one new commit + one annotated tag", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);
    applyReleaseWrites(ctx, plan, deps);
    const commitsBefore = commitCount(dir);

    const results = commitAndTag(ctx, plan, deps);

    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);
    expect(commitCount(dir)).toBe(commitsBefore + 1);
    expect(tagList(dir)).toEqual([plan.tagName]);
  });

  it("(d) commit body contains the Reviewed: skip (release metadata) footer", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);
    applyReleaseWrites(ctx, plan, deps);

    commitAndTag(ctx, plan, deps);

    const body = runGit(dir, ["log", "-1", "--format=%B"]);
    expect(body).toContain(`Reviewed: skip (release metadata ${EM_DASH} verified mechanically)`);
  });

  it("(e) idempotent recovery: committed-but-untagged state -> writes skip, only the tag is created", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);

    // Pre-seed a committed-but-untagged state: run the write phase, then commit
    // manually WITHOUT tagging (simulates a crash between commit and tag).
    applyReleaseWrites(ctx, plan, deps);
    // R2: the recovery predicate requires BOTH signals — version bumped on disk AND
    // the dated CHANGELOG heading actually landed — never just a coincidental version match.
    expect(hasReleasedHeading(dir, plan.nextVersion)).toBe(true);
    runGit(dir, ["add", "-A"]);
    runGit(dir, ["commit", "-m", "chore(release): manual pre-seed, no tag"]);
    const commitsAfterPreseed = commitCount(dir);
    expect(tagList(dir)).toEqual([]);

    // Re-run the full sequence with the same ctx (mirrors a retry within one session).
    const plan2 = planRelease(ctx, deps);
    expect(plan2.blocked).toEqual([]);

    const writeResults = applyReleaseWrites(ctx, plan2, deps);
    expect(writeResults.every((r) => r.status === "skipped")).toBe(true);

    const commitTagResults = commitAndTag(ctx, plan2, deps);

    expect(commitTagResults[0].status).toBe("skipped"); // nothing to commit
    expect(commitTagResults[1].status).toBe("applied"); // only the missing tag is created
    expect(commitCount(dir)).toBe(commitsAfterPreseed); // no second release commit
    expect(tagList(dir)).toEqual([plan2.tagName]);
  });

  it("(f) blocked plan (dirty tree) -> applyReleaseWrites refuses, makes zero writes; previews still populate (R3)", () => {
    const dir = withRepo({
      changelogUnreleasedBody: "### Added\n- New /release command — see ADR-037 for design.\n",
    });
    const decisionsDir = path.join(dir, "docs", "decisions");
    fs.mkdirSync(decisionsDir, { recursive: true });
    fs.writeFileSync(
      path.join(decisionsDir, "ADR-037-test-decision.md"),
      "---\nnumber: 037\ntitle: Test\ndate: 2026-07-13\nstatus: proposed\n---\n\n# ADR-037\n",
      "utf8",
    );
    runGit(dir, ["add", "."]);
    runGit(dir, ["commit", "-m", "add ADR-037 stub"]);

    fs.writeFileSync(path.join(dir, "scratch.txt"), "uncommitted\n", "utf8");
    const ctx = makeCtx(dir);
    const deps = makeDeps();

    const plan = planRelease(ctx, deps);
    expect(plan.blocked.length).toBeGreaterThan(0);

    // R3: changelogPreview/backlogPrune/statusFlipProposals are pure read-only
    // computations -- they must populate even when blocked, so --dry-run on the
    // common dirty-tree case still shows the preview alongside the blockers.
    expect(plan.changelogPreview).toContain(`## [1.4.0] ${EM_DASH}`);
    expect(plan.backlogPrune).toContain("- [x] AUD-01 Done item");
    expect(plan.statusFlipProposals.length).toBeGreaterThan(0);

    const results = applyReleaseWrites(ctx, plan, deps);

    expect(results).toHaveLength(1);
    expect(["blocked", "failed"]).toContain(results[0].status);
    expect(pluginVersion(dir)).toBe("1.3.0"); // unchanged — zero writes
  });

  it("(g) TAG_EXISTS: pre-created tag makes planRelease.blocked a full no-op", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    runGit(dir, ["tag", "-a", "v1.4.0", "-m", "pre-existing release"]);

    const plan = planRelease(ctx, deps);

    expect(plan.blocked.length).toBeGreaterThan(0);
    expect(plan.blocked.some((m) => /already released/i.test(m))).toBe(true);

    const results = applyReleaseWrites(ctx, plan, deps);
    expect(results).toHaveLength(1);
    expect(pluginVersion(dir)).toBe("1.3.0"); // unchanged — full no-op
  });

  it("(h) status-flip proposals are returned by planRelease but written to no file", () => {
    const dir = withRepo({
      changelogUnreleasedBody: "### Added\n- New /release command — see ADR-037 for design.\n",
    });
    const decisionsDir = path.join(dir, "docs", "decisions");
    fs.mkdirSync(decisionsDir, { recursive: true });
    const adrPath = path.join(decisionsDir, "ADR-037-test-decision.md");
    fs.writeFileSync(
      adrPath,
      "---\nnumber: 037\ntitle: Test\ndate: 2026-07-13\nstatus: proposed\n---\n\n# ADR-037\n",
      "utf8",
    );
    runGit(dir, ["add", "."]);
    runGit(dir, ["commit", "-m", "add ADR-037 stub"]);

    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);

    expect(plan.statusFlipProposals.length).toBeGreaterThan(0);

    applyReleaseWrites(ctx, plan, deps);

    expect(fs.existsSync(path.join(dir, "WORK.md"))).toBe(false);
    const adrAfter = fs.readFileSync(adrPath, "utf8");
    expect(adrAfter).toContain("status: proposed"); // never auto-flipped
  });

  it("(i) coincidental version match without a released heading does NOT trigger recovery -- EMPTY_UNRELEASED still blocks (R2)", () => {
    const dir = withRepo({ changelogUnreleasedBody: "" });
    // Manually set plugin.json to the WOULD-BE next version, unrelated to any actual
    // release run -- simulates a coincidental/manual version edit, not a genuine
    // partial release (no CHANGELOG consolidation ever happened for this version).
    writeJson(path.join(dir, ".claude-plugin", "plugin.json"), {
      name: "kadmon-harness",
      version: "1.4.0",
    });
    runGit(dir, ["add", "-A"]);
    runGit(dir, ["commit", "-m", "unrelated manual version edit"]);

    const ctx = makeCtx(dir); // currentVersion "1.3.0" + level "minor" -> nextVersion "1.4.0" too
    const deps = makeDeps();

    expect(hasReleasedHeading(dir, "1.4.0")).toBe(false);

    const plan = planRelease(ctx, deps);

    expect(plan.nextVersion).toBe("1.4.0");
    // Recovery must NOT fire on the version-file match alone -- the empty-Unreleased
    // blocker stays in force, preventing a hollow (hand-typed-but-empty) release.
    expect(plan.blocked.some((m) => /nothing to release/i.test(m))).toBe(true);
  });

  it("(k) commitRelease stages only the release allowlist -- a stray dirty file outside it survives uncommitted (R1)", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);
    applyReleaseWrites(ctx, plan, deps);

    // Simulate a concurrent-session / user edit landing in the re-dirtied window
    // between the write phase and the commit phase -- must NEVER fold into the release
    // commit under the "Reviewed: skip" footer.
    fs.writeFileSync(path.join(dir, "stray.txt"), "unrelated concurrent edit\n", "utf8");

    const results = commitAndTag(ctx, plan, deps);

    expect(results.map((r) => r.status)).toEqual(["applied", "applied"]);

    const porcelainAfter = runGit(dir, ["status", "--porcelain"]).trim();
    expect(porcelainAfter).toContain("stray.txt");

    const committedFiles = runGit(dir, ["show", "--name-only", "--format=", "HEAD"])
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    expect(committedFiles).not.toContain("stray.txt");
  });

  it("(l) recovery with a stray dirty file present: scoped porcelain is empty -> commit skipped, tag still created, stray left untouched (R1)", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps); // blocked: [] -- clean tree at this point
    applyReleaseWrites(ctx, plan, deps);
    runGit(dir, ["add", "-A"]);
    runGit(dir, ["commit", "-m", "chore(release): manual pre-seed, no tag"]);
    const commitsAfterPreseed = commitCount(dir);

    // A stray dirty file lands in the window before the retry's commit phase runs --
    // must not be mistaken for release work and must never be staged.
    fs.writeFileSync(path.join(dir, "stray.txt"), "unrelated concurrent edit\n", "utf8");

    const results = commitAndTag(ctx, plan, deps); // reuse the original plan (blocked: [])

    expect(results[0].status).toBe("skipped"); // scoped porcelain is empty
    expect(results[1].status).toBe("applied"); // tag still created
    expect(commitCount(dir)).toBe(commitsAfterPreseed); // no extra commit
    expect(tagList(dir)).toEqual([plan.tagName]);

    const porcelainAfter = runGit(dir, ["status", "--porcelain"]).trim();
    expect(porcelainAfter).toContain("stray.txt"); // stray left untouched
  });

  it("(m) commitAndTag refuses an incomplete release -- version bumped but CHANGELOG not consolidated (R5)", () => {
    const dir = withRepo();
    const ctx = makeCtx(dir);
    const deps = makeDeps();
    const plan = planRelease(ctx, deps);

    // Simulate a partial write: version bump landed, CHANGELOG consolidation did not
    // (e.g. a crash between the two write steps) -- then the partial state is committed,
    // so plan.blocked (computed before any of this) stays [] and the tree is clean.
    writeJson(path.join(dir, ".claude-plugin", "plugin.json"), {
      name: "kadmon-harness",
      version: plan.nextVersion,
    });
    writeJson(path.join(dir, "package.json"), { name: "kadmon-harness", version: plan.nextVersion });
    runGit(dir, ["add", "-A"]);
    runGit(dir, ["commit", "-m", "partial: version bump only, no changelog consolidation"]);
    const commitsBefore = commitCount(dir);

    const results = commitAndTag(ctx, plan, deps);

    expect(results).toHaveLength(1);
    expect(results[0].step).toBe("commit");
    expect(results[0].status).toBe("failed");
    expect(results[0].message.toLowerCase()).toContain("incomplete");
    expect(commitCount(dir)).toBe(commitsBefore); // no commit created
    expect(tagList(dir)).toEqual([]); // no tag created
  });
});
