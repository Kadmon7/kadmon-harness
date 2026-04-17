// TDD [feniks] — Commit 5 of plan-015
// Tests for scripts/lib/github-research.ts — the `gh api` wrapper that
// powers Route D (GitHub) research in skavenger.
//
// Covers plan-015 §5 Commit 5 test cases 1-9. All calls go through an
// injectable runner (GhRunner), so no real `gh` CLI is needed in tests —
// and no PATH manipulation is required for Windows compatibility.

import { describe, it, expect } from "vitest";
import {
  checkGhAvailable,
  checkGhAuthenticated,
  fetchGitHubRepoContent,
  type GhRunner,
  type GhRunResult,
} from "../../scripts/lib/github-research.js";

// ---- Helpers ----

/**
 * Build a scripted runner that returns queued responses in order
 * and captures received argv for verification.
 */
function scriptedRunner(script: Array<(args: string[]) => GhRunResult>): {
  runner: GhRunner;
  calls: Array<{ args: string[] }>;
} {
  const calls: Array<{ args: string[] }> = [];
  let idx = 0;
  const runner: GhRunner = (args) => {
    calls.push({ args: [...args] });
    const handler = script[idx];
    idx++;
    if (!handler) {
      return { stdout: "", stderr: `no scripted response for call #${idx}`, exitCode: -1 };
    }
    return handler(args);
  };
  return { runner, calls };
}

const rateLimitAuthed = JSON.stringify({
  resources: { core: { remaining: 4997, limit: 5000, reset: 1700000000 } },
});
const rateLimitUnauthed = JSON.stringify({
  resources: { core: { remaining: 42, limit: 60, reset: 1700000000 } },
});

// ---- Case 1: checkGhAvailable ----

describe("checkGhAvailable", () => {
  it("returns true when gh --version succeeds (exit 0)", () => {
    const runner: GhRunner = () => ({ stdout: "gh version 2.40.0", stderr: "", exitCode: 0 });
    expect(checkGhAvailable(runner)).toBe(true);
  });

  it("returns false when gh is not on PATH (exit -1)", () => {
    const runner: GhRunner = () => ({ stdout: "", stderr: "spawn gh ENOENT", exitCode: -1 });
    expect(checkGhAvailable(runner)).toBe(false);
  });
});

// ---- Case 2: checkGhAuthenticated ----

describe("checkGhAuthenticated", () => {
  it("returns true when gh auth status exits 0", () => {
    const runner: GhRunner = () => ({
      stdout: "",
      stderr: "Logged in to github.com as user",
      exitCode: 0,
    });
    expect(checkGhAuthenticated(runner)).toBe(true);
  });

  it("returns false when gh auth status exits non-zero", () => {
    const runner: GhRunner = () => ({
      stdout: "",
      stderr: "You are not logged into any GitHub hosts",
      exitCode: 1,
    });
    expect(checkGhAuthenticated(runner)).toBe(false);
  });
});

// ---- Case 3: issues parsing ----

describe("fetchGitHubRepoContent — issues", () => {
  it("parses issue items with shape {title, url, body, state}", async () => {
    const issuesBody = JSON.stringify([
      {
        title: "Slow queries",
        url: "https://github.com/pgvector/pgvector/issues/1",
        body: "x",
        state: "open",
      },
      {
        title: "Docs typo",
        url: "https://github.com/pgvector/pgvector/issues/2",
        body: "y",
        state: "closed",
      },
    ]);
    const { runner } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: issuesBody, stderr: "", exitCode: 0 }),
    ]);
    const result = await fetchGitHubRepoContent({
      repo: "pgvector/pgvector",
      kinds: ["issues"],
      runner,
    });
    expect(result).toHaveLength(1);
    const first = result[0];
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.kind).toBe("issues");
      expect(first.repo).toBe("pgvector/pgvector");
      expect(first.items).toHaveLength(2);
      expect(first.items[0].title).toBe("Slow queries");
      expect(first.items[0].state).toBe("open");
    }
  });
});

// ---- Case 4: rate-limit parsing ----

describe("fetchGitHubRepoContent — rate limit parsing", () => {
  it("propagates remaining/limit/reset/authenticated to result", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: "[]", stderr: "", exitCode: 0 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rateLimit.remaining).toBe(4997);
      expect(r.rateLimit.limit).toBe(5000);
      expect(r.rateLimit.authenticated).toBe(true);
      expect(r.rateLimit.reset).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
});

// ---- Case 5: auth branches ----

describe("fetchGitHubRepoContent — auth branches", () => {
  it("surfaces authenticated=true when limit >= 1000 and no hint", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: "[]", stderr: "", exitCode: 0 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.rateLimit.authenticated).toBe(true);
    }
  });

  it("surfaces unauthenticated hint when error occurs under limit=60", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: rateLimitUnauthed, stderr: "", exitCode: 0 }),
      () => ({
        stdout: "",
        stderr: "403 API rate limit exceeded for anonymous",
        exitCode: 1,
      }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.hint).toMatch(/gh auth login/i);
    }
  });
});

// ---- Case 6: readme branch ----

describe("fetchGitHubRepoContent — readme", () => {
  it("decodes base64 content and returns a single item", async () => {
    const readmeRaw = "# hello world\n";
    const content = Buffer.from(readmeRaw, "utf-8").toString("base64");
    const readmeBody = JSON.stringify({
      name: "README.md",
      html_url: "https://github.com/owner/name/blob/HEAD/README.md",
      content,
    });
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: readmeBody, stderr: "", exitCode: 0 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["readme"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.items[0].body).toContain("hello world");
    }
    // The second call must hit the readme endpoint (case 6 acceptance criterion).
    const readmeArg = calls[1].args.find((a) => a === "repos/owner/name/readme");
    expect(readmeArg).toBeDefined();
  });
});

// ---- Case 7: error passthrough ----

describe("fetchGitHubRepoContent — error passthrough", () => {
  it("returns ok:false with stderr content when gh api exits non-zero", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({
        stdout: "",
        stderr: "404 Not Found: repos/ghost/nope/issues",
        exitCode: 1,
      }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "ghost/nope",
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/404 Not Found/);
    }
  });

  it("returns ok:false with install hint when rate_limit call hits ENOENT", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: "", stderr: "spawn gh ENOENT", exitCode: -1 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.hint).toMatch(/gh CLI/i);
    }
  });
});

// ---- Case 8: no shell injection ----

describe("fetchGitHubRepoContent — no shell injection", () => {
  it("rejects malicious repo before calling runner", async () => {
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
    ]);
    const maliciousRepo = "owner/$(echo pwned)";
    const [r] = await fetchGitHubRepoContent({
      repo: maliciousRepo,
      kinds: ["issues"],
      runner,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/invalid repo format/i);
    }
    // Runner never invoked — format validation rejected the input.
    expect(calls).toHaveLength(0);
  });

  it("forwards the literal repo string into argv when valid", async () => {
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: "[]", stderr: "", exitCode: 0 }),
    ]);
    await fetchGitHubRepoContent({
      repo: "valid-owner/valid_name.test",
      kinds: ["issues"],
      runner,
    });
    // The endpoint argv entry contains the literal repo path — no shell
    // interpolation happened (we're using execFile-style argv arrays, not
    // a shell command string).
    const issuesCall = calls[1];
    const endpointArg = issuesCall.args.find((a) =>
      a.includes("repos/valid-owner/valid_name.test"),
    );
    expect(endpointArg).toBeDefined();
  });
});

// ---- Case 9: timeout ----

describe("fetchGitHubRepoContent — timeout", () => {
  it("surfaces the timeout error and does not hang", async () => {
    const { runner } = scriptedRunner([
      () => ({ stdout: "", stderr: "ETIMEDOUT", exitCode: -1 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues"],
      timeoutMs: 10,
      runner,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/ETIMEDOUT/i);
    }
  });
});

// ---- Multi-kind dispatch (integration-ish) ----

describe("fetchGitHubRepoContent — multi-kind", () => {
  it("runs rate-limit once (not per kind) and returns one result per kind", async () => {
    const issuesBody = JSON.stringify([
      { title: "X", url: "https://g/i/1", body: "b", state: "open" },
    ]);
    const prsBody = JSON.stringify([
      { title: "Y", url: "https://g/p/1", body: "b", state: "open" },
    ]);
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: issuesBody, stderr: "", exitCode: 0 }),
      () => ({ stdout: prsBody, stderr: "", exitCode: 0 }),
    ]);
    const results = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["issues", "prs"],
      runner,
    });
    // Externally-observable behavior: results parallel kinds[] in length
    // and order; every requested kind produces a result row.
    expect(results).toHaveLength(2);
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(true);
    if (results[0].ok) expect(results[0].kind).toBe("issues");
    if (results[1].ok) expect(results[1].kind).toBe("prs");
    // Contract: rate_limit is invoked EXACTLY ONCE regardless of N kinds —
    // callers can rely on stable cost independent of fan-out.
    const rateLimitCalls = calls.filter((c) => c.args.includes("rate_limit"));
    expect(rateLimitCalls).toHaveLength(1);
  });
});

// ---- Case extras: changelog + discussions happy paths (feniks audit gap) ----

describe("fetchGitHubRepoContent — changelog", () => {
  it("returns the first CHANGELOG filename that exists", async () => {
    const changelogRaw = "# Changelog\n## 1.0.0\n- initial\n";
    const content = Buffer.from(changelogRaw, "utf-8").toString("base64");
    const body = JSON.stringify({
      name: "CHANGELOG.md",
      html_url: "https://github.com/owner/name/blob/HEAD/CHANGELOG.md",
      content,
    });
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: body, stderr: "", exitCode: 0 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["changelog"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.items[0].title).toBe("CHANGELOG.md");
      expect(r.items[0].body).toContain("Changelog");
    }
    // The first candidate (CHANGELOG.md) resolved, so no retry happened.
    const candidateCalls = calls.filter((c) =>
      c.args.some((a) => /\/contents\/CHANGELOG/.test(a)),
    );
    expect(candidateCalls).toHaveLength(1);
  });

  it("falls back to the next candidate when the first 404s", async () => {
    const changelogRaw = "v1.0\n- initial\n";
    const content = Buffer.from(changelogRaw, "utf-8").toString("base64");
    const body = JSON.stringify({
      name: "CHANGELOG",
      html_url: "https://github.com/owner/name/blob/HEAD/CHANGELOG",
      content,
    });
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: "", stderr: "404 Not Found", exitCode: 1 }), // CHANGELOG.md
      () => ({ stdout: body, stderr: "", exitCode: 0 }), // CHANGELOG
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["changelog"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.items[0].title).toBe("CHANGELOG");
    // Exactly two content lookups fired (CHANGELOG.md 404'd, CHANGELOG succeeded).
    const candidateCalls = calls.filter((c) =>
      c.args.some((a) => /\/contents\/CHANGELOG/.test(a)),
    );
    expect(candidateCalls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("fetchGitHubRepoContent — discussions", () => {
  it("parses GraphQL discussion nodes with {title, url, body}", async () => {
    const body = JSON.stringify({
      data: {
        repository: {
          discussions: {
            nodes: [
              {
                title: "How do I shard?",
                url: "https://github.com/owner/name/discussions/1",
                body: "asking for a friend",
              },
              {
                title: "roadmap?",
                url: "https://github.com/owner/name/discussions/2",
                body: "q4 plan",
              },
            ],
          },
        },
      },
    });
    const { runner, calls } = scriptedRunner([
      () => ({ stdout: rateLimitAuthed, stderr: "", exitCode: 0 }),
      () => ({ stdout: body, stderr: "", exitCode: 0 }),
    ]);
    const [r] = await fetchGitHubRepoContent({
      repo: "owner/name",
      kinds: ["discussions"],
      runner,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(2);
      expect(r.items[0].title).toBe("How do I shard?");
      expect(r.items[1].url).toContain("/discussions/2");
    }
    // Contract check: the GraphQL endpoint was targeted, not REST.
    expect(calls[1].args).toContain("graphql");
  });
});
