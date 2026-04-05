# CLAUDE.md — Kadmon Harness

> User-level config at `~/.claude/CLAUDE.md` (identity, language, environment)

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
- MCPs: Supabase (persistence), Context7 (live documentation)
- GitHub: `gh` CLI (Kadmon7, no MCP plugin)

## Environment Variables
- `KADMON_TEST_DB` — Override SQLite DB path (`:memory:` in tests)
- `KADMON_DISABLED_HOOKS` — Comma-separated hook names to skip

## Agents (15)
| Agent | Model |
|-------|-------|
| arkitect | opus |
| konstruct | opus |
| code-reviewer | sonnet |
| typescript-reviewer | sonnet |
| database-reviewer | opus |
| security-reviewer | opus |
| tdd-guide | sonnet |
| build-error-resolver | sonnet |
| refactor-cleaner | sonnet |
| performance-optimizer | sonnet |
| python-reviewer | sonnet |
| almanak | sonnet |
| doktor | opus |
| e2e-runner | sonnet |
| harness-optimizer | opus |

## Commands (14)
- **Observe** (3): /dashboard, /kompact, /kompas
- **Plan** (1): /kplan
- **Build** (2): /kfix, /kperf
- **Test** (1): /ktest
- **Review** (1): /kreview
- **Remember** (3): /checkpoint, /docs, /kdocs
- **Evolve** (3): /eval, /instinct, /evolve

## Skills (20)
- **Workflow**: search-first, context-budget
- **Quality**: coding-standards, tdd-workflow, verification-loop, e2e-testing
- **Learning**: continuous-learning-v2, eval-harness
- **Architecture**: architecture-decision-records, api-design
- **Data**: database-migrations, postgres-patterns, iterative-retrieval, iterative-retrieval-hebrew
- **Integration**: claude-api, mcp-server-patterns
- **Other**: orchestration-patterns, systematic-debugging, receiving-code-review, safety-guard

## Hooks
20 registered hooks + 4 shared modules in `.claude/hooks/scripts/`. See `rules/common/hooks.md` for catalog.

## Memory
- **SQLite**: sessions, instincts, cost events at `~/.kadmon/kadmon.db`
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project>/memory/` with 4 types: user, feedback, project, reference
- **AutoDream**: consolidates memory every 24h/5+ sessions
- **MEMORY.md**: index file (max 200 lines)

## Common Pitfalls
- DB path: `~/.kadmon/kadmon.db` (NOT `data/harness.db`) — use `path.join(homedir(), '.kadmon', 'kadmon.db')`
- Sessions table uses `id` column (not `session_id`) — check with `PRAGMA table_info(sessions)`
- Auto-memory dir: `~/.claude/projects/C--Command-Center-Kadmon-Harness/` (hyphens, not spaces)
- Lifecycle hooks import from `dist/` — run `npm run build` after changing `scripts/lib/`
- Hook latency budgets are for logic only — Node.js cold start adds ~236ms on Windows
- ORDER BY needs `rowid` tiebreaker for deterministic results when timestamps collide
- Pattern evaluation uses 13 definitions from `.claude/hooks/pattern-definitions.json`
- `new URL().pathname` encodes spaces as `%20` — use `fileURLToPath()` for file paths
- Stop hooks only fire on clean session termination — crashes do NOT trigger them
- `npx tsx -e` produces no output on Windows — use temp script files

## Status
v0.3.2 — Trimmed (260 tests passing, 20 hooks, 15 agents, 20 skills, 14 commands)
