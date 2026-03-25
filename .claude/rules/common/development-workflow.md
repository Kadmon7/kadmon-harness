---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /verify before /checkpoint
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (/tdd workflow)

## Command Reference (22)

### Observe Phase
| Command | Purpose | Agent |
|---------|---------|-------|
| /context-budget | Audit context window usage and suggest optimizations | — |
| /sessions | Show recent session history for the current project | — |

### Remember Phase
| Command | Purpose | Agent |
|---------|---------|-------|
| /checkpoint | Save progress — run verification then commit and push | code-reviewer |
| /docs | Look up live documentation for any library or framework | docs-lookup |
| /update-docs | Update CLAUDE.md, README, and project documentation | doc-updater |

### Verify Phase
| Command | Purpose | Agent |
|---------|---------|-------|
| /tdd | Start TDD cycle — write failing test first, then implement | tdd-guide |
| /verify | Run full verification loop — typecheck, tests, lint | — |
| /build-fix | Diagnose and fix build or compilation errors | build-error-resolver |
| /code-review | Run code review on staged or recent changes | code-reviewer |
| /quality-gate | Run all quality checks — typecheck, tests, lint, security | — |
| /test-coverage | Check and report test coverage per file | — |
| /e2e | Generate and run E2E tests for full workflow verification | e2e-runner |
| /eval | Run structured evaluation of agent or skill quality | — |

### Specialize Phase
| Command | Purpose | Agent |
|---------|---------|-------|
| /kplan | Plan complex multi-file or uncertain tasks | planner, architect |

### Evolve Phase
| Command | Purpose | Agent |
|---------|---------|-------|
| /learn | Extract patterns from current session and create instincts | — |
| /learn-eval | Evaluate quality of learned instincts | — |
| /evolve | Run harness self-optimization analysis | harness-optimizer |
| /instinct-status | Show current instinct dashboard for this project | — |
| /instinct-export | Export instincts to JSON file for backup or sharing | — |
| /promote | Promote a high-confidence instinct to a skill | — |
| /prune | Archive weak or contradicted instincts | — |
| /refactor-clean | Invoke refactor-cleaner agent to improve code structure | refactor-cleaner |

## Commits
- MUST use conventional commits: feat/fix/chore/docs/refactor/test
- PREFER small focused commits over large monolithic ones
- MUST include scope when relevant: `feat(instincts): add export function`
- NEVER commit unrelated changes in the same commit

## Research
- ALWAYS search codebase before writing new code (search-first skill)
- ALWAYS use /docs for API lookups instead of relying on memory
- MUST read existing code before modifying it (enforced by no-context-guard hook)

## Enforcement
- no-context-guard hook blocks edits without prior Read (PreToolUse on Edit|Write)
- block-no-verify hook prevents skipping git hooks (PreToolUse on Bash)
- git-push-reminder hook warns before git push without /verify (PreToolUse on Bash)
- post-edit-typecheck hook validates TypeScript after edits (PostToolUse on Edit|Write)
- quality-gate hook runs lint/style checks after edits (PostToolUse on Edit|Write)
