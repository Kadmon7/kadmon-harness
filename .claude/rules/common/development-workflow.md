---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /checkpoint (includes full verification + review gate)
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (/ktest workflow)
- ALWAYS use skill-creator:skill-creator plugin for creating, editing, optimizing, or evaluating skills

## Command Reference (14)

### Observe Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /dashboard | Show harness dashboard (instincts, sessions, costs, hook health) | — |
| /kompact | Smart context compaction with audit and safety checks. Use `/kompact audit` for context audit only | — |
| /kompas | Full context rebuild — search git, memory, SQLite, docs, harness state. Use after compact or at session start | — |

### Plan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kplan | Smart planning — arkitect -> konstruct -> kody chain with user approval gate | arkitect, konstruct, kody |

### Build Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kfix | Diagnose build errors + refactor cleanup. Use `/kfix build` or `/kfix clean` for single phase | mekanik, klean |
| /kperf | Performance analysis and optimization. Use `/kperf hooks` for hook latency | kronos |

### Test Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /ktest | TDD + coverage + E2E testing pipeline. Use `/ktest coverage` or `/ktest e2e` for specific modes | feniks, kartograf |

### Review Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kreview | Quick language-aware code review (no verification, no security/database reviewers) | kody + specialists |

### Remember Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /checkpoint | Full verification + intelligent review + commit and push (5 reviewers) | kody + specialists |
| /docs | Look up live documentation for any library or framework | almanak |
| /kdocs | Sync project documentation with code changes (4-layer sync) | doktor |

### Evolve Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /eval | Run structured evaluation of agent or skill quality | — |
| /instinct | Manage instinct lifecycle — status, eval, learn, promote, prune, export (subcommands) | — |
| /evolve | Run harness self-optimization analysis | alchemik |

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
- git-push-reminder hook warns before git push without /checkpoint (PreToolUse on Bash)
- post-edit-typecheck hook validates TypeScript after edits (PostToolUse on Edit|Write)
- quality-gate hook runs lint/style checks after edits (PostToolUse on Edit|Write)
