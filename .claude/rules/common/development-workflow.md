---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /chekpoint (includes full verification + review gate)
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (TDD workflow)
- ALWAYS use skill-creator:skill-creator plugin for creating, editing, optimizing, or evaluating skills. Invoke: `skill: "skill-creator:skill-creator"`. Never create skill files manually — the plugin handles structure, frontmatter, description optimization, and eval setup.

## Command Reference (12)

### Observe Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kadmon-harness | Show harness dashboard (instincts, sessions, costs, hook health) | — |
| /kompact | Smart context compaction with audit and safety checks. Use `/kompact audit` for context audit only | — |
| /kompas | Full context rebuild — search git, memory, SQLite, docs, harness state. Use after compact or at session start | — |

### Plan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /abra-kdabra | Smart planning — arkitect -> konstruct -> feniks (if TDD) -> kody chain with user approval gate | arkitect, konstruct, feniks, kody |

### Build Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /medik | Full harness diagnostic — 7 health checks, approval gate, repair, cleanup. Alias: /MediK. Use `/medik build`, `/medik hooks`, `/medik db`, or `/medik clean` for single phase | mekanik, kurator |

### Scan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /skanner | Deep system assessment — performance profiling + E2E workflow tests in parallel. Optional agent evaluation. | arkonte, kartograf |

### Remember Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /chekpoint | Full verification + intelligent review + commit and push (5 reviewers) | kody + specialists |
| /almanak | Look up live documentation for any library or framework | almanak |
| /doks | Sync project documentation with code changes (4-layer sync) | doks |

### Evolve Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /akademy | Run structured evaluation of agent or skill quality | — |
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
- ALWAYS use /almanak for API lookups instead of relying on memory
- MUST read existing code before modifying it (enforced by no-context-guard hook)

## Enforcement
- no-context-guard hook blocks edits without prior Read (PreToolUse on Edit|Write)
- block-no-verify hook prevents skipping git hooks (PreToolUse on Bash)
- git-push-reminder hook warns before git push without /chekpoint (PreToolUse on Bash)
- post-edit-typecheck hook validates TypeScript after edits (PostToolUse on Edit|Write)
- quality-gate hook runs lint/style checks after edits (PostToolUse on Edit|Write)
