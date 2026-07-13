import type { ReleaseContext, ReleaseDeps, ReleasePlan, StepResult } from "./types.js";
/**
 * Computes the release plan: next version, tag name, changelog preview, backlog prune
 * candidates, and status-flip proposals (output only, D5). No writes, no git mutation.
 */
export declare function planRelease(ctx: ReleaseContext, deps: ReleaseDeps): ReleasePlan;
/**
 * Writes plugin.json + package.json (version-bump) -> CHANGELOG.md (consolidate) ->
 * BACKLOG.md (prune), in order. Does NOT commit or tag. Status-flip proposals are
 * output only — never written anywhere (no WORK.md, no auto-flip, D5).
 */
export declare function applyReleaseWrites(ctx: ReleaseContext, plan: ReleasePlan, _deps: ReleaseDeps): readonly StepResult[];
export declare function commitAndTag(ctx: ReleaseContext, plan: ReleasePlan, _deps: ReleaseDeps): readonly StepResult[];
