---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /verify before /checkpoint
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (/tdd workflow)
- ALWAYS use skill-creator:skill-creator plugin for creating, editing, optimizing, or evaluating skills

## Command Reference (19)

### Observe Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /context-budget | Audit context window usage and suggest optimizations | — |
| /dashboard | Show harness dashboard (instincts, sessions, costs, hook health) | — |
| /kompact | Smart context compaction with audit and safety checks | — |

### Remember Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /checkpoint | Save progress — run verification then commit and push | code-reviewer |
| /docs | Look up live documentation for any library or framework | docs-lookup |
| /update-docs | Update CLAUDE.md, README, and project documentation | doc-updater |

### Verify Phase (7)
| Command | Purpose | Agent |
|---------|---------|-------|
| /tdd | Start TDD cycle — write failing test first, then implement | tdd-guide |
| /verify | Run full verification loop — typecheck, tests, lint. Use `/verify full` for security scan | — |
| /build-fix | Diagnose and fix build or compilation errors | build-error-resolver |
| /code-review | Run code review on staged or recent changes | code-reviewer |
| /test-coverage | Check and report test coverage per file | — |
| /e2e | Generate and run E2E tests for full workflow verification | e2e-runner |
| /eval | Run structured evaluation of agent or skill quality | — |

### Specialize Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kplan | Smart planning — routes to architect+planner or planner-only based on task signals | planner, architect |
| /workflow | Show available workflow chains (dev, qa, instinct, evolve) or guide through one | — |

### Evolve Phase (4)
| Command | Purpose | Agent |
|---------|---------|-------|
| /instincts | Show instinct dashboard with status and quality evaluation | — |
| /instinct | Manage instinct lifecycle — learn, promote, prune, export (subcommands) | — |
| /evolve | Run harness self-optimization analysis | harness-optimizer |
| /refactor-clean | Invoke refactor-cleaner agent to improve code structure | refactor-cleaner |

## Commits
- MUST use conventional commits: feat/fix/chore/docs/refactor/test
- PREFER small focused commits over large monolithic ones
- MUST include scope when relevant: `feat(instincts): add export function`
- NEVER commit unrelated changes in the same commit

## Research
- ALWAYS follow search-first skill (5 steps: codebase → dependencies → docs → evaluate → proceed)
- SHOULD search GitHub for existing implementations: `gh search code <query>`
- ALWAYS use /docs for API lookups instead of relying on memory
- MUST read existing code before modifying it (enforced by no-context-guard hook)

## Enforcement
- no-context-guard hook blocks edits without prior Read (PreToolUse on Edit|Write)
- block-no-verify hook prevents skipping git hooks (PreToolUse on Bash)
- git-push-reminder hook warns before git push without /verify (PreToolUse on Bash)
- post-edit-typecheck hook validates TypeScript after edits (PostToolUse on Edit|Write)
- quality-gate hook runs lint/style checks after edits (PostToolUse on Edit|Write)
