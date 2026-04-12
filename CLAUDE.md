# CLAUDE.md — Kadmon Harness

> User-level config at `~/.claude/CLAUDE.md` (identity, language, environment)

## Project Overview

Kadmon Harness is Claude Code's operative layer — a portable set of agents, commands, skills, hooks, and rules that encode how Claude should work on any project. Built once, carried to every new project via bootstrap. Not a product; infrastructure.

## Quick Start
```bash
npm install && npm run build && npx vitest run
npx tsx scripts/dashboard.ts       # Show harness dashboard
```

## Core Principle
no_context — if no evidence exists, respond `no_context` and flag what is missing. Enforced by `no-context-guard` hook.

Mantra: Observe -> Remember -> Verify -> Specialize -> Evolve

## Stack
- Language: TypeScript / JavaScript (primary)
- Persistence: SQLite at `~/.kadmon/kadmon.db` (v1) — Supabase planned for v2
- Runtime: Claude Code CLI on Windows (Git Bash)
- MCPs: Context7 (live documentation)
- GitHub: `gh` CLI (Kadmon7, no MCP plugin)
- File size: < 200 lines preferred, 400 normal max, 800 hard limit (refactor required)

## File Structure

```
Kadmon-Harness/
|-- .claude/
|   |-- agents/           # 15 specialist agents (markdown definitions)
|   |-- agent-memory/     # Per-agent MEMORY.md (gitignored)
|   |-- commands/         # 12 slash commands
|   |-- skills/           # 22 reference skills
|   |-- rules/            # 19 rules (common + typescript + python)
|   |-- hooks/scripts/    # 20 registered hook scripts + shared modules
|   `-- settings.json     # Hook registration + permissions
|-- scripts/
|   |-- lib/              # TypeScript sources (state-store, instincts, etc)
|   |-- dashboard.ts      # /kadmon-harness entry point
|   `-- *.ts              # Migration + cleanup scripts
|-- tests/                # Vitest suite (419 passing)
|-- docs/
|   |-- decisions/        # ADRs
|   |-- plans/            # Implementation plans
|   `-- roadmap/          # Future version planning
|-- CLAUDE.md             # This file
`-- package.json
```

## Environment Variables
- `KADMON_TEST_DB` — Override SQLite DB path (`:memory:` in tests)
- `KADMON_DISABLED_HOOKS` — Comma-separated hook names to skip
- `KADMON_NO_CONTEXT_GUARD` — Set to `"off"` to disable no-context enforcement

## Agents (15)
| Agent | Model |
|-------|-------|
| arkitect | opus |
| konstruct | opus |
| kody | sonnet |
| typescript-reviewer | sonnet |
| orakle | opus |
| spektr | opus |
| feniks | sonnet |
| mekanik | sonnet |
| kurator | sonnet |
| arkonte | sonnet |
| python-reviewer | sonnet |
| almanak | sonnet |
| doks | opus |
| kartograf | sonnet |
| alchemik | opus |

## Commands (12)
- **Observe** (3): /kadmon-harness, /kompact, /kompas
- **Plan** (1): /abra-kdabra
- **Build** (1): /medik (alias /MediK)
- **Scan** (1): /skanner
- **Remember** (3): /chekpoint, /almanak, /doks
- **Evolve** (3): /akademy, /instinct, /evolve

## Skills (22)
- **Workflow**: search-first, context-budget
- **Quality**: coding-standards, tdd-workflow, verification-loop, e2e-testing
- **Learning**: continuous-learning-v2, eval-harness
- **Architecture**: architecture-decision-records, api-design
- **Data**: database-migrations, postgres-patterns
- **Integration**: claude-api, mcp-server-patterns
- **Python**: python-patterns, python-testing
- **Frontend**: frontend-patterns
- **Research**: deep-research
- **Documentation**: docs-sync
- **Other**: systematic-debugging, receiving-code-review, safety-guard

## External Tools

### Plugins (4)
| Plugin | Invocation | Use |
|--------|-----------|-----|
| skill-creator | `skill-creator:skill-creator` | REQUIRED for all skill work (create/edit/evaluate) |
| context7 | Via almanak agent (`/almanak`) | Live library docs |
| frontend-design | `frontend-design:frontend-design` | Production-grade frontend interfaces |
| ralph-loop | `ralph-loop:ralph-loop` | Recurring execution loops |

### MCPs (per-project)
| MCP | Status | Used by |
|-----|--------|---------|
| Context7 | Active | almanak, deep-research |
| Supabase | Disabled (v2) | — |

### CLIs
| CLI | Use |
|-----|-----|
| `gh` | GitHub (PRs, issues) — no MCP needed |
| `node` / `npm` / `npx` | Runtime, packages |
| `git` | Version control |

## Rules

19 rules organized by scope in `.claude/rules/`:
- `common/` — coding-style, security, testing, patterns, performance, git-workflow, development-workflow, agents, hooks
- `typescript/` — ts-specific coding-style, patterns, security, testing, hooks
- `python/` — py-specific coding-style, patterns, security, testing, hooks

Rules auto-load based on file context. See `.claude/rules/common/agents.md` for agent orchestration rules.

## Hooks
20 registered hooks + 8 shared modules in `.claude/hooks/scripts/`. See `rules/common/hooks.md` for catalog.

## Memory
- **SQLite**: sessions, instincts, cost events, hook events, agent invocations at `~/.kadmon/kadmon.db` (6 tables)
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project>/memory/` with 4 types: user, feedback, project, reference
- **AutoDream**: consolidates memory every 24h/5+ sessions
- **MEMORY.md**: index file (max 200 lines)

## Common Pitfalls
- DB path: `~/.kadmon/kadmon.db` (NOT `data/harness.db`) — use `path.join(homedir(), '.kadmon', 'kadmon.db')`
- Sessions table uses `id` column (not `session_id`) — check with `PRAGMA table_info(sessions)`
- Auto-memory dir: `~/.claude/projects/C--Command-Center-Kadmon-Harness/` (hyphens, not spaces)
- Lifecycle hooks import from `dist/` — `ensure-dist.js` auto-rebuilds, but manual `npm run build` if needed
- Hook latency budgets are for logic only — Node.js cold start adds ~236ms on Windows
- ORDER BY needs `rowid` tiebreaker for deterministic results when timestamps collide
- Pattern evaluation uses 13 definitions from `.claude/hooks/pattern-definitions.json`
- `new URL().pathname` encodes spaces as `%20` — use `fileURLToPath()` for file paths
- Stop hooks only fire on clean session termination — crashes do NOT trigger them
- `npx tsx -e` produces no output on Windows — use temp script files

## Status
v1.0 — Production ready (344 tests passing, 37 test files, 20 hooks, 15 agents, 22 skills, 12 commands, 19 rules, 6 DB tables)
