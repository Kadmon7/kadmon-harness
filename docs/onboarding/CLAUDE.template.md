<!--
  Kadmon Harness — CLAUDE.md template

  Two-step onboarding for a new project that consumes the harness:

    1. Copy this file to <project-root>/CLAUDE.md and fill the sections
       marked [project-specific].

    2. Copy `docs/onboarding/reference_kadmon_harness.md` from the
       Kadmon-Harness repo into the project's memory dir:
         ~/.claude/projects/<project-slug>/memory/reference_kadmon_harness.md

       That file is the authoritative harness catalog (16 agents, 11 commands,
       46 skills, 22 hooks, 19 rules + orchestration chain + cheat sheet).
       Claude auto-loads it every session. Refresh it when the harness
       version bumps.

  Filename note: this file is `CLAUDE.template.md` (not `CLAUDE.md`) so
  Claude Code does NOT auto-load the template as the active CLAUDE.md.
-->

# CLAUDE.md — <ProjectName>

> User-level config at `~/.claude/CLAUDE.md` (identity, language, environment)

## Project Overview [project-specific]

<One-paragraph mission statement: what this project is, who it serves, and why. 2-3 sentences.>

## Quick Start [project-specific]
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

## Stack [project-specific]
- Language: <primary language + version — e.g. TypeScript 5.6 / Node 20>
- Persistence: <database + location — e.g. SQLite at ~/.kadmon/kadmon.db, Supabase postgres>
- Runtime: <where this runs — e.g. Claude Code CLI on Windows Git Bash, React Native on iOS/Android>
- MCPs: <active MCPs or "none">
- GitHub: <gh CLI + remote identity or "none">
- File size: < 200 lines preferred, 400 normal max, 800 hard limit (refactor required)

## File Structure [project-specific]

```
<project-root>/
|-- .claude/                    # Harness components (inherited via install.sh)
|   |-- rules/                  # Auto-loaded rules
|   `-- settings.json
|-- <src-dir>/                  # <purpose — e.g. src/, app/, lib/>
|-- <tests-dir>/                # <purpose — e.g. tests/, __tests__/>
|-- docs/
|   |-- decisions/              # ADRs
|   `-- plans/                  # Implementation plans
|-- CLAUDE.md                   # This file
`-- <manifest>                  # e.g. package.json, pyproject.toml, Cargo.toml
```

## Environment Variables [project-specific]
- `<ENV_VAR_NAME>` — <one-line description of what it controls and default>
<!-- Add one line per project-specific env var. Point to an ADR for details. -->

## Settings Hierarchy (3 tiers, merged additively — Managed → User → Project → Local)
- `~/.claude/settings.json` — **User global**. Machine-specific permissions across all projects. Not committed.
- `.claude/settings.json` — **Project team-shared**. Hooks + `permissions.allow`. Committed.
- `.claude/settings.local.json` — **Project personal**. Gitignored; machine-specific overrides only.

## Harness Components

This project consumes Kadmon Harness — **16 agents, 11 commands, 46 skills, 22 hooks, 19 rules**. The full catalog, orchestration chain, trigger rules, and cheat sheet live in:

`~/.claude/projects/<project-slug>/memory/reference_kadmon_harness.md`

Claude auto-loads that file every session. Source of truth: `Kadmon-Harness/docs/onboarding/reference_kadmon_harness.md`.

**First-run issues?** See `Kadmon-Harness/docs/onboarding/TROUBLESHOOTING.md` for the 3 known install bugs (symlinks as text files on Windows, `PreToolUse:Agent hook error`, `/reload-plugins` required post-install) with copy-paste remediation. `/medik` Check #9 (ADR-024) is the fastest triage — it reports canonical symlink state + dist/ + runtime env and suggests the matching fix.

## External Tools [project-specific — extend with anything beyond the harness defaults]

| Type | Name | Use |
|---|---|---|
| Plugin | `skill-creator:skill-creator` | All skill work |
| Plugin | `context7` | Live library docs (via `/almanak`) |
| MCP | Context7 | Active |
| CLI | `gh` | GitHub (PRs, issues) |
| CLI | <runtime CLI — e.g. `node`/`npm`/`npx`, `python`/`uv`> | Runtime, packages |
| CLI | `git` | Version control |

## Memory [project-specific for SQLite tables, rest is harness default]
- **SQLite**: <project-specific tables if any> at `~/.kadmon/kadmon.db`
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: `~/.claude/projects/<project-slug>/memory/` (types: user, feedback, project, reference)
- **AutoDream**: consolidates every 24h/5+ sessions
- **MEMORY.md**: index file, max 200 lines

## Distribution [project-specific]

<How does this project ship? Examples: npm package, Claude Code plugin, Docker image, SaaS deployment, internal only. Include install entry point.>

## Common Pitfalls [project-specific]
- <Add gotchas as you discover them — DB path quirks, env-var edge cases, platform-specific issues>
<!-- Aim for 5-10 evergreen pitfalls. Move resolved bugs to docs/decisions/ or git log. -->

<!-- Status: max 4 líneas. Narrativa de bugs/releases vive en git log + docs/decisions/ -->
## Status [project-specific]
<version> — <metrics one-liner: e.g. tests / files / modules>
<distribution or deployment state>
<experimental flags or deprecations with review dates>
Shipping history: `docs/decisions/` and `git log`.
