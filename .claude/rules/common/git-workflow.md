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