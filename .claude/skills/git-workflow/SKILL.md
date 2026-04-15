---
name: git-workflow
description: Long-form practical reference for Git branching strategies, commit conventions, merge vs rebase, PR workflow, conflict resolution, release tagging, and undoing mistakes. Use this skill whenever setting up Git practices for a new project, writing commit messages or PR descriptions, resolving merge conflicts, deciding between merge and rebase, creating releases or version tags, recovering from a git mistake, or when the user says "git workflow", "branching strategy", "how do I git", "fix my commit", "resolve conflict", "create a release", "undo this commit", or "what's the right way to do X in git". This is the workflow-level companion to `rules/common/git-workflow.md` — the rules file states the mandatory behaviors; this skill shows how to apply them.
---

# Git Workflow Patterns

Practical Git workflow reference. Covers the decisions you actually face in day-to-day work: which branching strategy, how to write the commit message, whether to merge or rebase, how to recover from a mistake.

For the mandatory Kadmon rules (Reviewed footer, no --no-verify, block-no-verify hook, etc.) see `rules/common/git-workflow.md`. This skill is the longer-form companion that explains **how** to apply those rules in context.

## Branching Strategies

### GitHub Flow — default for most projects

`main` is always deployable. Feature branches branch from `main`, get reviewed in a PR, and merge back.

```
main (protected, always deployable)
  ├── feature/user-auth      → PR → merge to main
  ├── feature/payment-flow   → PR → merge to main
  └── fix/login-bug          → PR → merge to main
```

Use for: SaaS, web apps, startups, anything with continuous deployment. This is the Kadmon default.

### Trunk-Based — high-velocity teams

Everyone commits to `main` or very short-lived (1-2 day) branches. Feature flags hide incomplete work. Requires strong CI and discipline.

Use for: experienced teams with feature flags, multiple deploys per day.

### GitFlow — scheduled releases

`main` + `develop` + `release/*` + `hotfix/*`. Heavy ceremony, long-lived branches.

Use for: enterprise, regulated industries, scheduled quarterly releases. Rarely the right choice for a small team.

| Strategy | Team size | Cadence | Fits |
|---|---|---|---|
| GitHub Flow | Any | Continuous | SaaS, web apps, Kadmon |
| Trunk-Based | 5+ | Multiple/day | Feature-flag-heavy |
| GitFlow | 10+ | Scheduled | Enterprise, regulated |

## Commit Messages — Conventional Commits

```
<type>(<scope>): <subject>

[optional body — explain *why*, not *what*]

[optional footer — breaking changes, issue refs]
```

### Types

| Type | Use for | Example |
|---|---|---|
| `feat` | New feature | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(api): handle null response` |
| `docs` | Docs only | `docs(readme): update install` |
| `refactor` | No behavior change | `refactor(db): extract pool` |
| `test` | Tests only | `test(auth): token validation` |
| `chore` | Maintenance | `chore(deps): bump vitest` |
| `perf` | Perf improvement | `perf(query): add users index` |
| `ci` | CI/CD changes | `ci: add node 20 matrix` |
| `revert` | Revert prior commit | `revert: "feat(auth): ..."` |

### Bad vs Good

```
# BAD
git commit -m "fixed stuff"
git commit -m "updates"
git commit -m "WIP"

# GOOD
git commit -m "fix(api): retry requests on 503 Service Unavailable

The external API occasionally returns 503 during peak hours.
Added exponential backoff retry with max 3 attempts.

Closes #123"
```

Subject rules: imperative mood ("add", not "added"), no trailing period, ≤50 chars. Body explains **why** the change is needed — the diff already shows **what**.

## Merge vs Rebase

### Merge — preserves history

Creates a merge commit. Use when merging a reviewed branch into `main`, when multiple people worked on the branch, or when the branch has been pushed and others may have based work on it.

```bash
git checkout main
git merge feature/user-auth
```

### Rebase — linear history

Rewrites commits onto the target branch. Use when updating your local branch with latest `main` before opening a PR, or when the branch is local-only.

```bash
git checkout feature/user-auth
git fetch origin
git rebase origin/main
# if local-only:
git push --force-with-lease origin feature/user-auth
```

**Never rebase** branches that have been pushed to a shared branch, branches others have based work on, or protected branches. Rewriting shared history breaks other people's clones.

## Pull Request Workflow

### Title

Use the same conventional format as commits: `<type>(<scope>): <description>`.

### Description template

```markdown
## What
Brief description.

## Why
Motivation and context.

## How
Key implementation details worth highlighting.

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing performed

Closes #123
```

### Review checklist (reviewer)

- [ ] Does the code solve the stated problem?
- [ ] Edge cases handled?
- [ ] Readable and maintainable?
- [ ] Sufficient tests?
- [ ] Security concerns?
- [ ] History clean (squashed if needed)?

### Review checklist (author, before requesting review)

- [ ] Self-review completed
- [ ] CI green (tests, lint, typecheck)
- [ ] PR size reasonable (<500 lines ideal)
- [ ] Single focused change — don't bundle unrelated work
- [ ] Description clearly explains what and why

## Conflict Resolution

```bash
# During merge, Git marks conflicts in files:
# <<<<<<< HEAD
# content from main
# =======
# content from feature
# >>>>>>> feature/user-auth

git status                                 # see conflicted files
# Edit manually OR:
git checkout --ours  src/auth/login.ts     # keep main version
git checkout --theirs src/auth/login.ts    # keep feature version
git add src/auth/login.ts
git commit
```

Prevention beats resolution: keep feature branches short, rebase onto `main` frequently, coordinate on shared files.

## Common Workflows

### Start a feature

```bash
git checkout main && git pull
git checkout -b feature/user-auth
# work, commit, push
git push -u origin feature/user-auth
```

### Update a PR with new changes

```bash
git add .
git commit -m "feat(auth): add error handling"
git push origin feature/user-auth
```

### Sync a fork with upstream

```bash
git remote add upstream https://github.com/original/repo.git
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### Undo mistakes

```bash
# Undo last commit, keep changes staged
git reset --soft HEAD~1

# Undo last commit, discard changes (destructive — confirm first)
git reset --hard HEAD~1

# Undo a commit that was already pushed (safe — creates a new commit)
git revert HEAD && git push

# Fix last commit message (only if not pushed)
git commit --amend -m "New message"

# Add a forgotten file to the last commit
git add forgotten-file
git commit --amend --no-edit
```

## Release Management

### Semantic Versioning

```
MAJOR.MINOR.PATCH
  MAJOR: breaking changes
  MINOR: backward-compatible features
  PATCH: backward-compatible fixes
```

### Creating a release

```bash
git tag -a v1.2.0 -m "Release v1.2.0

Features:
- Add user authentication
- Implement password reset

Fixes:
- Resolve login redirect issue"

git push origin v1.2.0
```

### Changelog from commits

```bash
git log v1.1.0..v1.2.0 --oneline --no-merges
```

Or use `gh release create v1.2.0 --generate-notes` to have GitHub auto-generate from merged PRs.

## Anti-Patterns

- **Committing directly to `main`** — always use a feature branch + PR
- **Committing secrets** — `.env` in `.gitignore`, secrets in env vars only
- **Giant PRs (1000+ lines)** — break into smaller, focused PRs
- **"update" / "fix" commit messages** — vague; use conventional format
- **Force-pushing to `main`** — rewrites public history; use `git revert` instead
- **Long-lived feature branches (weeks)** — rebase frequently, merge early
- **Committing generated files** — `dist/`, `node_modules/`, `.tsbuildinfo` belong in `.gitignore`
- **Skipping hooks with `--no-verify`** — blocked by `block-no-verify` hook in Kadmon; investigate the failure instead

## Quick Reference

| Task | Command |
|---|---|
| Create branch | `git checkout -b feature/name` |
| Switch branch | `git checkout branch-name` |
| Delete merged branch | `git branch -d branch-name` |
| Merge branch | `git merge branch-name` |
| Rebase onto main | `git rebase main` |
| View history | `git log --oneline --graph` |
| View diff | `git diff` / `git diff --staged` |
| Stage hunks | `git add -p` |
| Commit | `git commit -m "feat(x): ..."` |
| Push new branch | `git push -u origin branch-name` |
| Stash work | `git stash push -m "msg"` |
| Undo last commit (soft) | `git reset --soft HEAD~1` |
| Revert pushed commit | `git revert <sha>` |

## Integration

- **kody agent** (sonnet) — primary owner. kody enforces coding standards and is the reviewer in `/chekpoint`; git-workflow is the reference kody uses when the review touches commit hygiene, branch state, or PR structure.
- **`rules/common/git-workflow.md`** — authoritative rules (`Reviewed:` footer, no `--no-verify`, small focused commits). This skill is the longer-form practical companion; the rules win on any conflict.
- **`block-no-verify` hook** — enforcement. Hook blocks any git command with `--no-verify`; this skill explains what to do instead.
- **`commit-format-guard` hook** — blocks commits that don't follow Conventional Commits format (exit 2).
- **`git-push-reminder` hook** — warns before `git push` if `/chekpoint` hasn't run in the session.
- **/chekpoint command** — entry point. kody reviews git state as part of Phase 2.

## no_context Application

Git recommendations must rest on the actual repo state, not on a generic template. Before advising "use rebase here", run `git status` and `git log --oneline -10` to see whether the branch is local-only or shared, whether there are uncommitted changes, and whether the target branch has been pushed. "Use rebase" for a branch that's already on the remote with other contributors is a destructive recommendation; "use rebase" for a local WIP branch is correct. The `no_context` principle here means: read the state before prescribing the command.
