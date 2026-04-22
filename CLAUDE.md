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
|-- .claude-plugin/        # Plugin manifest (plugin.json, hooks.json, marketplace.json)
|-- .claude/
|   |-- agents/           # 16 specialist agents + _TEMPLATE.md.example
|   |-- agent-memory/     # Per-agent MEMORY.md (gitignored)
|   |-- commands/         # 11 slash commands
|   |-- skills/           # 46 reference skills, each at <name>/SKILL.md (ADR-013)
|   |-- rules/            # 19 rules (common + typescript + python)
|   |-- hooks/scripts/    # 21 registered hook scripts + 8 shared modules
|   `-- settings.json     # Hook registration + permissions
|-- .husky/                # Committed pre-commit hook (plan-010 Phase 6)
|-- agents -> .claude/agents       # Canonical root symlink (ADR-019) — plugin loader discovery
|-- commands -> .claude/commands   # Canonical root symlink (ADR-019)
|-- skills -> .claude/skills       # Canonical root symlink (ADR-019)
|-- scripts/
|   |-- lib/              # TS: state-store, instincts, evolve-generate, install-helpers, install-apply, install-manifest, ...
|   |   `-- evolve-generate-templates/  # 4 markdown templates (skill/command/agent/rule)
|   |-- dashboard.ts      # /kadmon-harness entry point
|   |-- migrate-fix-session-inversion.ts  # Sprint C repair script (--apply gate)
|   `-- *.ts              # Migration + cleanup scripts
|-- install.sh             # Sprint D bash bootstrap (plan-010 Phase 4)
|-- install.ps1            # Sprint D PowerShell bootstrap (plan-010 Phase 5)
|-- tests/                # Vitest suite (870 passing, 70 files)
|-- docs/
|   |-- decisions/        # ADRs
|   |-- plans/            # Implementation plans
|   |-- research/         # /skavenger auto-written reports (research-NNN-<slug>.md, ADR-015)
|   `-- roadmap/          # Future version planning
|-- .gitattributes         # Symlink preservation on Windows clones
|-- CLAUDE.md             # This file
`-- package.json
```

## Environment Variables
- `KADMON_TEST_DB` — Override SQLite DB path (`:memory:` in tests)
- `KADMON_DISABLED_HOOKS` — Comma-separated hook names to skip
- `KADMON_NO_CONTEXT_GUARD` — Set to `"off"` to disable no-context enforcement
- `KADMON_EVOLVE_WINDOW_DAYS` — /evolve Generate ClusterReport read window (default: 7)
- `KADMON_RESEARCH_AUTOWRITE` — Set to `"off"` to skip `/skavenger` auto-write of reports to `docs/research/` (ADR-015 escape hatch)
- `KADMON_RUNTIME_ROOT` — Absolute path to the harness repo root containing `dist/scripts/lib/*.js`. Set by the plugin's `hooks.json` for plugin-installed hooks; unset for local dev (falls back to 3-level relative walk). Required so hooks running from the plugin cache can resolve compiled TypeScript (ADR-010 Phase 1 primitive).
- `KADMON_USER_SETTINGS_PATH` — Override path to user-scope `settings.json` consumed by `install-apply.ts`. Used by installer tests (install-sh / install-ps1) to avoid mutating the real `~/.claude/settings.json`. Production installs leave this unset.
- `KADMON_PROJECT_LANGUAGE` — Force language detection result (`typescript`, `python`, `mixed`, `unknown`). Bypasses the file-marker scan in `scripts/lib/detect-project-language.ts`. Normalized (trim + lowercase) before whitelist check; invalid values fall through to marker detection. Used by `/chekpoint`, `/medik`, and 6 hooks (ADR-020, plan-020 Phase A).
- `KADMON_ORPHAN_STALE_MS` — Milliseconds of inactivity (`observations.jsonl` mtime or `started_at` age) before a session is eligible for orphan recovery in `session-start.js`. Default: 300000 (5 min). Lower values risk pisando live parallel sessions; higher values delay legitimate crash recovery. Implemented via `isOrphanStale()` in `scripts/lib/orphan-staleness.ts` (ADR-022 Bug 2).

## Settings Hierarchy (3 tiers, merged additively — Managed → User → Project → Local)
- `~/.claude/settings.json` — **User global**. Machine-specific permissions that apply across all your projects (absolute paths, platform-specific commands like `winget`). Not committed.
- `.claude/settings.json` — **Project team-shared**. Hooks and `permissions.allow` block with generic tools (Bash utilities, public docs WebFetch, Skill, MCP). Committed. Since Sprint D (ADR-010): hooks are distributed via the plugin manifest at `.claude-plugin/hooks.json`; `permissions.deny` is merged into target projects by `install.sh`/`install.ps1`.
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
| skavenger | sonnet |

## Commands (11)
- **Observe** (2): /kadmon-harness, /kompact
- **Plan** (1): /abra-kdabra
- **Build** (1): /medik (alias /MediK)
- **Scan** (1): /skanner
- **Research** (1): /skavenger (2 routes: A=Media via yt-dlp, B=General via WebSearch/WebFetch; flags: `--continue`, `--plan`, `--verify <hyp>`, `--drill <N>`, `--history <query>`, `--verify-citations <N>` — ADR-015 Groups A, B, D + ADR-016 slim refactor; auto-writes to `docs/research/` unless `KADMON_RESEARCH_AUTOWRITE=off`)
- **Remember** (3): /chekpoint, /almanak, /doks
- **Evolve** (2): /forge, /evolve (step 6 Generate is EXPERIMENTAL through 2026-04-28)

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
- **SQLite**: sessions, instincts, cost events, hook events, agent invocations, sync queue, research reports at `~/.kadmon/kadmon.db` (7 tables; research_reports added in ADR-015)
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project>/memory/` with 4 types: user, feedback, project, reference
- **AutoDream**: consolidates memory every 24h/5+ sessions
- **MEMORY.md**: index file (max 200 lines)

## Distribution

Hybrid model (per [ADR-010](docs/decisions/ADR-010-harness-distribution-hybrid.md) + [ADR-019](docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md)):

- **Claude Code plugin** — distributes agents, skills, commands, and hooks. The canonical root symlinks `./agents`, `./skills`, `./commands` (pointing at `.claude/<type>/`) are how the plugin loader discovers components. Windows requires Developer Mode + `git config --global core.symlinks true` + `MSYS=winsymlinks:nativestrict` during clone — otherwise symlinks resolve as text files and the plugin manifest is rejected.
- **`install.sh` / `install.ps1`** — bootstrap the three categories Claude Code plugins cannot ship: `rules/` (copied into target's `.claude/rules/`), `permissions.deny` (14 canonical rules merged into target's `.claude/settings.json` per ADR-010 Q4), and `permissions.allow` (9 CORE canonical rules merged per ADR-021 Q1 — git/npm/node/npx/cd/ls/pwd/which + Skill). Also writes `.kadmon-version`, updates `.gitignore`, and registers the plugin in the user's `~/.claude/settings.json` via `extraKnownMarketplaces` + `enabledPlugins`. Both entry points delegate to `scripts/lib/install-apply.ts` via `npx tsx` (DRY across shells).
- **`_TEMPLATE.md.example`** — new agents derive from `.claude/agents/_TEMPLATE.md.example` (ADR-017, amended by ADR-019 dogfood). The `.md.example` extension keeps the skeleton invisible to Claude Code's sub-agent loader and the frontmatter linter (both scan only `.md`). Original `_`-prefix convention from ADR-017 was insufficient — the loader does not respect it.

See `install.sh` / `install.ps1` for the exact 11-step flow (arg parse → target validation → OS detect → symlink gate → Node 20 check → rules copy → install-apply delegation → settings.local template → .gitignore dedup → .kadmon-version write → post-install checklist).

## Common Pitfalls
- DB path: `~/.kadmon/kadmon.db` (NOT `data/harness.db`) — use `path.join(homedir(), '.kadmon', 'kadmon.db')`
- Sessions table uses `id` column (not `session_id`) — check with `PRAGMA table_info(sessions)`
- Auto-memory dir: `~/.claude/projects/C--Command-Center-Kadmon-Harness/` (hyphens, not spaces)
- Lifecycle hooks import from `dist/` — `ensure-dist.js` auto-rebuilds, but manual `npm run build` if needed
- Hook latency budgets are for logic only — Node.js cold start adds ~236ms on Windows
- ORDER BY needs `rowid` tiebreaker for deterministic results when timestamps collide
- Pattern evaluation rules live in `.claude/hooks/pattern-definitions.json` (authoritative count; ADR-006)
- `file_sequence` follow-up matching checks BOTH `Bash.metadata.command` AND `Skill.metadata.skillName` — slash commands like `/doks`, `/forge`, `/almanak` are Skill tool calls, not Bash. Editing this detector requires updating both branches.
- `npx tsx -e` produces no output on Windows — use temp script files
- `/evolve` Generate writes are transactional + project-root-bounded (see ADR-008 §Consequences)
- Sprint C Bug B fix: `startSession()` resume branch MUST call `clearSessionEndState(id)` before upserting, and MUST clear `merged.durationMs`, otherwise `COALESCE` restores the prior `ended_at`/`duration_ms` and produces the timestamp inversion.
- Skills live at `.claude/skills/<name>/SKILL.md` — subdirectory layout with literal uppercase `SKILL.md` (ADR-013, plan-013, 2026-04-14). Flat files like `.claude/skills/<name>.md` are invisible to the Claude Code skill loader. The `lint-agent-frontmatter.ts` linter (Check #8 of `/medik`) enforces this. `/evolve` step 6 Generate writes skill proposals at the new path via `buildTargetPath()`; commands/agents/rules stay flat.

## Status
v1.2.2 — latest shipped: Bug 3 (kompact.md cross-platform tmpdir via `node -e "require('os').tmpdir()"`) + Bug 4 (commit-format-guard.js strips quoted strings before matching `git commit`, eliminates `echo "...git commit..."` false-positives). Previous v1.2.1: Bug 1 (hook_events dedup via UNIQUE INDEX + ON CONFLICT DO NOTHING) + Bug 2 (orphan recovery staleness guard + endSession project_hash assert). All 4 bugs detected from Kadmon-Sports dogfood 2026-04-22.
Metrics: 887 tests / 71 files / 21 hooks / 16 agents / 46 skills / 11 commands / 19 rules / 7 DB tables.
Distribution: Claude Code plugin (agents/skills/commands/hooks via canonical root symlinks) + install.sh/install.ps1 (rules + 14 permissions.deny + 9 permissions.allow CORE + .kadmon-version). End-to-end dogfooded against Kadmon-Sports 2026-04-20 — cross-project SQLite isolation verified (distinct projectHash per directory). ADR-020 (runtime language detection) `accepted` 2026-04-22: Windows validation 2026-04-21 (architect; surfaced the 4 bugs shipped in v1.2.1/v1.2.2) + Mac validation 2026-04-22 (Joe/Eden running `/chekpoint` on Kadmon-Sports).
Language support: TypeScript and Python. `/chekpoint`, `/medik`, and 6 hooks detect the target project's toolchain at runtime via `scripts/lib/detect-project-language.ts` (ADR-020). Override with `KADMON_PROJECT_LANGUAGE=python|typescript`.
Experimental: `/evolve` Generate step 6 (sunset review 2026-04-28).
No known gaps — Bug #3 investigated 2026-04-21 and closed as non-bug: the "silent banner" was correct early-exit behavior when the target has no `git remote origin` (not plugin-specific; applies to any repo without remote). session-start.js now emits a visible log line on that path.
Shipping history lives in `docs/decisions/` and `git log`.
