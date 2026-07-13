// Kadmon Harness — /release: D4 refusal gates (ADR-037, plan-037 Step 2.1)
// Runs the five D4 gates and COLLECTS ALL failures (not abort-on-first) so
// --dry-run can surface every blocker in a single pass. Pure read predicates
// only — no writes, no git mutation. Mirrors tag.ts's execFileSync("git", [...])
// pattern; imports isUnreleasedEmpty (changelog.ts) + tagExists (tag.ts), both
// pure read predicates that never import preflight — no cycle.
import { execFileSync } from "node:child_process";
import { isUnreleasedEmpty } from "./changelog.js";
import { tagExists } from "./tag.js";
const GIT_TIMEOUT_MS = 3000;
function runGit(cwd, args) {
    return execFileSync("git", [...args], {
        cwd,
        timeout: GIT_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
    });
}
function toGitError(command, e) {
    const detail = extractGitStderr(e) ?? (e instanceof Error ? e.message : String(e));
    return { code: "GIT", message: `${command} failed: ${detail.trim()}` };
}
function extractGitStderr(e) {
    if (typeof e !== "object" || e === null || !("stderr" in e))
        return undefined;
    const stderr = e.stderr;
    if (typeof stderr === "string")
        return stderr;
    if (Buffer.isBuffer(stderr))
        return stderr.toString("utf8");
    return undefined;
}
/** Gate 1 — dirty working tree: never fold an unrelated in-flight edit into the release commit. */
function checkDirtyTree(cwd) {
    try {
        const output = runGit(cwd, ["status", "--porcelain"]);
        if (output.trim().length === 0)
            return undefined;
        return {
            code: "DIRTY_TREE",
            message: "Working tree has uncommitted changes — refusing to fold them into the release commit",
        };
    }
    catch (e) {
        return toGitError("git status --porcelain", e);
    }
}
/** Gate 2 — mechanical verify red: never cut a broken release. Uses the injected runner. */
function checkVerifyRed(ctx, deps) {
    const result = deps.runVerify(ctx.cwd);
    if (result.ok)
        return undefined;
    const detail = result.failures.length > 0 ? result.failures.join(", ") : "unknown failure";
    return { code: "VERIFY_RED", message: `Mechanical verify failed: ${detail}` };
}
/** Gate 3 — empty [Unreleased]: nothing to release. */
function checkEmptyUnreleased(ctx) {
    if (!isUnreleasedEmpty(ctx.cwd))
        return undefined;
    return { code: "EMPTY_UNRELEASED", message: "## [Unreleased] has no entries — nothing to release" };
}
/** Gate 4 — not on main: releases are cut from the main branch only. */
function checkNotOnMain(cwd) {
    try {
        const branch = runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
        if (branch === "main")
            return undefined;
        return { code: "NOT_ON_MAIN", message: `Current branch is "${branch}", expected "main"` };
    }
    catch (e) {
        return toGitError("git rev-parse --abbrev-ref HEAD", e);
    }
}
/** Gate 5 — tag already exists: "already released", the run is a no-op. */
function checkTagExists(ctx, targetVersion) {
    const tagName = `v${targetVersion}`;
    if (!tagExists(ctx.cwd, tagName))
        return undefined;
    return { code: "TAG_EXISTS", message: `Tag ${tagName} already exists — already released (no-op run)` };
}
/**
 * Runs the five D4 refusal gates and collects ALL failures (not abort-on-first)
 * so `--dry-run` can show every blocker in one pass. `targetVersion` is computed
 * upstream by version-bump.computeNextVersion — no write happens before preflight
 * (AMBIGUITY-2, plan-037).
 */
export function runPreflight(ctx, targetVersion, deps) {
    const results = [
        checkDirtyTree(ctx.cwd),
        checkVerifyRed(ctx, deps),
        checkEmptyUnreleased(ctx),
        checkNotOnMain(ctx.cwd),
        checkTagExists(ctx, targetVersion),
    ];
    const blockers = results.filter((r) => r !== undefined);
    if (blockers.length > 0) {
        return { ok: false, blockers };
    }
    return { ok: true };
}
