// TDD [feniks] — /release Phase 4.1: E2E dry-run smoke against the LIVE repo (ADR-037, plan-037)
// ONE planRelease invocation, read-only. Proves the plan/preflight pipeline makes zero
// filesystem/git mutations against the real, currently-dirty working tree — the
// smoke-before-merge guarantee (project memory: feedback_chekpoint_and_verification).
// NEVER calls applyReleaseWrites or commitAndTag — plan-only, read-only, scope = 1 invocation.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planRelease } from "../../../scripts/lib/release/orchestrate.js";
import type { ReleaseContext, ReleaseDeps } from "../../../scripts/lib/release/types.js";

const FIXED_NOW = new Date("2026-07-13T12:00:00Z");

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    timeout: 5000,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

describe("release/orchestrate — E2E dry-run smoke (live repo, read-only)", () => {
  it("planRelease against the real repo root makes zero mutations and computes a coherent plan", () => {
    // Vitest's cwd IS the repo root here, but derive it via git for robustness — mirrors
    // how the fixture tests locate their tmp-git roots.
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
    }).trim();

    const currentVersion = (
      JSON.parse(
        fs.readFileSync(path.join(repoRoot, ".claude-plugin", "plugin.json"), "utf8"),
      ) as { version: string }
    ).version;

    const ctx: ReleaseContext = {
      cwd: repoRoot,
      options: { level: "minor", dryRun: true, push: false },
      currentVersion,
    };
    const deps: ReleaseDeps = {
      runVerify: () => ({ ok: true, failures: [] }), // GREEN stub — never spawns the real toolchain
      now: () => FIXED_NOW,
    };

    const before = runGit(repoRoot, ["status", "--porcelain"]);

    const plan = planRelease(ctx, deps);

    const after = runGit(repoRoot, ["status", "--porcelain"]);

    // Load-bearing: planRelease against the LIVE repo must be strictly read-only —
    // zero filesystem/git mutations, dirty tree or not.
    expect(after).toBe(before);

    // Computed before preflight runs (computeNextVersion + tagName in orchestrate.ts) —
    // these hold regardless of blocked state.
    expect(plan.nextVersion).toBe("1.4.0");
    expect(plan.tagName).toBe("v1.4.0");
    expect(plan.releaseDate).toBe("2026-07-13");

    // The live repo is currently dirty (this test file, plus the rest of the uncommitted
    // /release build, per `git status --porcelain`) — preflight's DIRTY_TREE gate fires
    // honestly. Asserted truthfully rather than forcing a clean-tree happy path that
    // doesn't match the real repo's current state.
    expect(plan.blocked.length).toBeGreaterThan(0);
    expect(plan.blocked.some((m) => /uncommitted changes/i.test(m))).toBe(true);

    // R3: the three preview fields are computed even when blocked (they were empty-
    // short-circuited before R3) — the common --dry-run-on-a-dirty-tree case. The
    // changelogPreview is the load-bearing R3 evidence: it is non-empty ONLY because
    // planRelease actually ran previewChangelog against the (non-empty) [Unreleased]
    // section rather than returning the blocked-branch "" — so it distinguishes
    // "computed" from "short-circuited". Proven against the LIVE, currently-dirty repo.
    expect(plan.changelogPreview.length).toBeGreaterThan(0);
    expect(plan.changelogPreview).toContain("## [1.4.0]");

    // statusFlipProposals and backlogPrune are computed too, but their EMPTINESS is
    // data-dependent on live repo state (a referenced ADR/plan already at its target
    // status yields no proposal; a fully-pruned BACKLOG yields no done-items), so a
    // non-empty assertion here is fragile against normal doc churn — it broke once when
    // plan-037 shipped to `completed` in the same commit that added this test. Assert
    // the structural invariant only; deterministic content is covered by
    // status-flips.test.ts and backlog-prune.test.ts with fixtures.
    expect(Array.isArray(plan.statusFlipProposals)).toBe(true);
    expect(Array.isArray(plan.backlogPrune)).toBe(true);
  });
});
