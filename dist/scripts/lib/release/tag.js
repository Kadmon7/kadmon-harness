// Kadmon Harness — /release: idempotent annotated git tag (ADR-037, plan-037 Step 1.6)
// Mirrors the execFileSync("git", [...], { cwd, timeout, stdio }) precedent in
// scripts/lib/medik-checks/stale-plans.ts — arg-array only, no shell interpolation
// (security rule), 3s timeout + stdin ignore.
import { execFileSync } from "node:child_process";
const GIT_TIMEOUT_MS = 3000;
function runGit(cwd, args) {
    return execFileSync("git", [...args], {
        cwd,
        timeout: GIT_TIMEOUT_MS,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
    });
}
/** True when `tagName` already exists in the repo at `cwd` (`git tag -l`). */
export function tagExists(cwd, tagName) {
    try {
        const output = runGit(cwd, ["tag", "-l", tagName]);
        return output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .includes(tagName);
    }
    catch {
        // git unavailable or cwd is not a repo — treat as "no tag" so a subsequent
        // create attempt surfaces the real error instead of a silent false skip.
        return false;
    }
}
/**
 * Creates an annotated release tag. Idempotent: if `tagName` already exists,
 * returns `skipped` (the no-double-tag guarantee, ADR-037 D4 gate 5) — never
 * re-tags or errors on an existing tag. Never throws — git failures surface
 * as a `failed` StepResult carrying a `ReleaseError{code:"GIT"}` in `details`.
 */
export function createReleaseTag(ctx, tagName, message) {
    if (tagExists(ctx.cwd, tagName)) {
        return {
            step: "tag",
            status: "skipped",
            message: `Tag ${tagName} already exists — no-double-tag guarantee (D4 gate 5)`,
            filesTouched: [],
        };
    }
    try {
        runGit(ctx.cwd, ["tag", "-a", tagName, "-m", message]);
        return {
            step: "tag",
            status: "applied",
            message: `Created annotated tag ${tagName}`,
            filesTouched: [],
        };
    }
    catch (e) {
        const error = toReleaseError(tagName, e);
        return {
            step: "tag",
            status: "failed",
            message: error.message,
            filesTouched: [],
            details: error,
        };
    }
}
function toReleaseError(tagName, e) {
    const detail = extractGitStderr(e) ?? (e instanceof Error ? e.message : String(e));
    return {
        code: "GIT",
        message: `git tag -a ${tagName} failed: ${detail.trim()}`,
    };
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
