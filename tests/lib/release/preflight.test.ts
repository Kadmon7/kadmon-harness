// TDD [feniks] — /release Step 2.1: preflight.ts D4 refusal gates (ADR-037, plan-037)
// Real tmp-git fixture — NEVER mocks child_process, NEVER touches the real repo.
// runVerify is injected (ReleaseDeps) — tests never spawn the real toolchain.
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPreflight } from "../../../scripts/lib/release/preflight.js";
import type { ReleaseContext, ReleaseDeps, VerifyResult } from "../../../scripts/lib/release/types.js";

const EM_DASH = "—"; // U+2014 — matches CHANGELOG.md's released-heading format

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    timeout: 3000,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function initGitRepo(): string {
  const tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "release-preflight-test-"));
  runGit(tmpRepo, ["init"]);
  runGit(tmpRepo, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  runGit(tmpRepo, ["config", "user.email", "test@test.com"]);
  runGit(tmpRepo, ["config", "user.name", "Test"]);
  return tmpRepo;
}

function nonEmptyUnreleasedChangelog(): string {
  return [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    "### Added",
    "- New feature A",
    "",
    `## [1.3.0] ${EM_DASH} 2026-04-24`,
    "",
    "### Added",
    "- Old feature",
    "",
  ].join("\n");
}

function emptyUnreleasedChangelog(): string {
  return [
    "# Changelog",
    "",
    "## [Unreleased]",
    "",
    `## [1.3.0] ${EM_DASH} 2026-04-24`,
    "",
    "### Added",
    "- Old feature",
    "",
  ].join("\n");
}

function seedRepo(dir: string, changelogContent: string): void {
  fs.writeFileSync(path.join(dir, "README.md"), "init\n", "utf8");
  fs.writeFileSync(path.join(dir, "CHANGELOG.md"), changelogContent, "utf8");
  runGit(dir, ["add", "."]);
  runGit(dir, ["commit", "-m", "init"]);
}

function makeReleaseContext(cwd: string, overrides: Partial<ReleaseContext> = {}): ReleaseContext {
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
    now: () => new Date("2026-07-13T00:00:00Z"),
  };
}

function blockerCodes(result: { ok: boolean; blockers?: readonly { code: string }[] }): string[] {
  return (result.blockers ?? []).map((b) => b.code);
}

describe("release/preflight — runPreflight (D4 gates)", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function withTmpRepo(changelogContent = nonEmptyUnreleasedChangelog()): string {
    const dir = initGitRepo();
    tmpDirs.push(dir);
    seedRepo(dir, changelogContent);
    return dir;
  }

  it("(a) clean tree + green verify + non-empty [Unreleased] + on main + no tag -> ok:true", () => {
    const dir = withTmpRepo();
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(true);
  });

  it("(b) an uncommitted file -> DIRTY_TREE blocker", () => {
    const dir = withTmpRepo();
    fs.writeFileSync(path.join(dir, "scratch.txt"), "uncommitted\n", "utf8");
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(false);
    expect(blockerCodes(result)).toContain("DIRTY_TREE");
  });

  it("(c) runVerify returns {ok:false, failures:[...]} -> VERIFY_RED blocker", () => {
    const dir = withTmpRepo();
    const ctx = makeReleaseContext(dir);
    const deps = makeDeps({ ok: false, failures: ["unit test X failed"] });

    const result = runPreflight(ctx, "1.4.0", deps);

    expect(result.ok).toBe(false);
    expect(blockerCodes(result)).toContain("VERIFY_RED");
  });

  it("(d) empty [Unreleased] fixture -> EMPTY_UNRELEASED blocker", () => {
    const dir = withTmpRepo(emptyUnreleasedChangelog());
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(false);
    expect(blockerCodes(result)).toContain("EMPTY_UNRELEASED");
  });

  it("(e) checkout branch feature/x -> NOT_ON_MAIN blocker", () => {
    const dir = withTmpRepo();
    runGit(dir, ["checkout", "-b", "feature/x"]);
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(false);
    expect(blockerCodes(result)).toContain("NOT_ON_MAIN");
  });

  it("(f) pre-create tag v1.4.0 -> TAG_EXISTS blocker", () => {
    const dir = withTmpRepo();
    runGit(dir, ["tag", "-a", "v1.4.0", "-m", "pre-existing release"]);
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(false);
    expect(blockerCodes(result)).toContain("TAG_EXISTS");
  });

  it("(g) collect-all: two simultaneous failures (dirty tree AND not on main) both appear in blockers", () => {
    const dir = withTmpRepo();
    runGit(dir, ["checkout", "-b", "feature/x"]);
    fs.writeFileSync(path.join(dir, "scratch.txt"), "uncommitted\n", "utf8");
    const ctx = makeReleaseContext(dir);

    const result = runPreflight(ctx, "1.4.0", makeDeps());

    expect(result.ok).toBe(false);
    const codes = blockerCodes(result);
    expect(codes).toContain("DIRTY_TREE");
    expect(codes).toContain("NOT_ON_MAIN");
  });
});
