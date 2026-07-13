import type { ReleaseContext, StepResult } from "./types.js";
/** Pure scan of "- [x] ..." lines in BACKLOG.md, returned verbatim. */
export declare function collectDoneItems(cwd: string): readonly string[];
/**
 * Prune "- [x] ..." lines from BACKLOG.md. Read-only checks the given (already-
 * consolidated) CHANGELOG for each pruned item's id and reports any that were never
 * narrated. Never writes to changelogPath. Idempotent: no [x] items -> skipped.
 */
export declare function pruneBacklog(ctx: ReleaseContext, changelogPath: string): StepResult;
