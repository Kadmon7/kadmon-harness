import type { ReleaseContext, ReleaseDeps, PreflightResult } from "./types.js";
/**
 * Runs the five D4 refusal gates and collects ALL failures (not abort-on-first)
 * so `--dry-run` can show every blocker in one pass. `targetVersion` is computed
 * upstream by version-bump.computeNextVersion — no write happens before preflight
 * (AMBIGUITY-2, plan-037).
 */
export declare function runPreflight(ctx: ReleaseContext, targetVersion: string, deps: ReleaseDeps): PreflightResult;
