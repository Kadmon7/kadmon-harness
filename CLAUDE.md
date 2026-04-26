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

## graphify

This project has a graphify knowledge graph at graphify-out/. Adoption confirmed Sprint E 2026-04-24 with **8.11× token reduction** (ADR-026).

**Primary memory reference**: `~/.claude/projects/C--Command-Center-Kadmon-Harness/memory/reference_graphify.md` — 5 rules, commands cheat-sheet, benchmark results, foot-gun link.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

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
|-- .claude-plugin/             # Plugin manifest (plugin.json, hooks.json, marketplace.json)
|-- .claude/
|   |-- agents/                 # 16 specialists + _TEMPLATE.md.example
|   |-- commands/               # 11 slash commands
|   |-- skills/                 # 46 skills at <name>/SKILL.md (ADR-013)
|   |-- rules/                  # 19 rules (common + typescript + python)
|   |-- hooks/scripts/          # 22 hooks + 8 shared modules
|   `-- settings.json
|-- agents | commands | skills  # Canonical root symlinks → .claude/<type>/ (ADR-019, plugin loader discovery)
|-- scripts/lib/                # TS: state-store, instincts, evolve-generate, install-apply, ...
|-- install.sh | install.ps1    # Cross-shell bootstrap (delegate to install-apply.ts)
|-- tests/                      # Vitest suite
|-- docs/{decisions,plans,research,roadmap}/
|-- CLAUDE.md                   # This file
`-- package.json
```

## Environment Variables
- `KADMON_TEST_DB` — Override SQLite DB path (`:memory:` in tests)
- `KADMON_DISABLED_HOOKS` — Comma-separated hook names to skip
- `KADMON_NO_CONTEXT_GUARD` — `"off"` to disable no-context enforcement
- `KADMON_EVOLVE_WINDOW_DAYS` — /evolve Generate ClusterReport read window (default: 7)
- `KADMON_RESEARCH_AUTOWRITE` — `"off"` to skip `/skavenger` auto-write to `docs/research/` (ADR-015)
- `KADMON_RUNTIME_ROOT` — Harness repo root for plugin hooks to find `dist/` (ADR-010 Phase 1). Unset in local dev.
- `KADMON_USER_SETTINGS_PATH` — Override user-scope `settings.json` for installer tests.
- `KADMON_PROJECT_LANGUAGE` — Force language detection (`typescript`|`python`|`mixed`|`unknown`); bypasses file-marker scan (ADR-020).
- `KADMON_ORPHAN_STALE_MS` — Inactivity ms before a session is orphan-recovery-eligible (default: 300000, ADR-022).

## Settings Hierarchy (3 tiers, merged additively — Managed → User → Project → Local)
- `~/.claude/settings.json` — **User global**. Machine-specific permissions that apply across all projects (absolute paths, platform-specific commands). Not committed.
- `.claude/settings.json` — **Project team-shared**. Hooks + `permissions.allow` (generic tools). Since Sprint D (ADR-010): hooks ship via `.claude-plugin/hooks.json`; `permissions.deny` is merged into targets by `install.sh`/`install.ps1`.
- `.claude/settings.local.json` — **Project personal**. Gitignored; machine-specific overrides only.

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
| skavenger | sonnet |

Full routing + skill chains at `.claude/rules/common/agents.md`. Chain: `arkitect → konstruct → feniks (if TDD)`. Code review = `/chekpoint`'s job, not `/abra-kdabra`'s.

## Commands (11)
- **Observe** (2): /nexus, /kompact
- **Plan** (1): /abra-kdabra
- **Build** (1): /medik (alias /MediK)
- **Scan** (1): /skanner
- **Research** (1): /skavenger (routes A=Media / B=General — see skavenger agent doc)
- **Remember** (3): /chekpoint, /almanak, /doks
- **Evolve** (2): /forge, /evolve (step 6 Generate promoted to accepted 2026-04-24 after observation window)

## Skills (46)

Catalog at `.claude/skills/` — each at `<name>/SKILL.md` (ADR-013). Clusters: workflow, quality, learning, architecture, data, integration, meta, python, frontend, research, docs, cost/perf, security, git, decision-making. Drift audit via `/medik` Check #8 (agent frontmatter) + Check #14 (capability-alignment, ADR-029).

## External Tools

| Type | Name | Use |
|---|---|---|
| Plugin | `skill-creator:skill-creator` | REQUIRED for all skill work (create/edit/evaluate) |
| Plugin | `context7` | Live library docs (via `almanak` / `/almanak`) |
| Plugin | `frontend-design:frontend-design` | Production-grade frontend interfaces |
| Plugin | `ralph-loop:ralph-loop` | Recurring execution loops |
| MCP | Context7 | Active — used by almanak, deep-research |
| CLI | `gh` | GitHub (PRs, issues) — no MCP needed |
| CLI | `node` / `npm` / `npx` | Runtime, packages |
| CLI | `git` | Version control |

## Rules

19 rules organized by scope in `.claude/rules/`:
- `common/` — coding-style, security, testing, patterns, performance, git-workflow, development-workflow, agents, hooks
- `typescript/` — ts-specific coding-style, patterns, security, testing, hooks
- `python/` — py-specific coding-style, patterns, security, testing, hooks

Rules auto-load based on file context. See `.claude/rules/common/agents.md` for agent orchestration rules.

## Hooks
22 registered hooks + 8 shared modules in `.claude/hooks/scripts/`. See `rules/common/hooks.md` for catalog.

## Memory
- **SQLite**: sessions, instincts, cost events, hook events, agent invocations, sync queue, research reports at `~/.kadmon/kadmon.db` (7 tables; research_reports added in ADR-015)
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project>/memory/` with 4 types: user, feedback, project, reference
- **AutoDream**: consolidates memory every 24h/5+ sessions
- **MEMORY.md**: index file (max 200 lines)

## Distribution

Hybrid model (ADR-010 + ADR-019):

- **Claude Code plugin** — ships agents/skills/commands/hooks. Canonical root symlinks `./{agents,skills,commands}` are how the plugin loader discovers components. Windows requires Developer Mode + `git config --global core.symlinks true` + `MSYS=winsymlinks:nativestrict` during clone.
- **`install.sh` / `install.ps1`** — ship what plugins can't: `rules/`, 14 `permissions.deny`, 9 CORE `permissions.allow` (ADR-021 Q1), `.kadmon-version`. Both delegate to `scripts/lib/install-apply.ts` via `npx tsx`.
- **`_TEMPLATE.md.example`** — new agents derive from `.claude/agents/_TEMPLATE.md.example`. The `.md.example` extension keeps it invisible to loaders/linters (ADR-017 + ADR-019).

## Common Pitfalls
- DB path: `~/.kadmon/kadmon.db` — use `path.join(homedir(), '.kadmon', 'kadmon.db')`
- Sessions table uses `id` column (not `session_id`) — check with `PRAGMA table_info(sessions)`
- Auto-memory dir: `~/.claude/projects/C--Command-Center-Kadmon-Harness/` (hyphens, not spaces)
- Lifecycle hooks import from `dist/` — `ensure-dist.js` auto-rebuilds, or run `npm run build` manually
- Hook latency budgets are for logic only — Node.js cold start adds ~236ms on Windows
- ORDER BY needs `rowid` tiebreaker for deterministic results when timestamps collide
- Pattern evaluation rules live in `.claude/hooks/pattern-definitions.json` (ADR-006)
- `file_sequence` follow-up matching checks BOTH `Bash.metadata.command` AND `Skill.metadata.skillName` — editing this detector requires updating both branches
- `/evolve` Generate writes are transactional + project-root-bounded (ADR-008)
- Skills live at `.claude/skills/<name>/SKILL.md` — flat files are invisible to the loader (ADR-013, enforced by `/medik` Check #8)

<!-- Status: max 4 líneas. Narrativa de bugs/releases vive en git log + docs/decisions/ -->
## Status
v1.3.0 — 1069 tests / 85 files / 22 hooks / 16 agents / 46 skills / 11 commands / 19 rules / 7 DB tables / 14 /medik checks.
Distribution: Claude Code plugin + install.sh/install.ps1 (ADR-010). Language support: TypeScript + Python (ADR-020). Install health telemetry (ADR-024). Versioning policy (ADR-025). Graphify adoption (ADR-026, Sprint E PASS 8.11x). Python SAST hook (ADR-027). /medik expansion 9→14 + --ALV export (ADR-028, ADR-029). /evolve Generate step 6 promoted to accepted 2026-04-24. Project-agnostic /skanner stack — kartograf + arkonte + /skanner detect `harness|web|cli` profile at runtime (ADR-031).
Shipping history: `docs/decisions/` and `git log`.
