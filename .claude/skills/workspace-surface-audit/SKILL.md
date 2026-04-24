---
name: workspace-surface-audit
description: Audit the active repo, MCP servers, plugins, connectors, env surfaces, and harness setup, then recommend the highest-value additions (skills, hooks, agents, operator workflows) based on what already exists and what's missing. Use this skill whenever the user asks "set up Claude Code", "what should I install", "what plugins or MCPs do I need", "audit my workspace", "what am I missing", "how is this repo configured", or before adding more skills/hooks/connectors. Read-only — does not modify anything unless the user explicitly asks for follow-up implementation.
---

# Workspace Surface Audit

Read-only audit skill that answers: **"what can this workspace and machine actually do right now, and what should we add next?"**

This is the harness-native answer to setup-audit plugins. It does not modify files unless the user explicitly asks for follow-up implementation.

## When to Use

- User says "set up Claude Code", "recommend automations", "what should I install", "what am I missing"
- Auditing a machine or repo before adding more skills, hooks, or connectors
- Comparing available plugins against harness-native coverage
- Reviewing `.env`, `.mcp.json`, plugin settings, or connected-app surfaces to find missing workflow layers
- Deciding whether a capability should be a skill, hook, agent, MCP, or external connector

## Non-Negotiable Rules

- **Never print secret values.** Surface only provider names, capability names, file paths, and whether a key or config exists.
- Prefer harness-native workflows over generic "install another plugin" advice when the harness can reasonably own the surface.
- Treat external plugins as benchmarks and inspiration, not authoritative product boundaries.
- Separate three things clearly:
  - **available now** — already usable
  - **primitive-only** — capability exists but harness lacks a clean operator skill
  - **missing** — not available; would require a new integration

## Audit Inputs

Inspect only the files and settings needed to answer well:

### 1. Repo Surface
- `package.json`, lockfiles, language markers (`tsconfig.json`, `pyproject.toml`), framework config, `README.md`
- `.mcp.json`, `.claude/settings.json`, `.claude/settings.local.json`
- `CLAUDE.md`, install manifests, hook configs in `.claude/hooks/scripts/`

### 2. Environment Surface
- `.env*` files in the active repo and obvious adjacent workspaces
- Surface only **key names** like `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` — never values

### 3. Connected Tool Surface
- Installed plugins (`.claude/plugins/` or configured in settings)
- Enabled MCP servers (from `.mcp.json`)
- Active LSP servers
- CLI tools available on PATH (`gh`, `npm`, `npx`, `git`, etc.)

### 4. Harness Surface
- Existing agents in `.claude/agents/` (count and names)
- Existing skills in `.claude/skills/` (count and names)
- Existing commands in `.claude/commands/`
- Existing hooks (scripts + `settings.json` registration)
- Existing rules in `.claude/rules/`

## Audit Process

### Phase 1 — Inventory What Exists

Produce a compact inventory:

```
- Harness targets: Claude Code CLI (primary), Windows Git Bash shell
- Installed plugins: frontend-design, ralph-loop, skill-creator, context7
- MCP servers: context7 (active), supabase (disabled v2)
- CLI tools: gh (authenticated as Kadmon7), npm, npx, git
- Env surfaces (keys detected, values not shown):
  - ANTHROPIC_API_KEY
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (disabled)
- Harness: N agents, M skills, K commands, H hooks, R rules (count at audit time — do not hardcode)
```

If a surface exists only as a primitive, call that out:

- "Supabase env is set but Supabase MCP is disabled — no operator workflow available"
- "`gh` CLI is authenticated but there's no dedicated PR-triage skill"

### Phase 2 — Benchmark Against Available Surfaces

For each comparison point, answer:

1. What it actually does
2. Whether the harness already has **parity**
3. Whether the harness only has **primitives**
4. Whether the harness is **missing the workflow entirely**

Do not just list plugin names — evaluate their workflow coverage.

### Phase 3 — Turn Gaps Into Harness Decisions

For every real gap, recommend the correct harness-native shape:

| Gap type | Preferred shape |
|---|---|
| Repeatable operator workflow | **Skill** (loaded by agent or command) |
| Automatic enforcement or side-effect | **Hook** |
| Specialized delegated role | **Agent** |
| External tool bridge | **MCP server** or `gh`-style CLI wrapper |
| Install/bootstrap guidance | **Setup or audit skill** |

Default to user-facing skills that orchestrate existing tools when the need is operational rather than infrastructural.

## Output Format

Return five sections in this exact order:

### 1. Current Surface
What is already usable right now. Focus on workflow capabilities, not brand names.

### 2. Parity
Where the harness already matches or exceeds a benchmark (e.g., the 46 skills cover most common TS/Python patterns; the 22 hooks cover security, quality, and observability).

### 3. Primitive-Only Gaps
Tools exist but the harness lacks a clean operator skill:
- "`gh` is authenticated, but there's no dedicated PR-triage skill"
- "Supabase env is set, but no Supabase MCP wrapper skill"

### 4. Missing Integrations
Capability not available yet:
- "No observability dashboard — metrics live in the dashboard script but there's no Grafana/SigNoz wiring"
- "No cost-budgeting guardrail — cost-calculator estimates but no alerting"

### 5. Top 3-5 Next Moves
Concrete harness-native additions, ordered by impact. Each move states:
- What to add (skill / hook / agent / MCP)
- Which gap it closes
- Rough effort (S / M / L)

## Recommendation Rules

- Recommend at most **1-2 highest-value ideas per category**.
- Favor skills with obvious user intent and business value:
  - Setup / onboarding audit
  - Deployment / ops control
  - Observability / monitoring
  - Security / compliance gates
- If the harness already has a strong primitive, propose a **wrapper skill** instead of inventing a brand-new subsystem.
- If a connector is project-specific (Supabase for ToratNetz, ElevenLabs for KAIRON), recommend it only when it genuinely fits the workflow.

## Good Outcomes

- The user can **immediately see** what is connected, what is missing, and what the harness should own next.
- Recommendations are specific enough to **implement without another discovery pass**.
- The final answer is organized around **workflows**, not API brands.

## Integration

- **alchemik agent** (opus) — primary owner. alchemik uses this skill when `/evolve` needs a full environmental snapshot before proposing harness improvements. The audit is alchemik's eyes — without it, evolution proposals are blind.
- **/evolve command** — natural entry point for periodic workspace audits.
- **/medik command** — complementary. `/medik` audits harness health (build, hooks, DB); this skill audits workspace coverage (what capabilities exist vs what's needed).
- **Related skills**: `codebase-onboarding` answers "how does this repo work"; `workspace-surface-audit` answers "what can this environment do". Both are Phase 0 skills for bootstrap work.

## no_context Application

Every item in the report must rest on observable evidence: the file exists, the tool is on PATH, the env key is set, the MCP server responds. A recommendation that cites a capability must be able to point to where that capability is already available or confirm it is absent. "You might want an X" without checking is not audit — it is wishlist. The `no_context` principle demands that every claim in the inventory be traceable to a file, a command, or a real setting.
