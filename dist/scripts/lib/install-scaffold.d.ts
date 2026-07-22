export interface ScaffoldResult {
    readonly created: readonly string[];
    readonly skipped: readonly string[];
}
/**
 * Scaffold the decision-record substrate (docs/decisions, docs/plans,
 * docs/research, docs/state) plus a root BACKLOG.md into `targetRoot`.
 * Create-if-missing and non-destructive — safe to call any number of times.
 *
 * @param targetRoot - the consumer project root receiving the scaffold. MUST
 *   be an absolute path (library-boundary guard, H1) — the caller resolves
 *   it, this function never calls path.resolve() on it internally.
 * @param repoRoot - the Kadmon Harness repo root (source of the BACKLOG template)
 */
export declare function scaffoldProject(targetRoot: string, repoRoot: string): ScaffoldResult;
