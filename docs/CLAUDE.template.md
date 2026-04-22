<!--
  CLAUDE.md template — Kadmon Harness convention

  Usage:
    1. Copy this file to <project-root>/CLAUDE.md
    2. Replace <placeholders> with project-specific values
    3. Sections marked [harness-inherited] can stay as-is if the project consumes
       Kadmon-Harness; trim or replace them otherwise

  Filename note: this file is `CLAUDE.template.md` (not `CLAUDE.md`) so Claude
  Code does NOT auto-load it as the active CLAUDE.md for any session.
-->

# CLAUDE.md — <ProjectName>

> User-level config at `~/.claude/CLAUDE.md` (identity, language, environment)

## Project Overview

<One-paragraph mission statement: what this project is, who it serves, and why it exists. 2-3 sentences.>

## Quick Start
```bash
<install command — e.g. npm install, poetry install, uv sync>
<build or run command — e.g. npm run build, python -m app>
<test command — e.g. npx vitest run, pytest>
```

## Core Principle
no_context — if no evidence exists, respond `no_context` and flag what is missing. Enforced by `no-context-guard` hook.

Mantra: Observe -> Remember -> Verify -> Specialize -> Evolve

## Self-Improvement Loop (mid-session)

Commit-time learning runs via `/forge` + `/evolve`. This loop is for **immediate in-session reaction**:

- **On correction** ("no así", "esto estuvo mal"): write to auto-memory (`feedback` type) BEFORE the next tool call.
- **On validation** ("sí, perfecto, sigue así" or acceptance of a non-obvious choice): save as positive feedback memory — `/forge` biases toward failures, capture successes manually.
- **On déjà-vu**: stop, read `memory/feedback_*.md` + `memory/project_*.md` before proceeding.

See `continuous-learning-v2` skill and `~/.claude/projects/<project>/memory/MEMORY.md`.

## Stack
- Language: <primary language + version — e.g. TypeScript 5.6 / Node 20>
- Persistence: <database + location — e.g. SQLite at ~/.kadmon/kadmon.db, Supabase postgres, pgvector>
- Runtime: <where this runs — e.g. Claude Code CLI on Windows Git Bash, React Native on iOS/Android>
- MCPs: <active MCPs or "none">
- GitHub: <gh CLI + remote identity or "none">
- File size: < 200 lines preferred, 400 normal max, 800 hard limit (refactor required)

## File Structure

```
<project-root>/
|-- .claude/                    # Harness components (inherited via install.sh)
|   |-- rules/                  # Auto-loaded rules
|   |-- hooks/scripts/          # Hook scripts
|   `-- settings.json
|-- <src-dir>/                  # <purpose — e.g. src/, app/, lib/>
|-- <tests-dir>/                # <purpose — e.g. tests/, __tests__/>
|-- docs/
|   |-- decisions/              # ADRs
|   `-- plans/                  # Implementation plans
|-- CLAUDE.md                   # This file
`-- <manifest>                  # e.g. package.json, pyproject.toml, Cargo.toml
```

## Environment Variables
- `<ENV_VAR_NAME>` — <one-line description of what it controls and default>
<!-- Add one line per project-specific env var. Keep each to one line; point to an ADR for details. -->

## Settings Hierarchy (3 tiers, merged additively — Managed → User → Project → Local)
- `~/.claude/settings.json` — **User global**. Machine-specific permissions that apply across all your projects. Not committed.
- `.claude/settings.json` — **Project team-shared**. Hooks + `permissions.allow` (generic tools). Committed.
- `.claude/settings.local.json` — **Project personal**. Gitignored; machine-specific overrides only.

## Agents (16) [harness-inherited]
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

Full routing + skill chains at `.claude/rules/common/agents.md`. Chain: `arkitect → konstruct → feniks (if TDD) → kody`.

## Commands (11) [harness-inherited]
- **Observe** (2): /kadmon-harness, /kompact
- **Plan** (1): /abra-kdabra
- **Build** (1): /medik (alias /MediK)
- **Scan** (1): /skanner
- **Research** (1): /skavenger (routes A=Media / B=General — see skavenger agent doc)
- **Remember** (3): /chekpoint, /almanak, /doks
- **Evolve** (2): /forge, /evolve

## Skills (46) [harness-inherited]

Catalog at `.claude/skills/` — each at `<name>/SKILL.md` (ADR-013). Clusters: workflow, quality, learning, architecture, data, integration, meta, python, frontend, research, docs, cost/perf, security, git, decision-making. Drift audit via `/medik` Check #8.

## External Tools

| Type | Name | Use |
|---|---|---|
| Plugin | `skill-creator:skill-creator` | REQUIRED for all skill work (create/edit/evaluate) |
| Plugin | `context7` | Live library docs (via `almanak` / `/almanak`) |
| Plugin | `frontend-design:frontend-design` | Production-grade frontend interfaces |
| Plugin | `ralph-loop:ralph-loop` | Recurring execution loops |
| MCP | Context7 | Active — used by almanak, deep-research |
| CLI | `gh` | GitHub (PRs, issues) — no MCP needed |
| CLI | <runtime CLI — e.g. `node`/`npm`/`npx`, `python`/`pip`/`uv`> | Runtime, packages |
| CLI | `git` | Version control |

## Rules [harness-inherited]

19 rules organized by scope in `.claude/rules/`:
- `common/` — coding-style, security, testing, patterns, performance, git-workflow, development-workflow, agents, hooks
- `typescript/` — ts-specific coding-style, patterns, security, testing, hooks
- `python/` — py-specific coding-style, patterns, security, testing, hooks

Rules auto-load based on file context. See `.claude/rules/common/agents.md` for agent orchestration rules.

## Hooks [harness-inherited]
21 registered hooks + 8 shared modules in `.claude/hooks/scripts/`. See `rules/common/hooks.md` for catalog.

## Memory
- **SQLite**: <project-specific tables if any> at `~/.kadmon/kadmon.db`
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project>/memory/` with 4 types: user, feedback, project, reference
- **AutoDream**: consolidates memory every 24h/5+ sessions
- **MEMORY.md**: index file (max 200 lines)

## Distribution

<How does this project ship? Examples: npm package, Claude Code plugin, Docker image, SaaS deployment, internal only. Include the install entry point (install.sh, pip install, docker run, etc.).>

## Common Pitfalls
- <Add gotchas as you discover them — DB path quirks, env-var edge cases, platform-specific issues, naming conventions that bit you once>
<!-- Aim for 5-10 evergreen pitfalls. Move project-historical ones (resolved bugs) to docs/decisions/ or git log. -->

<!-- Status: max 4 líneas. Narrativa de bugs/releases vive en git log + docs/decisions/ -->
## Status
<version> — <metrics one-liner: e.g. tests / files / modules>
<distribution or deployment state — e.g. deployed to staging, shipped to npm, internal only>
<experimental flags or deprecations with review dates>
Shipping history: `docs/decisions/` and `git log`.
