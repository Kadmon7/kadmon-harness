// scripts/lib/github-research.ts
// Route D (GitHub) research helper for skavenger — wraps `gh api` to fetch
// issues, PRs, README, CHANGELOG, and discussions without shell interpolation.
// Zero-cost: uses the `gh` CLI that is already installed for other harness
// workflows. Authenticated calls get 5000 req/hr, unauthenticated get 60.
//
// Design (plan-015 §5 Commit 5):
// - All execution goes through an injectable `GhRunner` — tests inject a
//   scripted runner; production uses `defaultGhRunner` with `execFileSync`
//   and argv arrays (no `shell: true`, no interpolation).
// - The `gh api rate_limit` endpoint is called FIRST on every fetch to
//   establish rate-limit state and auth status; authenticated-ness is
//   inferred from `core.limit` (>=1000 → authenticated).
// - Repo strings are format-validated before any runner invocation —
//   shell metacharacters are rejected at the API boundary.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// ---- Types ----

export interface GitHubRateLimit {
  remaining: number;
  limit: number;
  reset: string; // ISO8601
  authenticated: boolean;
}

export interface GitHubRepoItem {
  title: string;
  url: string;
  body?: string;
  state?: string;
}

export type GitHubRepoKind =
  | "issues"
  | "prs"
  | "readme"
  | "changelog"
  | "discussions";

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

// ---- Runner (injectable for testing) ----

export interface GhRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface GhRunOpts {
  timeoutMs?: number;
}

export type GhRunner = (args: string[], opts?: GhRunOpts) => GhRunResult;

// Type guard for Node's execFileSync error shape (SpawnSyncReturns-like).
// Replaces a raw `as` cast per project coding-style rules.
interface SpawnSyncErrorLike {
  status?: number;
  stderr?: Buffer | string;
  message?: string;
}

function isSpawnSyncError(err: unknown): err is SpawnSyncErrorLike {
  return typeof err === "object" && err !== null;
}

/**
 * Production runner: spawns `gh` via execFileSync with argv arrays.
 * Never uses `shell: true`; all arguments are passed literally.
 * Captures stdout/stderr/exitCode so callers can branch on failure
 * without try/catch boilerplate.
 */
export function defaultGhRunner(args: string[], opts?: GhRunOpts): GhRunResult {
  try {
    const stdout = execFileSync("gh", args, {
      stdio: "pipe",
      timeout: opts?.timeoutMs ?? 30_000,
    }).toString("utf-8");
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    // execFileSync throws on non-zero exit, timeout, or ENOENT.
    // We normalize all three into a GhRunResult so the caller doesn't
    // have to distinguish them — the stderr/exitCode signal is enough.
    if (!isSpawnSyncError(err)) {
      return { stdout: "", stderr: String(err), exitCode: -1 };
    }
    const stderr = (err.stderr ?? "").toString();
    const exitCode = typeof err.status === "number" ? err.status : -1;
    const message = err.message ?? String(err);
    return { stdout: "", stderr: stderr || message, exitCode };
  }
}

// ---- Validation ----

// Owner/name: alphanumeric, dot, underscore, hyphen (GitHub's real allowlist).
// Must start with alphanumeric to prevent `.` or `-` leading entries that
// would shell-confuse if ever concatenated into a path.
const REPO_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function isValidRepo(repo: string): boolean {
  return REPO_RE.test(repo);
}

// ---- Public probes ----

export function checkGhAvailable(runner: GhRunner = defaultGhRunner): boolean {
  const r = runner(["--version"]);
  return r.exitCode === 0;
}

export function checkGhAuthenticated(
  runner: GhRunner = defaultGhRunner,
): boolean {
  const r = runner(["auth", "status"]);
  return r.exitCode === 0;
}

// ---- Rate-limit parsing ----

function parseRateLimitJson(body: string): GitHubRateLimit {
  const parsed = JSON.parse(body) as {
    resources?: {
      core?: { remaining?: number; limit?: number; reset?: number };
    };
  };
  const core = parsed.resources?.core ?? {};
  const remaining = typeof core.remaining === "number" ? core.remaining : 0;
  const limit = typeof core.limit === "number" ? core.limit : 0;
  const resetEpoch = typeof core.reset === "number" ? core.reset : 0;
  const reset =
    resetEpoch > 0 ? new Date(resetEpoch * 1000).toISOString() : "";
  // Unauthenticated = 60/hr, authenticated = 5000/hr. The 1000 threshold
  // safely separates the two without hardcoding either number.
  const authenticated = limit >= 1000;
  return { remaining, limit, reset, authenticated };
}

function authHint(rateLimit: GitHubRateLimit): string | undefined {
  if (!rateLimit.authenticated) {
    return "Unauthenticated: 60 req/hr. Run `gh auth login` for 5000 req/hr.";
  }
  return undefined;
}

// ---- Per-kind fetchers ----

function fetchIssuesOrPrs(
  runner: GhRunner,
  repo: string,
  kind: "issues" | "prs",
  limit: number,
  timeoutMs: number,
): GitHubRepoItem[] {
  const endpoint = kind === "issues" ? "issues" : "pulls";
  const r = runner(
    [
      "api",
      `repos/${repo}/${endpoint}?per_page=${limit}&state=all`,
      "--jq",
      "[.[] | {title: .title, url: .html_url, body: .body, state: .state}]",
    ],
    { timeoutMs },
  );
  if (r.exitCode !== 0) {
    throw new Error(r.stderr || `gh api ${endpoint} failed`);
  }
  const parsed = JSON.parse(r.stdout) as GitHubRepoItem[];
  return Array.isArray(parsed) ? parsed : [];
}

function decodeBase64Content(contentField: string): string {
  // gh api returns base64-encoded content with embedded newlines.
  return Buffer.from(contentField.replace(/\n/g, ""), "base64").toString(
    "utf-8",
  );
}

function fetchReadme(
  runner: GhRunner,
  repo: string,
  timeoutMs: number,
): GitHubRepoItem[] {
  const r = runner(["api", `repos/${repo}/readme`], { timeoutMs });
  if (r.exitCode !== 0) {
    throw new Error(r.stderr || "gh api readme failed");
  }
  const parsed = JSON.parse(r.stdout) as {
    name?: string;
    html_url?: string;
    content?: string;
  };
  const body = parsed.content ? decodeBase64Content(parsed.content) : "";
  return [
    {
      title: parsed.name ?? "README",
      url:
        parsed.html_url ?? `https://github.com/${repo}/blob/HEAD/README.md`,
      body,
    },
  ];
}

function fetchChangelog(
  runner: GhRunner,
  repo: string,
  timeoutMs: number,
): GitHubRepoItem[] {
  // Probe the common filenames in order; the first 2xx wins.
  // `candidates` is a module-local literal array — never user input —
  // so interpolating `${candidate}` into the URL path below is safe by construction.
  const candidates = ["CHANGELOG.md", "CHANGELOG", "changelog.md"];
  let lastErr = "";
  for (const candidate of candidates) {
    const r = runner(["api", `repos/${repo}/contents/${candidate}`], {
      timeoutMs,
    });
    if (r.exitCode === 0) {
      const parsed = JSON.parse(r.stdout) as {
        name?: string;
        html_url?: string;
        content?: string;
      };
      const body = parsed.content ? decodeBase64Content(parsed.content) : "";
      return [
        {
          title: parsed.name ?? candidate,
          url:
            parsed.html_url ??
            `https://github.com/${repo}/blob/HEAD/${candidate}`,
          body,
        },
      ];
    }
    lastErr = r.stderr;
  }
  throw new Error(lastErr || "changelog not found");
}

function fetchDiscussions(
  runner: GhRunner,
  repo: string,
  limit: number,
  timeoutMs: number,
): GitHubRepoItem[] {
  const [owner, name] = repo.split("/");
  // Use GraphQL variable bindings instead of string interpolation
  // (defense-in-depth per spektr MEDIUM — immune to future REPO_RE relaxation).
  // gh api passes each -f/-F as a separate typed field to the graphql endpoint;
  // $owner / $name / $limit resolve at the server, never inside the query string.
  const query =
    "query($owner: String!, $name: String!, $limit: Int!) { repository(owner: $owner, name: $name) { discussions(first: $limit) { nodes { title url body } } } }";
  const r = runner(
    [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `limit=${limit}`,
    ],
    { timeoutMs },
  );
  if (r.exitCode !== 0) {
    throw new Error(r.stderr || "gh api graphql discussions failed");
  }
  const parsed = JSON.parse(r.stdout) as {
    data?: {
      repository?: {
        discussions?: {
          nodes?: Array<{ title?: string; url?: string; body?: string }>;
        };
      };
    };
  };
  const nodes = parsed.data?.repository?.discussions?.nodes ?? [];
  return nodes.map((n) => ({
    title: n.title ?? "(untitled)",
    url: n.url ?? "",
    body: n.body,
  }));
}

// ---- Public API ----

export interface FetchGitHubRepoContentOpts {
  repo: string; // "owner/name"
  kinds: GitHubRepoKind[];
  limit?: number; // per_page / discussions first — default 20
  timeoutMs?: number; // per gh call — default 30000
  runner?: GhRunner; // injection point for tests
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
export async function fetchGitHubRepoContent(
  opts: FetchGitHubRepoContentOpts,
): Promise<GitHubResearchResult[]> {
  if (!isValidRepo(opts.repo)) {
    return [
      {
        ok: false,
        kind: "error",
        error: `invalid repo format: "${opts.repo}" (expected "owner/name" with alphanumeric + . _ -)`,
      },
    ];
  }
  const runner = opts.runner ?? defaultGhRunner;
  const limit = opts.limit ?? 20;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  // Probe rate limit once — also validates gh is on PATH and gives us
  // authentication status.
  const rlRes = runner(["api", "rate_limit"], { timeoutMs });
  if (rlRes.exitCode !== 0) {
    const msg = rlRes.stderr || "gh api rate_limit failed";
    const hint =
      /ENOENT|not found|not installed/i.test(msg)
        ? "gh CLI not found or not in PATH. Install from https://cli.github.com/"
        : undefined;
    return [{ ok: false, kind: "error", error: msg, hint }];
  }
  let rateLimit: GitHubRateLimit;
  try {
    rateLimit = parseRateLimitJson(rlRes.stdout);
  } catch (err) {
    return [
      {
        ok: false,
        kind: "error",
        error: `unparsable rate_limit response: ${err instanceof Error ? err.message : String(err)}`,
      },
    ];
  }
  const hint = authHint(rateLimit);

  const results: GitHubResearchResult[] = [];
  for (const kind of opts.kinds) {
    try {
      let items: GitHubRepoItem[];
      if (kind === "issues" || kind === "prs") {
        items = fetchIssuesOrPrs(runner, opts.repo, kind, limit, timeoutMs);
      } else if (kind === "readme") {
        items = fetchReadme(runner, opts.repo, timeoutMs);
      } else if (kind === "changelog") {
        items = fetchChangelog(runner, opts.repo, timeoutMs);
      } else {
        items = fetchDiscussions(runner, opts.repo, limit, timeoutMs);
      }
      results.push({ ok: true, kind, repo: opts.repo, items, rateLimit });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ok: false, kind: "error", error: message, hint });
    }
  }
  return results;
}

// ---- CLI entry point (ESM guard) ----
// Enables: npx tsx scripts/lib/github-research.ts <owner/name> [kinds]
// Outputs JSON to stdout; exits 0 if all results ok, 1 otherwise.

const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] != null &&
  (() => {
    try {
      return import.meta.url === pathToFileURL(process.argv[1]).href;
    } catch {
      return false;
    }
  })();

if (invokedDirectly) {
  const repo = process.argv[2];
  const kindsArg = process.argv[3] ?? "issues,prs,readme";
  if (!repo) {
    process.stderr.write(
      "usage: github-research <owner/name> [kinds-comma-separated]\n",
    );
    process.exit(1);
  }
  const ALL_KINDS: readonly GitHubRepoKind[] = [
    "issues",
    "prs",
    "readme",
    "changelog",
    "discussions",
  ] as const;
  const isKnownKind = (k: string): k is GitHubRepoKind =>
    (ALL_KINDS as readonly string[]).includes(k);
  const kindsRaw = kindsArg
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const unknown = kindsRaw.filter((k) => !isKnownKind(k));
  if (unknown.length > 0) {
    process.stderr.write(
      `unknown kinds: ${unknown.join(", ")} (valid: ${ALL_KINDS.join(", ")})\n`,
    );
    process.exit(1);
  }
  const kinds = kindsRaw.filter(isKnownKind);
  fetchGitHubRepoContent({ repo, kinds }).then((results) => {
    process.stdout.write(JSON.stringify(results, null, 2) + "\n");
    const allOk = results.every((r) => r.ok);
    process.exit(allOk ? 0 : 1);
  });
}
