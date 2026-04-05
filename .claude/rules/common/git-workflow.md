---
alwaysApply: true
---

# Git Workflow Rules

## Commits
- MUST use conventional commit format: `type(scope): description`
- Types: feat, fix, docs, chore, refactor, test, style, perf
- NEVER use --no-verify (enforced by block-no-verify hook)
- ALWAYS run typecheck before pushing

## Branches
- PREFER feature branches for multi-commit features
- ALWAYS pull before push to avoid conflicts

## Safety
- NEVER force push to main
- NEVER commit secrets, .env files, or .db files (.gitignore enforced)
- ALWAYS review diff before committing: `git diff --staged`

## PR Workflow
1. Run /checkpoint (includes verification + review gate) before creating PR
2. Use `gh pr create` (not GitHub MCP)
3. Analyze ALL commits since divergence: `git diff main...HEAD`
4. Include test plan in PR body
5. pr-created hook logs PR URL automatically

## Enforcement
- block-no-verify hook blocks any git command with --no-verify flag (PreToolUse on Bash, exit 2)
- git-push-reminder hook warns before git push without running /checkpoint first (PreToolUse on Bash, exit 1)
- config-protection hook prevents accidental edits to critical config files (PreToolUse on Edit|Write, exit 2)
- kody agent runs automatically as part of /checkpoint review phase
- /checkpoint command orchestrates: verify → 5 parallel reviewers → gate → commit → push