// TDD [feniks] — /release Step 1.6: tag.ts (ADR-037, plan-037)
// Real tmp-git fixture — NEVER mocks child_process, NEVER touches the real repo/tags.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { tagExists, createReleaseTag } from "../../../scripts/lib/release/tag.js";
import type { ReleaseContext, StepResult, ReleaseError } from "../../../scripts/lib/release/types.js";

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    timeout: 3000,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function makeReleaseContext(cwd: string): ReleaseContext {
  return {
    cwd,
    options: { level: "patch", dryRun: false, push: false },
    currentVersion: "1.3.0",
  };
}

describe("release/tag", () => {
  let tmpRepo: string;
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    tmpRepo = fs.mkdtempSync(path.join(os.tmpdir(), "release-tag-test-"));
    runGit(tmpRepo, ["init"]);
    runGit(tmpRepo, ["config", "user.email", "test@test.com"]);
    runGit(tmpRepo, ["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(tmpRepo, "README.md"), "init\n", "utf8");
    runGit(tmpRepo, ["add", "."]);
    runGit(tmpRepo, ["commit", "-m", "init"]);
  });

  afterEach(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("(a) createReleaseTag on an absent tag creates it — present in `git tag -l` afterward", () => {
    const ctx = makeReleaseContext(tmpRepo);

    const result = createReleaseTag(ctx, "v1.3.1", "Release v1.3.1");

    expect(result.status).toBe("applied");
    const listing = runGit(tmpRepo, ["tag", "-l"]);
    expect(
      listing
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    ).toContain("v1.3.1");
  });

  it("(b) is idempotent — tag already exists → skipped, no error", () => {
    const ctx = makeReleaseContext(tmpRepo);

    const first = createReleaseTag(ctx, "v1.3.1", "Release v1.3.1");
    expect(first.status).toBe("applied");

    const second = createReleaseTag(ctx, "v1.3.1", "Release v1.3.1");

    expect(second.status).toBe("skipped");
    expect(second.message).toMatch(/already exists/i);
  });

  it("(c) the annotated tag's message includes the version", () => {
    const ctx = makeReleaseContext(tmpRepo);

    createReleaseTag(ctx, "v2.0.0", "Release 2.0.0 (major bump)");

    const contents = runGit(tmpRepo, [
      "for-each-ref",
      "--format=%(contents)",
      "refs/tags/v2.0.0",
    ]);
    expect(contents).toContain("2.0.0");
  });

  it("(d) tagExists returns true/false correctly", () => {
    expect(tagExists(tmpRepo, "v9.9.9")).toBe(false);

    const ctx = makeReleaseContext(tmpRepo);
    createReleaseTag(ctx, "v9.9.9", "Release v9.9.9");

    expect(tagExists(tmpRepo, "v9.9.9")).toBe(true);
  });

  it("(e) git-error path — invalid tag name surfaces a failed StepResult (GIT error), never throws", () => {
    const ctx = makeReleaseContext(tmpRepo);
    let result: StepResult | undefined;

    expect(() => {
      result = createReleaseTag(ctx, "bad tag name", "message");
    }).not.toThrow();

    expect(result?.status).toBe("failed");
    expect(result?.message.length).toBeGreaterThan(0);
    expect((result?.details as ReleaseError | undefined)?.code).toBe("GIT");
    // and the invalid ref genuinely never landed as a tag
    expect(tagExists(tmpRepo, "bad tag name")).toBe(false);
  });

  it("(f) tagExists logs a warn to stderr on git failure, and still returns false (silent-swallow fix)", () => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const nonRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-tag-non-repo-"));

    try {
      const result = tagExists(nonRepoDir, "v1.0.0");

      expect(result).toBe(false);
      expect(stderrSpy).toHaveBeenCalled();

      const entry = JSON.parse(String(stderrSpy.mock.calls[0][0]).trim());
      expect(entry.level).toBe("warn");
      expect(entry.operation).toBe("tagExists");
      expect(entry.fallback).toMatch(/false/i);
      expect(typeof entry.error).toBe("string");
      expect(entry.error.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(nonRepoDir, { recursive: true, force: true });
    }
  });
});
