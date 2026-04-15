---
name: github-ops
description: GitHub repository operations via `gh` CLI — issue triage, PR management, CI failure debugging, release preparation, and security monitoring. Use this skill whenever the user says "check GitHub", "triage issues", "review PRs", "merge", "release", "CI is broken", "which PRs are stale", "deal with Dependabot", or when any repo-operational task needs the `gh` CLI rather than raw git. Also use when debugging failed GitHub Actions runs or preparing a release changelog. Do NOT trigger for local git operations (branching, merging, committing) — use `git-workflow` for those.
---

# GitHub Operations

Operational GitHub work via the `gh` CLI — issue and PR hygiene, CI triage, releases, security alerts. This is the companion to `git-workflow` (local git) for everything that happens *on the remote*.

## When to Activate

- Triaging issues (classifying, labeling, responding, deduplicating)
- Managing PRs (review status, CI checks, stale PRs, merge readiness)
- Debugging failing CI runs on GitHub Actions
- Preparing releases and changelogs
- Monitoring Dependabot and secret-scanning alerts
- User says "check GitHub", "triage issues", "review PRs", "ci is red", "create release", "dependabot"

## Tool Requirements

- `gh` CLI authenticated via `gh auth login` (Kadmon is authenticated as `Kadmon7`)
- Repo must be a GitHub remote — the skill is no-op on GitLab/Bitbucket

## Issue Triage

Classify each issue by **type** and **priority**:

- **Types**: `bug`, `feature-request`, `question`, `documentation`, `enhancement`, `duplicate`, `invalid`, `good-first-issue`
- **Priority**: `critical` (breaking / security), `high` (significant impact), `medium` (nice to have), `low` (cosmetic)

### Workflow

1. Read the issue title, body, and all comments
2. Search for duplicates by keyword
3. Apply labels via `gh issue edit`
4. For questions: post a helpful response
5. For bugs with missing info: ask for reproduction steps
6. For likely good-first-issues: add the `good-first-issue` label
7. For duplicates: comment with a link to the original, add `duplicate`, close

```bash
# Find duplicates
gh issue list --search "keyword" --state all --limit 20

# Label
gh issue edit <number> --add-label "bug,high-priority"

# Comment
gh issue comment <number> --body "Thanks for reporting. Could you share reproduction steps?"

# Close as duplicate
gh issue close <number> --reason "not planned" --comment "Duplicate of #123"
```

## PR Management

### Review checklist per PR

1. CI status: `gh pr checks <number>`
2. Mergeability: `gh pr view <number> --json mergeable`
3. Age and last activity
4. Flag PRs >5 days with no review
5. For community PRs: verify tests and conventions compliance

### Stale policy

| Target | Threshold | Action |
|---|---|---|
| Issue with no activity | 14 days | Add `stale` label, comment asking for update |
| PR with no activity | 7 days | Comment asking if still active |
| Stale issue, no response | 30 days | Close with `closed-stale` label |

```bash
# Stale issues
gh issue list --label "stale" --state open

# Quiet PRs
gh pr list --json number,title,updatedAt \
  --jq '.[] | select(.updatedAt < "2026-03-01")'
```

## CI/CD Triage

When CI fails:

1. `gh run view <run-id> --log-failed` — see the failing step
2. Classify: real failure vs flaky test
3. Real failure → identify root cause, suggest fix
4. Flaky → note the pattern for later (don't just rerun blindly)

```bash
# List recent failed runs
gh run list --status failure --limit 10

# Failed step logs
gh run view <run-id> --log-failed

# Rerun failed jobs only
gh run rerun <run-id> --failed
```

**Anti-pattern**: rerunning a failed CI without diagnosing the cause. A flaky test that never gets investigated becomes a blocker later.

## Release Management

### Preparation

1. Verify `main` is green
2. Review merged PRs since the last release
3. Generate a changelog from PR titles
4. Create the release

```bash
# List merged PRs since a date
gh pr list --state merged --base main --search "merged:>2026-03-01"

# Create a release with auto-generated notes from merged PRs
gh release create v1.2.0 --title "v1.2.0" --generate-notes

# Pre-release
gh release create v1.3.0-rc1 --prerelease --title "v1.3.0 RC1"
```

### Changelog quality

- Group by type (Features, Fixes, Chore)
- Omit trivial commits (typos, formatting-only)
- Call out breaking changes at the top

## Security Monitoring

```bash
# Dependabot alerts
gh api repos/{owner}/{repo}/dependabot/alerts \
  --jq '.[].security_advisory.summary'

# Secret-scanning alerts
gh api repos/{owner}/{repo}/secret-scanning/alerts \
  --jq '.[].state'

# List open dependency bumps
gh pr list --label "dependencies" --json number,title
```

Rules of thumb:

- Review and auto-merge safe minor/patch bumps weekly
- Flag any CRITICAL/HIGH alert immediately
- Never ignore a secret-scanning alert — rotate the credential, don't just close the alert

## Quality Gate

Before declaring a GitHub-ops task complete:

- [ ] All triaged issues carry appropriate labels
- [ ] No PRs older than 7 days without a review or comment
- [ ] CI failures investigated (not just rerun)
- [ ] Releases include accurate changelogs
- [ ] Security alerts acknowledged and tracked

## Integration

- **kody agent** (sonnet) — primary owner. kody handles git and review workflows; this skill extends that to the remote GitHub surface. When a user says "is this ready to merge", kody reads PR status via `gh` and applies the review checklist.
- **git-workflow skill** — sibling. `git-workflow` covers local git (branches, commits, rebase, conflicts); `github-ops` covers everything that happens on the remote (issues, PRs, CI, releases).
- **`rules/common/git-workflow.md`** — authoritative rules for commit format and review tier; gate-keeps any PR this skill opens or merges.
- **/chekpoint command** — entry point. kody can load this skill during Phase 2 when the user is preparing a PR or release.

## no_context Application

Every GitHub-ops claim must come from a real `gh` call. "The PR looks merge-ready" is not enough — cite `gh pr checks 42` showing green, `gh pr view 42 --json mergeable` showing `MERGEABLE`, and the approving review count. "CI is flaky" needs an actual pattern across multiple runs, not a single failed execution. The `no_context` principle here means: every state claim about the remote is backed by a `gh` command output, not a memory of what was true yesterday.
