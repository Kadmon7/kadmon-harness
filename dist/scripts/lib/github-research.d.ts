export interface GitHubRateLimit {
    remaining: number;
    limit: number;
    reset: string;
    authenticated: boolean;
}
export interface GitHubRepoItem {
    title: string;
    url: string;
    body?: string;
    state?: string;
}
export type GitHubRepoKind = "issues" | "prs" | "readme" | "changelog" | "discussions";
export interface GitHubRepoContentOk {
    ok: true;
    kind: GitHubRepoKind;
    repo: string;
    items: GitHubRepoItem[];
    rateLimit: GitHubRateLimit;
}
export interface GitHubRepoContentErr {
    ok: false;
    kind: "error";
    error: string;
    hint?: string;
}
export type GitHubResearchResult = GitHubRepoContentOk | GitHubRepoContentErr;
export interface GhRunResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
export interface GhRunOpts {
    timeoutMs?: number;
}
export type GhRunner = (args: string[], opts?: GhRunOpts) => GhRunResult;
/**
 * Production runner: spawns `gh` via execFileSync with argv arrays.
 * Never uses `shell: true`; all arguments are passed literally.
 * Captures stdout/stderr/exitCode so callers can branch on failure
 * without try/catch boilerplate.
 */
export declare function defaultGhRunner(args: string[], opts?: GhRunOpts): GhRunResult;
export declare function checkGhAvailable(runner?: GhRunner): boolean;
export declare function checkGhAuthenticated(runner?: GhRunner): boolean;
export interface FetchGitHubRepoContentOpts {
    repo: string;
    kinds: GitHubRepoKind[];
    limit?: number;
    timeoutMs?: number;
    runner?: GhRunner;
}
/**
 * Fetch the requested content kinds for a GitHub repository via `gh api`.
 *
 * Runs `gh api rate_limit` once up front (gets auth status for free), then
 * dispatches one call per kind. Each kind produces its own result entry —
 * a partial failure does not abort the remaining kinds.
 *
 * Returns an array parallel to `opts.kinds`, preserving order. If the
 * rate-limit probe itself fails (e.g. gh CLI missing), a single error
 * result is returned instead of N per-kind results.
 */
/**
 * NOTE: the public signature is `async` / `Promise`-returning, but the default
 * runner (`defaultGhRunner`) is synchronous via `execFileSync`. The Promise
 * wrapping is purely for future runners that might be async (HTTP-based,
 * retry-queued). Callers relying on `Promise.all` for parallelism across
 * independent calls will get sequential execution today — swap the runner
 * for a true async one if concurrency is needed.
 */
export declare function fetchGitHubRepoContent(opts: FetchGitHubRepoContentOpts): Promise<GitHubResearchResult[]>;
