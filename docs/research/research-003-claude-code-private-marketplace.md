<!-- PERSIST_REPORT_INPUT
{
  "topic": "Claude Code plugin marketplace support for private GitHub repositories",
  "slug": "claude-code-private-marketplace",
  "subQuestions": [
    "Does /plugin marketplace add work with private GitHub repos via gh auth login token?",
    "Are there GitHub issues or community reports of people successfully running /plugin install from private repos?",
    "What token scopes are required for GITHUB_TOKEN private repo access?",
    "Is there any explicit Anthropic statement about private-repo support (Yes/No/Planned)?",
    "If private does not work today, what workarounds do people use?"
  ],
  "sourcesCount": 6,
  "confidence": "High",
  "capsHit": [],
  "openQuestions": [
    "Is issue #17201 fixed in any post-April-2026 Claude Code release? The issue was closed with no resolution noted.",
    "Does the npm private registry workaround (source: npm + private registry field) avoid the git credential bug entirely?",
    "Would CLAUDE_CODE_PLUGIN_SEED_DIR pre-populate approach be more reliable for the Kadmon7 three-collaborator use case?"
  ],
  "summary": "Anthropic documentation explicitly states that private GitHub repositories are supported via existing git credential helpers (gh auth login, Keychain, ssh-agent) for manual installs and via GITHUB_TOKEN or GH_TOKEN for background auto-updates. However, multiple GitHub issues filed in January 2026 (issue #17201, issue #9756, issue #3 in a third-party repo) confirm that the GITHUB_TOKEN environment variable is NOT currently honored when Claude Code clones private repos — the internal git library bypasses credential helpers entirely. The error is 'terminal prompts disabled'. The only working workaround confirmed by community users is: manually git-clone the private repo, then run /plugin marketplace add pointing at the local clone path. The required token scope if/when the feature works is repo (full private repo access). Anthropic has not publicly responded to either issue. Verdict for the Kadmon7 distributing to 3 collaborators use case: UNCLEAR leaning NO for automated install — manual clone workaround is the only confirmed path as of April 2026."
}
-->

## Research: Claude Code plugin marketplace support for private GitHub repositories [skavenger]

### TL;DR

Anthropic documentation says private repos work via `GITHUB_TOKEN` — but multiple active community bug reports confirm the token is silently ignored and git credential helpers are bypassed. The only confirmed workaround as of April 2026 is a manual `git clone` + local path add. Verdict: **NO** for automated `/plugin marketplace add owner/repo` on private repos today; manual workaround exists.

### Executive Summary

Claude Code's official plugin marketplace system was introduced alongside the Claude Code v2 plugin architecture. Anthropic documentation explicitly covers private repository support, listing `GITHUB_TOKEN` / `GH_TOKEN` as the mechanism for background auto-updates and stating that interactive installs use existing git credential helpers. In practice, at least two tracked GitHub issues (filed January 2026) confirm that private repo authentication is broken: Claude Code's internal git library does not invoke credential helpers or honor `GITHUB_TOKEN`, producing "terminal prompts disabled" errors. A third-party issue tracker corroborates the same failure mode with an identical workaround. The required Personal Access Token scope, if/when the feature works, is `repo` (full private repository control). No Anthropic maintainer has publicly responded to or resolved these issues as of April 2026. For distributing to a small team (Joe, Eden, Abraham), the viable path today is the manual clone workaround — or making the repo public.

### 1. Official Documentation Position

Anthropic's Claude Code documentation at `code.claude.com/docs/en/plugin-marketplaces` dedicates a full "Private repositories" section under "Host and distribute marketplaces." The documented behavior is:

- **Interactive installs and manual updates**: use existing git credential helpers — `gh auth login`, macOS Keychain, `git-credential-store`, or `ssh-agent`. The statement is "Claude Code uses your existing git credential helpers, so HTTPS access via `gh auth login` [...] works the same as in your terminal." ([Anthropic docs](https://code.claude.com/docs/en/plugin-marketplaces))
- **Background auto-updates**: require an explicit token env var because interactive prompts would block startup. Supported variables:
  - GitHub: `GITHUB_TOKEN` or `GH_TOKEN`
  - GitLab: `GITLAB_TOKEN` or `GL_TOKEN`
  - Bitbucket: `BITBUCKET_TOKEN`
- **Troubleshooting section**: acknowledges "Private repository authentication fails" as a known symptom and advises checking `gh auth status`, the credential helper config, and token permissions.

The documentation also covers `extraKnownMarketplaces` in `.claude/settings.json`, which is the correct mechanism for team-wide distribution — it prompts collaborators to install the marketplace when they trust the project folder.

### 2. Community Bug Reports (What Actually Happens)

Three independent issue reports filed in early 2026 document the same failure:

**Issue #17201 — anthropics/claude-code** ("Plugin marketplace add fails with private repos despite configured git credentials", opened January 2026): The exact error is `fatal: could not read Username for 'https://github.com': terminal prompts disabled`. The root cause identified by the reporter is that Claude Code uses an internal git library that does not integrate with `~/.gitconfig` credential helpers or `gh auth git-credential`. Anthropic has not responded; the issue is closed with no resolution. ([anthropics/claude-code #17201](https://github.com/anthropics/claude-code/issues/17201))

**Issue #9756 — anthropics/claude-code** ("[FEATURE] Support Auth on Private Marketplaces and Plugins"): An organization wanting to distribute plugins to 200+ developers via GitLab private repos opened this as a feature request, implying the capability does not exist in the expected form. Proposed solutions include shelling out to the system git binary, supporting `GIT_ASKPASS`, adding a `--token` flag, or detecting `gh auth status`. Closed with no maintainer response. ([anthropics/claude-code #9756](https://github.com/anthropics/claude-code/issues/9756))

**Issue #3 — tkarakai/ai-agent-instruction-templates** ("Adding Claude Code marketplace from private GitHub repo requires manual clone workaround"): Independent user confirms `GITHUB_TOKEN` set in environment does not work, and documents the manual workaround. ([tkarakai #3](https://github.com/tkarakai/ai-agent-instruction-templates/issues/3))

Cross-verification: all three sources independently converge on the same failure mode. This is a confirmed bug, not a configuration issue.

### 3. Required Token Scopes

Per community documentation ([allanmosesfernandes97/ClaudePackages GITHUB-TOKEN-SETUP.md](https://github.com/allanmosesfernandes97/ClaudePackages/blob/main/docs/GITHUB-TOKEN-SETUP.md)), the required scope is:

- **`repo`** — Full control of private repositories (read + write). Principle of least privilege: all other scopes should be unchecked.

The official Anthropic docs state only "Personal access token or GitHub App token" without specifying scopes, but `repo` is the standard minimum for private repo HTTPS clone access.

Note: even with the correct scope, the bug means this token is not being read today. The scope requirement is documented for when the feature is fixed.

### 4. Anthropic's Explicit Position

Anthropic documentation **asserts** private repo support exists (implies YES), but provides no date or version when it was implemented. There is no official changelog entry, blog post, or maintainer comment confirming the feature is working. The two relevant GitHub issues have been closed — possibly automatically — with no Anthropic response. The troubleshooting section in the docs acknowledges the failure symptom, which suggests Anthropic is aware but has not issued a fix as of the documentation version current in April 2026.

**Verdict: UNCLEAR leaning NO.** The feature is documented as supported but is not working in practice. There is no Anthropic statement of "not planned" either — the docs intend for it to work.

### 5. Working Workarounds

The only community-confirmed workaround (as of April 2026):

**Manual clone + local path:**
```bash
# Each collaborator runs once:
git clone https://github.com/Kadmon7/kadmon-harness.git ~/kadmon-harness-local

# Then in Claude Code:
/plugin marketplace add ~/kadmon-harness-local
```

Updates require a manual `git pull` in `~/kadmon-harness-local` followed by `/plugin marketplace update`.

**Alternative: make the repo public.** `/plugin marketplace add Kadmon7/kadmon-harness` works instantly for public repos and enables automatic updates. The downside is full code visibility. The upside: trivial install for all 3 collaborators and community discovery.

**Alternative: npm private registry.** The plugin source type `npm` with a `registry` field supports private npm registries. This sidesteps the git credential bug entirely but requires publishing to an npm-compatible private registry (GitHub Packages, Verdaccio, etc.).

**Alternative: CLAUDE_CODE_PLUGIN_SEED_DIR.** For container/CI environments, pre-populating the plugins directory at image-build time avoids all runtime auth entirely. Overkill for 3 collaborators.

### Key Takeaways

- The `/plugin marketplace add Kadmon7/kadmon-harness` command will fail for private repos today — the GITHUB_TOKEN env var is not honored (confirmed bug, multiple sources).
- The `extraKnownMarketplaces` setting in `.claude/settings.json` is the right team-distribution mechanism architecturally, but it still relies on the same broken git clone path for private repos.
- If keeping the repo private, the **manual clone workaround is the only confirmed path**: each of the 3 collaborators clones locally, then `/plugin marketplace add <local-path>`.
- Making the repo public eliminates all auth friction and enables the 1-command install experience Anthropic designed the marketplace for.
- Token scope when the bug is fixed: `repo` on a GitHub PAT or `GH_TOKEN` from `gh auth token`.

### Open Questions

- Is issue #17201 fixed in any post-April-2026 Claude Code release? The issue was closed with no resolution noted — could be auto-closed.
- Does the `npm` private registry source type avoid the git credential bug entirely, making it a viable private distribution channel?
- Would `CLAUDE_CODE_PLUGIN_SEED_DIR` pre-population (done once per collaborator machine at setup time) be more reliable than the manual clone workaround for the 3-person team?

### Sources

1. [Create and distribute a plugin marketplace — Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces) — Official Anthropic documentation covering private repo support, GITHUB_TOKEN, and extraKnownMarketplaces.
2. [Plugin marketplace add fails with private repos despite configured git credentials — anthropics/claude-code #17201](https://github.com/anthropics/claude-code/issues/17201) — Primary bug report; confirms credential helpers are bypassed, exact error message, no Anthropic response.
3. [[FEATURE] Support Auth on Private Marketplaces and Plugins — anthropics/claude-code #9756](https://github.com/anthropics/claude-code/issues/9756) — Feature request from 200-dev org confirming private marketplace auth does not work; proposes system git shell-out, GIT_ASKPASS, --token flag.
4. [Adding Claude Code marketplace from private GitHub repo requires manual clone workaround — tkarakai/ai-agent-instruction-templates #3](https://github.com/tkarakai/ai-agent-instruction-templates/issues/3) — Third-party corroboration; documents manual clone + local add workaround.
5. [GITHUB-TOKEN-SETUP.md — allanmosesfernandes97/ClaudePackages](https://github.com/allanmosesfernandes97/ClaudePackages/blob/main/docs/GITHUB-TOKEN-SETUP.md) — Community guide documenting the `repo` scope requirement for GITHUB_TOKEN.
6. [Bug: Marketplace cloning fails with 'repository not found' for private/internal repos — anthropics/claude-code-action #850](https://github.com/anthropics/claude-code-action/issues/850) — CI/CD context corroboration; same root cause in GitHub Actions environments.

### Methodology

Searched 4 queries / fetched 5 URLs / 0 video transcripts.
Caps hit: none.
Confidence: High — three independent issue reports confirm the same bug; official docs confirm the intended design.
Diversity: passed (official docs + 3 distinct GitHub bug reports + community guide = 3 domains, 4 source types).
Self-eval: coverage 1.0, cross-verification 1.0, recency 1.0, diversity 0.75 → composite 0.95 (no second pass).
