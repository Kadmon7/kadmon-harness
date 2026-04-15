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

## Self-Improvement Loop (mid-session)

Commit-time + session-end learning is handled by `/forge` (observations → instincts) and `/evolve` (instincts → skills/agents/commands). This loop is for **immediate in-session reaction** — the model you are right now, not the pipeline that runs at the end.

- **On correction** ("no así", "stop doing X", "esto estuvo mal"): write to auto-memory (`feedback` type) BEFORE continuing the task. Do not batch corrections until commit time — the next tool call should already reflect the correction.
- **On validation** ("sí, perfecto, sigue así", or the user accepting a non-obvious choice without pushback): save it as a positive feedback memory. Validated judgment calls are as valuable as corrections — `/forge` tends to bias toward failures, so you must capture successes manually.
- **On déjà-vu** (you feel you are about to repeat a pattern from a previous session): stop, read `memory/feedback_*.md` and `memory/project_*.md` before the next tool call, and adjust.
- **Never skip the loop to save tokens.** A 3-line memory write now is cheaper than re-learning the same lesson in the next 5 sessions.

See also: `continuous-learning-v2` skill and `~/.claude/projects/<project>/memory/MEMORY.md` index.

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
|   |-- agents/           # 16 specialist agents (markdown definitions)
|   |-- agent-memory/     # Per-agent MEMORY.md (gitignored)
|   |-- commands/         # 11 slash commands
|   |-- skills/           # 46 reference skills
|   |-- rules/            # 19 rules (common + typescript + python)
|   |-- hooks/scripts/    # 21 registered hook scripts + 8 shared modules
|   `-- settings.json     # Hook registration + permissions
|-- scripts/
|   |-- lib/              # TypeScript sources (state-store, instincts, evolve-generate, evolve-report-reader, ...)
|   |   `-- evolve-generate-templates/  # 4 markdown templates (skill/command/agent/rule)
|   |-- dashboard.ts      # /kadmon-harness entry point
|   |-- migrate-fix-session-inversion.ts  # Sprint C repair script (--apply gate)
|   `-- *.ts              # Migration + cleanup scripts
|-- tests/                # Vitest suite (576 passing, 57 files)
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
- `KADMON_EVOLVE_WINDOW_DAYS` — /evolve Generate ClusterReport read window (default: 7)

## Settings Hierarchy (3 tiers, merged additively — Managed → User → Project → Local)
- `~/.claude/settings.json` — **User global**. Machine-specific permissions that apply across all your projects (absolute paths, platform-specific commands like `winget`). Not committed.
- `.claude/settings.json` — **Project team-shared**. Hooks, deny rules, enabledPlugins, and the `permissions.allow` block with generic tools (Bash utilities, public docs WebFetch, Skill, MCP). Committed — distributed via plan-003 bootstrap.
- `.claude/settings.local.json` — **Project personal**. Gitignored per Claude Code convention. Reserved for truly machine-specific overrides of *this* repo; empty by default.

## Agents (16)
| Agent | Model |
|-------|-------|
| arkitect | opus |
| konstruct | opus |
| kody | sonnet |
| typescript-reviewer | sonnet |
| orakle | sonnet |
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
| kerka | sonnet |

## Commands (11)
- **Observe** (2): /kadmon-harness, /kompact
- **Plan** (1): /abra-kdabra
- **Build** (1): /medik (alias /MediK)
- **Scan** (1): /skanner
- **Research** (1): /research
- **Remember** (3): /chekpoint, /almanak, /doks
- **Evolve** (2): /forge, /evolve (step 6 Generate is EXPERIMENTAL through 2026-04-28; /instinct is a deprecated alias until 2026-04-20)

## Skills (46)
- **Workflow**: search-first, context-budget, token-budget-advisor, strategic-compact
- **Quality**: coding-standards, tdd-workflow, verification-loop, e2e-testing, eval-harness, ai-regression-testing
- **Learning**: continuous-learning-v2
- **Architecture**: architecture-decision-records, api-design, hexagonal-architecture, docker-patterns
- **Data**: database-migrations, postgres-patterns, content-hash-cache-pattern
- **Integration**: claude-api, mcp-server-patterns, documentation-lookup
- **Meta (Sprint F Tier S)**: skill-stocktake, agent-eval, agent-introspection-debugging, prompt-optimizer, skill-comply, rules-distill, workspace-surface-audit, codebase-onboarding
- **Python**: python-patterns, python-testing
- **Frontend**: frontend-patterns
- **Research**: deep-research
- **Documentation**: docs-sync, code-tour
- **Cost / Performance**: cost-aware-llm-pipeline, benchmark
- **Security**: safety-guard, security-review, security-scan
- **Git / GitHub**: git-workflow, github-ops
- **Decision-making**: council, regex-vs-llm-structured-text
- **Other**: systematic-debugging, receiving-code-review

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
21 registered hooks + 8 shared modules in `.claude/hooks/scripts/`. See `rules/common/hooks.md` for catalog.

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
- Pattern evaluation uses 12 definitions from `.claude/hooks/pattern-definitions.json` (10 file_sequence + 1 tool_arg_presence + 1 cluster; ADR-006)
- `file_sequence` follow-up matching checks BOTH `Bash.metadata.command` AND `Skill.metadata.skillName` — slash commands like `/doks`, `/forge`, `/almanak` are Skill tool calls, not Bash. Editing this detector requires updating both branches.
- `new URL().pathname` encodes spaces as `%20` — use `fileURLToPath()` for file paths
- Stop hooks only fire on clean session termination — crashes do NOT trigger them
- `npx tsx -e` produces no output on Windows — use temp script files
- /evolve Generate (step 6) is cross-project: `readClusterReportsInWindow` filters ClusterReports by the caller's `projectHash` before merging. Never write generated artifacts to a directory that escapes `cwd` — `applyEvolveGenerate` aborts the ENTIRE batch transactionally if any proposal target path exists OR escapes the project root (ADR-008).
- Sprint C Bug B fix: `startSession()` resume branch MUST call `clearSessionEndState(id)` before upserting, and MUST clear `merged.durationMs`, otherwise `COALESCE` restores the prior `ended_at`/`duration_ms` and produces the timestamp inversion.

## Status
v1.1 Sprint B/C/D shipped 2026-04-14 — 576 tests passing, 57 test files, 21 hooks, 16 agents, 46 skills, 11 commands (with /evolve Generate step 6 EXPERIMENTAL through 2026-04-28), 19 rules, 6 DB tables, /forge → /evolve loop closed for cross-project artifact generation (ADR-007 hook duration instrumentation + session inversion fix; ADR-008 /evolve Generate pipeline; ADR-009 deep research capability — kerka agent + /research command + yt-dlp helper)
