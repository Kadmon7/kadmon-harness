import type { ReleaseContext, StepResult } from "./types.js";
/** True when `tagName` already exists in the repo at `cwd` (`git tag -l`). */
export declare function tagExists(cwd: string, tagName: string): boolean;
/**
 * Creates an annotated release tag. Idempotent: if `tagName` already exists,
 * returns `skipped` (the no-double-tag guarantee, ADR-037 D4 gate 5) — never
 * re-tags or errors on an existing tag. Never throws — git failures surface
 * as a `failed` StepResult carrying a `ReleaseError{code:"GIT"}` in `details`.
 */
export declare function createReleaseTag(ctx: ReleaseContext, tagName: string, message: string): StepResult;
