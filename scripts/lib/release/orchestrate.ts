// Kadmon Harness — /release Step 2.2: orchestrate.ts — sequence the phases (ADR-037, plan-037)
// Split into planRelease / applyReleaseWrites / commitAndTag so release.md can slot the
// /doks slash-command call between the TS writes and the commit (AMBIGUITY-3). Real git
// mutation lives only in commitAndTag; planRelease and applyReleaseWrites never commit/tag.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type {
  BumpLevel,
  ReleaseContext,
  ReleaseDeps,
  ReleaseError,
  ReleasePlan,
  StepResult,
} from "./types.js";
import { computeNextVersion, applyVersionBump } from "./version-bump.js";
import { previewChangelog, consolidateChangelog, hasReleasedHeading } from "./changelog.js";
import { collectDoneItems, pruneBacklog } from "./backlog-prune.js";
import { proposeStatusFlips } from "./status-flips.js";
import { tagExists, createReleaseTag } from "./tag.js";
import { runPreflight } from "./preflight.js";

const GIT_TIMEOUT_MS = 3000;
const RELEASE_FILES = [".claude-plugin/plugin.json", "package.json", "CHANGELOG.md", "BACKLOG.md"] as const;
// The Layer-1 files /doks reconciles between the TS writes and the commit (AMBIGUITY-3).
const DOKS_SYNC_FILES = ["CLAUDE.md", "README.md"] as const;
// R1: the release commit's dirty-check AND staging are BOTH bounded to this allowlist —
// never `git add -A`. The DIRTY_TREE preflight gate (preflight.ts) only runs once, at
// planRelease() time; the tree is intentionally re-dirtied afterward (writes -> /doks ->
// re-verify) before commitRelease runs, so an unscoped `git add -A` here would fold any
// concurrent-session / user edit made in that window into the "Reviewed: skip" commit.
const COMMIT_ALLOWLIST = [...RELEASE_FILES, ...DOKS_SYNC_FILES] as const;
const REVIEWED_FOOTER = "Reviewed: skip (release metadata — verified mechanically)"; // D3/ADR-025

function runGit(cwd: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd,
    timeout: GIT_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function extractGitStderr(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null || !("stderr" in e)) return undefined;
  const stderr = (e as { stderr: unknown }).stderr;
  if (typeof stderr === "string") return stderr;
  if (Buffer.isBuffer(stderr)) return stderr.toString("utf8");
  return undefined;
}

function toGitError(command: string, e: unknown): ReleaseError {
  const detail = extractGitStderr(e) ?? (e instanceof Error ? e.message : String(e));
  return { code: "GIT", message: `${command} failed: ${detail.trim()}` };
}

function blockedResult(blocked: readonly string[]): StepResult {
  return {
    step: "release",
    status: "blocked",
    message: `Release blocked by preflight: ${blocked.join("; ")}`,
    filesTouched: [],
  };
}

/** Advisory-only scan of the changelog preview text (D1) — the explicit bump arg always wins. */
function scanSuggestedLevel(previewText: string): BumpLevel {
  if (/^### Removed/m.test(previewText)) return "major";
  const hasFixed = /^### Fixed/m.test(previewText);
  const hasOtherSubsection = /^### (Added|Changed|Deprecated|Security)/m.test(previewText);
  if (hasFixed && !hasOtherSubsection) return "patch";
  return "minor";
}

/**
 * True when the plugin.json on disk already carries `targetVersion` — the signal that a
 * prior partial run already bumped the version (committed-but-untagged recovery, D4).
 */
function isVersionAlreadyBumped(cwd: string, targetVersion: string): boolean {
  try {
    const raw = fs.readFileSync(path.join(cwd, ".claude-plugin", "plugin.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return parsed.version === targetVersion;
  } catch {
    return false;
  }
}

/**
 * Computes the release plan: next version, tag name, changelog preview, backlog prune
 * candidates, and status-flip proposals (output only, D5). No writes, no git mutation.
 */
export function planRelease(ctx: ReleaseContext, deps: ReleaseDeps): ReleasePlan {
  const releaseDate = deps.now().toISOString().slice(0, 10);
  const nextVersion = computeNextVersion(ctx.currentVersion, ctx.options.level);
  const tagName = `v${nextVersion}`;

  const preflight = runPreflight(ctx, nextVersion, deps);
  let blocked: readonly string[] = [];

  if (!preflight.ok) {
    // Recovery: the version was already bumped in a prior partial run and the tag is
    // still missing. EMPTY_UNRELEASED is then a false positive — the fresh [Unreleased]
    // is empty because THIS version's content was already consolidated, not because
    // there is genuinely nothing to release (idempotent-recovery, D4).
    //
    // R2: two INDEPENDENT signals are required, not just the version match. A
    // coincidental/manual plugin.json edit that happens to equal nextVersion — with no
    // real CHANGELOG consolidation — must never waive EMPTY_UNRELEASED and produce a
    // hollow (empty-body) dated release.
    //
    // Cross-process limitation (documented, not fixed here): this predicate only fires
    // for a SAME-SESSION retry, where `ctx.currentVersion` is still the pre-bump value.
    // A fresh cross-process /release invocation after a real crash reads the
    // already-bumped version from plugin.json, so nextVersion recomputes higher and
    // recovery does NOT fire — completing that release then requires re-running with
    // the original level context or a manual `git tag`.
    const recovering =
      isVersionAlreadyBumped(ctx.cwd, nextVersion) &&
      hasReleasedHeading(ctx.cwd, nextVersion) &&
      !tagExists(ctx.cwd, tagName);
    const blockers = recovering
      ? preflight.blockers.filter((b) => b.code !== "EMPTY_UNRELEASED")
      : preflight.blockers;
    blocked = blockers.map((b) => b.message);
  }

  // R3: changelogPreview/backlogPrune/statusFlipProposals are pure read-only
  // computations (no writes, no git mutation) — always compute them regardless of
  // `blocked`, so the common `--dry-run` case (usually a dirty tree -> blocked) still
  // surfaces the preview alongside the blockers instead of hiding it.
  const changelogPreview = previewChangelog(ctx.cwd, nextVersion, releaseDate);
  const suggestedLevel = blocked.length > 0 ? ctx.options.level : scanSuggestedLevel(changelogPreview);
  const backlogPrune = collectDoneItems(ctx.cwd);
  const statusFlipProposals = proposeStatusFlips(ctx);

  return {
    currentVersion: ctx.currentVersion,
    nextVersion,
    bumpLevel: ctx.options.level,
    suggestedLevel,
    tagName,
    releaseDate,
    changelogPreview,
    filesToTouch: blocked.length > 0 ? [] : [...RELEASE_FILES],
    backlogPrune,
    statusFlipProposals,
    blocked,
  };
}

/**
 * Writes plugin.json + package.json (version-bump) -> CHANGELOG.md (consolidate) ->
 * BACKLOG.md (prune), in order. Does NOT commit or tag. Status-flip proposals are
 * output only — never written anywhere (no WORK.md, no auto-flip, D5).
 */
export function applyReleaseWrites(
  ctx: ReleaseContext,
  plan: ReleasePlan,
  _deps: ReleaseDeps,
): readonly StepResult[] {
  if (plan.blocked.length > 0) {
    return [blockedResult(plan.blocked)];
  }

  const versionResult = applyVersionBump(ctx, plan.nextVersion);
  const changelogResult = consolidateChangelog(ctx, plan.nextVersion, plan.releaseDate);
  const changelogPath = path.join(ctx.cwd, "CHANGELOG.md");
  const backlogResult = pruneBacklog(ctx, changelogPath);

  return [versionResult, changelogResult, backlogResult];
}

/**
 * Stages + commits the release writes (skipped gracefully when there is nothing to
 * commit — the idempotent-recovery case) then creates the annotated tag. Writes ->
 * commit -> tag ordering (D4); the tag is the final durable act.
 */
function commitRelease(ctx: ReleaseContext, plan: ReleasePlan): StepResult {
  // R1: scoped to COMMIT_ALLOWLIST, not the whole tree — a stray file OUTSIDE the
  // allowlist must never make this look like there's release work to commit (critical
  // for the recovery "nothing to commit -> skipped" branch below).
  let porcelain: string;
  try {
    porcelain = runGit(ctx.cwd, ["status", "--porcelain", "--", ...COMMIT_ALLOWLIST]).trim();
  } catch (e: unknown) {
    const error = toGitError("git status --porcelain", e);
    return { step: "commit", status: "failed", message: error.message, filesTouched: [], details: error };
  }

  if (porcelain === "") {
    return {
      step: "commit",
      status: "skipped",
      message: "Nothing to commit — release writes already committed in a prior run",
      filesTouched: [],
    };
  }

  const body = `Version bump, CHANGELOG consolidation, BACKLOG prune for ${plan.tagName}.\n\n${REVIEWED_FOOTER}`;

  // `git add` (unlike `git status`) fails fast on a pathspec that matches nothing on
  // disk — filter to files that actually exist. RELEASE_FILES are always present at
  // this point (just written by applyReleaseWrites); DOKS_SYNC_FILES may legitimately
  // be untouched by a given /doks run.
  const filesToStage = COMMIT_ALLOWLIST.filter((f) => fs.existsSync(path.join(ctx.cwd, f)));

  try {
    runGit(ctx.cwd, ["add", "--", ...filesToStage]);
    runGit(ctx.cwd, ["commit", "-m", `chore(release): ${plan.tagName}`, "-m", body]);
  } catch (e: unknown) {
    const error = toGitError("git commit", e);
    return { step: "commit", status: "failed", message: error.message, filesTouched: [], details: error };
  }

  return {
    step: "commit",
    status: "applied",
    message: `Committed release ${plan.tagName}`,
    filesTouched: [],
  };
}

/**
 * R5: confirms the release writes actually landed on disk before ANY git write —
 * a non-throwing `failed` write-step (e.g. changelog consolidation failed) must never
 * still reach a commit. Both signals are pure fs reads, independent of git/commit state.
 */
function isReleaseWritesComplete(ctx: ReleaseContext, plan: ReleasePlan): boolean {
  return (
    isVersionAlreadyBumped(ctx.cwd, plan.nextVersion) &&
    hasReleasedHeading(ctx.cwd, plan.nextVersion)
  );
}

export function commitAndTag(
  ctx: ReleaseContext,
  plan: ReleasePlan,
  _deps: ReleaseDeps,
): readonly StepResult[] {
  if (plan.blocked.length > 0) {
    return [blockedResult(plan.blocked)];
  }

  if (!isReleaseWritesComplete(ctx, plan)) {
    return [
      {
        step: "commit",
        status: "failed",
        message:
          "Refusing to commit: release writes incomplete (version bump or CHANGELOG consolidation did not land)",
        filesTouched: [],
        details: { nextVersion: plan.nextVersion },
      },
    ];
  }

  const commitResult = commitRelease(ctx, plan);
  const tagResult = createReleaseTag(ctx, plan.tagName, `Release ${plan.tagName}`);

  return [commitResult, tagResult];
}
