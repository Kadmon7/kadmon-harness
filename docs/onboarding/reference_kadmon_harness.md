---
name: Kadmon Harness — commands, agents, skills, hooks catalog
description: How to use the Kadmon Harness Claude Code plugin in this project. 11 slash commands, 16 specialist agents, 46 skills, 21 auto-hooks, 19 convention rules. Invoke via commands or Task tool. Source of truth https://github.com/Kadmon7/kadmon-harness
type: reference
---

# Kadmon Harness v1.2.3 — quick reference

This project has the Kadmon Harness Claude Code plugin installed (and optionally the `install.sh` bootstrap for rules + permissions). This file tells Claude what's available and when to use each piece.

**Source of truth** — https://github.com/Kadmon7/kadmon-harness · Release v1.2.3 · MIT licensed. Refresh this file when the harness version bumps.

**What's new since v1.1:**
- **v1.2** — Python support (ADR-020): language-aware hooks branch on file extension (`.py` → ruff / mypy / print() warnings); python-reviewer auto-invokes on `.py` edits; Python rules at `.claude/rules/python/`.
- **v1.2.2** — CORE permissions bootstrap (ADR-021): 9 essential `permissions.allow` shipped via installer.
- **v1.2.3** — Install Health Telemetry (ADR-024) + Versioning Policy (ADR-025).
- **Tests:** 637 → 934 (+47%). Files: 60 → 75. Hooks / agents / skills / commands / rules counts unchanged.

## Mantra

**Observe → Remember → Verify → Specialize → Evolve.** Every session is observable (hooks), memorable (SQLite + auto-memory), verified (reviewers + tests), specialized (agents + skills), and self-improving (instincts + evolve).

## Principle — `no_context`

If no evidence exists in the codebase, conversation, or docs, respond `no_context` and flag what is missing. Never invent. Enforced by the `no-context-guard` hook which blocks edits without a prior Read.

---

## 11 slash commands — organized by phase

### Observe (2)
- `/nexus` — dashboard: instincts, sessions, costs, hook health.
- `/kompact` — smart context compaction with audit and safety checks. `/kompact audit` = audit only.

### Plan (1)
- `/abra-kdabra <task>` — sequential planning chain: arkitect (if architecture signals) → konstruct → feniks (if TDD) → kody. Produces ADRs + numbered plans in `docs/decisions/` + `docs/plans/`.

### Build (1)
- `/medik` — 8-health-check harness diagnostic + parallel mekanik/kurator analysis + repair. Alias: `/MediK`.

### Scan (1)
- `/skanner` — deep system assessment: arkonte (performance) + kartograf (E2E tests) in parallel.

### Research (1)
- `/skavenger <topic>` — multi-source deep research. Routes: A=Media (YouTube / Vimeo / etc. via yt-dlp), B=General (web / PDFs). Auto-writes reports to `docs/research/`.

### Remember (3)
- `/chekpoint` — tiered (full / lite / skip) verification + review + commit + push. Reviewers run in parallel.
- `/almanak <library>` — live docs via Context7 MCP. Use whenever referencing an unfamiliar API.
- `/doks` — 4-layer doc sync (CLAUDE.md, README, rules, agent metadata).

### Evolve (2)
- `/forge` — session observations → tempered instincts via unified preview-gated pipeline. Flags: `--dry-run`, `export`.
- `/evolve` — harness self-optimization. Step 6 Generate (EXPERIMENTAL through 2026-04-28) reads forge ClusterReports and proposes new skills / commands / agents / rules through an approval gate.

---

## 16 specialist agents — invoke by name

### Opus (5) — complex decisions
- **arkitect** — system design + ADRs. Triggered by `/abra-kdabra` with architecture signals.
- **konstruct** — breaks down tasks into ordered implementation steps. Always runs on `/abra-kdabra`.
- **spektr** — security detection (auth, SQL injection, path traversal, secrets). Auto-invokes on auth / keys / exec / paths / SQL edits.
- **alchemik** — evolution analysis (hook latency, instinct quality, skill gaps). Only via `/evolve`.
- **doks** — 4-layer doc sync. Triggered by `/doks`.

### Sonnet (11) — execution + review
- **kody** — lead code reviewer. Runs as `/chekpoint`'s consolidator.
- **typescript-reviewer** — TS / JS specialist. Auto-invokes on `.ts` / `.tsx` / `.js` / `.jsx` edits.
- **orakle** — SQL / Supabase specialist. Auto-invokes on SQL / schema / migration edits.
- **feniks** — TDD red-green-refactor enforcer. Triggered by `/abra-kdabra` when `needs_tdd: true`.
- **mekanik** — build error diagnoser. Auto-invokes on TS compile / Vitest failures. Ships in `/medik`.
- **kurator** — refactoring / dead code / duplication. Runs in `/medik clean`.
- **arkonte** — performance (O(n²), slow queries, memory patterns). Runs in `/skanner` + auto on perf patterns.
- **python-reviewer** — Python PEP 8 + type hints + security. Auto-invokes on `.py` edits.
- **almanak** — live docs lookup via Context7. Triggered by `/almanak`.
- **kartograf** — E2E testing (Playwright for web apps, Vitest for harness). Runs in `/skanner`.
- **skavenger** — multi-source deep research. Triggered by `/skavenger`.

---

## 46 skills — domain knowledge loaded by agents

Declared via each agent's `skills:` frontmatter as a YAML block list. Skills inject full content at sub-agent spawn; they are NOT inherited from parent session. Location: `.claude/skills/<name>/SKILL.md` (subdirectory + literal uppercase filename, per ADR-013).

- **Workflow**: search-first · context-budget · token-budget-advisor · strategic-compact
- **Quality**: coding-standards · tdd-workflow · verification-loop · e2e-testing · eval-harness · ai-regression-testing
- **Learning**: continuous-learning-v2
- **Architecture**: architecture-decision-records · api-design · hexagonal-architecture · docker-patterns
- **Data**: database-migrations · postgres-patterns · content-hash-cache-pattern
- **Integration**: claude-api · mcp-server-patterns · documentation-lookup
- **Meta**: skill-stocktake · agent-eval · agent-introspection-debugging · prompt-optimizer · skill-comply · rules-distill · workspace-surface-audit · codebase-onboarding
- **Python**: python-patterns · python-testing
- **Frontend**: frontend-patterns
- **Research**: deep-research
- **Docs**: docs-sync · code-tour
- **Cost / Perf**: cost-aware-llm-pipeline · benchmark
- **Security**: safety-guard · security-review · security-scan
- **Git / GitHub**: git-workflow · github-ops
- **Decision**: council · regex-vs-llm-structured-text
- **Other**: systematic-debugging · receiving-code-review

---

## 19 rules — auto-loaded based on file context

- **Common (9)**: agents · coding-style · development-workflow · git-workflow · hooks · patterns · performance · security · testing
- **TypeScript (5)** on `.ts` / `.tsx`: coding-style · hooks · patterns · security · testing
- **Python (5)** on `.py`: coding-style · hooks · patterns · security · testing

Rules live at `.claude/rules/common|typescript|python/*.md`. They encode MUST / SHOULD / NEVER conventions that kody and specialist reviewers enforce.

---

## 21 hooks — auto-fire on tool calls

### Block (exit 2) — 5
- `block-no-verify` (Bash) — blocks `--no-verify` / `--no-gpg-sign` in git.
- `commit-format-guard` (Bash) — blocks non-conventional commit messages.
- `commit-quality` (Bash) — scans staged for console.log / debugger / secrets.
- `config-protection` (Edit / Write) — protects critical config files.
- `no-context-guard` (Edit / Write) — blocks edits without a prior Read.

### Warn (exit 1) — 5
- `git-push-reminder` (Bash) — before `git push` without `/chekpoint`.
- `ts-review-reminder` (Edit) — after 10+ `.ts` edits without review.
- `console-log-warn` (Edit) — `console.log` in production code.
- `deps-change-reminder` (Edit) — reminds `/almanak` when `package.json` changes.
- `agent-metadata-sync` (Edit) — auto-syncs agent frontmatter to CLAUDE.md tables.

### Observe (exit 0) — 2
- `observe-pre`, `observe-post` — log every tool call / result to JSONL.

### Post-edit verification — 4
- `post-edit-format`, `post-edit-typecheck`, `quality-gate`, `pr-created`.

### Lifecycle — 3
- `session-start`, `session-end-all`, `pre-compact-save`.

### MCP — 2
- `mcp-health-check`, `mcp-health-failure`.

**Known gap (Sprint E)**: session-start banner is silent in plugin mode. Hooks still execute — only `console.log` output is suppressed. Verify with `/plugin` (Enabled means hooks run).

---

## When to use what — cheat sheet

| Situation | Use |
|---|---|
| Plan any complex task | `/abra-kdabra <task>` |
| Review code before commit | `/chekpoint` (full for production, lite for tests, skip for docs) |
| Look up library API | `/almanak <library>` |
| Research topic beyond the codebase | `/skavenger <topic>` |
| Build / typecheck fails | `/medik` or invoke `mekanik` |
| Design new system | `/abra-kdabra <design task>` — triggers `arkitect` first |
| Security-sensitive code | `spektr` auto-invokes (auth, SQL, paths, secrets) |
| Edit TypeScript | `typescript-reviewer` auto-invokes |
| Edit Python | `python-reviewer` auto-invokes |
| Session observations → patterns | `/forge` |
| Harness self-optimization | `/evolve` |
| Compact mid-session | `/kompact` (with audit first) |
| Sync docs after commits | `/doks` |

---

## Orchestration chain

Commands invoke agents via their `agent:` frontmatter. Agents load skills via their `skills:` frontmatter (YAML block list). Skills inject full content at sub-agent spawn.

- Skills: `.claude/skills/<name>/SKILL.md` (ADR-013)
- Agents: `.claude/agents/<name>.md` (ADR-017 — derive from `_TEMPLATE.md.example`)
- Commands: `.claude/commands/<name>.md`
- Rules: `.claude/rules/common|typescript|python/<name>.md`

---

## Memory system

4 memory types, all in `~/.claude/projects/<project>/memory/`:
- **user** — role, goals, responsibilities, knowledge
- **feedback** — guidance on how to work (corrections + validated patterns)
- **project** — ongoing work context; absolute dates always
- **reference** — pointers to external resources (this file is one)

Each memory file has YAML frontmatter (`name`, `description`, `type`). The `MEMORY.md` index is the load manifest — one line per memory file, max ~200 lines total.

---

## Distribution architecture

- **Plugin** ships agents / skills / commands / hooks via canonical root symlinks in the harness repo (`agents`, `skills`, `commands` → `.claude/<type>/`). Registered in `~/.claude/settings.json` as `extraKnownMarketplaces` + `enabledPlugins`.
- **Bootstrap** (`install.sh` / `install.ps1`) ships rules + `permissions.deny` + `.kadmon-version` + `.gitignore` entries. Run once per project — these two categories cannot be distributed via Claude Code plugins today.
- ADR references: ADR-010 (hybrid distribution), ADR-013 (skills subdirectory), ADR-017 (agent template), ADR-019 (canonical root symlinks), ADR-020 (Python language support), ADR-021 (CORE permissions bootstrap), ADR-024 (install health telemetry), ADR-025 (versioning policy).

---

## Refresh cadence

Update this file when:
- Harness minor / major version bumps (v1.1 → v1.2 → v2.0)
- Component counts change (new agents / skills / commands / hooks)
- Orchestration patterns change (new trigger rules, new chain)

Do NOT refresh for bugfixes or rule edits — those drift gracefully.
