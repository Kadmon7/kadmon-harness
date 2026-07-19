---
name: Kadmon Harness — commands, agents, skills, hooks catalog
description: How to use the Kadmon Harness Claude Code plugin in this project. 12 slash commands, 16 specialist agents, 53 skills, 23 auto-hooks + 12 shared modules, 19 convention rules. Invoke via commands or Task tool. Source of truth https://github.com/Kadmon7/kadmon-harness
type: reference
---

# Kadmon Harness v1.5.0 — quick reference

This project has the Kadmon Harness Claude Code plugin installed (and optionally the `install.sh` bootstrap for rules + permissions). This file tells Claude what's available and when to use each piece.

**Source of truth** — https://github.com/Kadmon7/kadmon-harness · Release v1.5.0 · MIT licensed. Refresh this file when the harness version bumps.

**What's new since v1.1:**
- **v1.2** — Python support (ADR-020): language-aware hooks branch on file extension (`.py` → ruff / mypy / print() warnings); python-reviewer auto-invokes on `.py` edits; Python rules at `.claude/rules/python/`.
- **v1.2.2** — CORE permissions bootstrap (ADR-021): 9 essential `permissions.allow` shipped via installer.
- **v1.2.3** — Install Health Telemetry (ADR-024) + Versioning Policy (ADR-025).
- **v1.3.0** — `/medik` expansion 9→14 checks (ADR-028, ADR-029): 5 new health checks (stale-plans, hook-health-24h, instinct-decay-candidates, skill-creator-probe, capability-alignment). `/medik --ALV` diagnostic export with cross-platform path redaction. Typed install-diagnostic reader + `_v: 1` schema. Graphify adoption (ADR-026, Sprint E PASS at 8.11× token reduction). Python SAST hook (ADR-027): `post-edit-security` runs `bandit -ll` on `.py` edits. **Cross-project stack 11/11**: `/skanner` profile-aware (ADR-031), `/doks` per-layer eligibility (ADR-032 + Amendment 2026-04-26 — rules out of scope universally; layers collapsed 4→3), `/medik` cwd-target-existence (ADR-033), `/chekpoint` diff-scope-aware via `getDiffScope()` (ADR-034). Catalogs split (ADR-035): `.claude/{agents,hooks,commands}/CATALOG.md` non-auto-loaded, ~11k tokens/turn saved. `agent-authoring` + `hook-authoring` skills extracted from rules as on-demand reference (skills 46→48). `/evolve` step 6 Generate promoted EXPERIMENTAL → accepted 2026-04-24.
- **v1.4.0** — `/release` command (ADR-037, commands 11→12): one human-invoked run for version bump + CHANGELOG consolidation + BACKLOG prune + status-flip proposals + annotated tag, no-push by default. `/medik` consumer-safety via `scripts/lib/medik-checks-cli.ts` — checks #10-14 now reachable from consumer repos with a real `projectHash`, no more false FAILs (checks 14→16 with docs-status-lint + graphify-health). Audit Wave 2/3 hardening: the 4 blocking security hooks fail **closed** on stdin-parse failure, `session_id` path traversal hardened via the shared `safe-session-dir` module, toolchain hooks resolve binaries directly. New `fable-prompt` skill.
- **v1.5.0** — **Kadmon OS web dashboard** (plan-039): `npm run dashboard:web` serves a local read-only view on `127.0.0.1` (port via `KADMON_DASHBOARD_PORT`) showing a live disk-read catalog plus SQLite telemetry — instincts, sessions and orphans, cost events, hook latency vs budget, agent usage. `/release` **upgrade-advisory** phase (ADR-037 D7) classifies the release diff into ADR-010 distribution territories and prints the exact commands consumers run to pull it (`/plugin update` vs installer re-run vs re-drop this catalog). New `hebrew-native-copy` skill. **BREAKING**: the `kryo` skill is renamed `kontinuum` — the old slug resolves nowhere, so update any consumer reference.
- **Tests:** 637 → 1493. Files: 60 → 111. Hooks: 21 → 23 (22 plugin-shipped script hooks + 1 inline graphify nudge) + 12 shared modules. /medik checks: 8 → 16. Skills: 46 → 53. Commands: 11 → 12.

## Mantra

**Observe → Remember → Verify → Specialize → Evolve.** Every session is observable (hooks), memorable (SQLite + auto-memory), verified (reviewers + tests), specialized (agents + skills), and self-improving (instincts + evolve).

## Principle — `no_context`

If no evidence exists in the codebase, conversation, or docs, respond `no_context` and flag what is missing. Never invent. Enforced by the `no-context-guard` hook which blocks edits without a prior Read.

---

## 12 slash commands — organized by phase

### Observe (2)
- `/nexus` — dashboard: instincts, sessions, costs, hook health.
- `/kompact` — smart context compaction with audit and safety checks. `/kompact audit` = audit only.

### Plan (1)
- `/abra-kdabra <task>` — sequential planning chain: arkitect (if architecture signals) → konstruct → feniks (if TDD) → kody. Produces ADRs + numbered plans in `docs/decisions/` + `docs/plans/`.

### Build (1)
- `/medik` — 14-health-check harness diagnostic + parallel mekanik/kurator analysis + repair. Alias: `/MediK`. `--ALV` flag exports a redacted diagnostic bundle.

### Scan (1)
- `/skanner` — deep system assessment: arkonte (performance) + kartograf (E2E tests) in parallel.

### Research (1)
- `/skavenger <topic>` — multi-source deep research. Routes: A=Media (YouTube / Vimeo / etc. via yt-dlp), B=General (web / PDFs). Auto-writes reports to `docs/research/`.

### Remember (3)
- `/chekpoint` — tiered (full / lite / skip) verification + review + commit + push. Reviewers run in parallel.
- `/almanak <library>` — live docs via Context7 MCP. Use whenever referencing an unfamiliar API.
- `/doks` — 3-layer doc sync (CLAUDE.md/README, commands, skills+agents). Rules out of scope (ADR-032 Amendment 2026-04-26 — hand-curated via deliberate ADR; auto-edit caused silent drift per research-008).

### Evolve (2)
- `/forge` — session observations → tempered instincts via unified preview-gated pipeline. Flags: `--dry-run`, `export`.
- `/evolve` — `cwd`-aware self-optimization (writes proposals to `{cwd}/.claude/{type}/{slug}.md`). Step 6 Generate (accepted 2026-04-24, was EXPERIMENTAL) reads forge ClusterReports and proposes new skills / commands / agents / rules through an approval gate.

### Release (1)
- `/release` — cut a release: version bump + CHANGELOG consolidation + BACKLOG prune + status-flip proposals + annotated tag, composing `/doks` for count sync. Human-invoked, no-push default.

---

## 16 specialist agents — invoke by name

### Opus (5) — complex decisions
- **arkitect** — system design + ADRs. Triggered by `/abra-kdabra` with architecture signals.
- **konstruct** — breaks down tasks into ordered implementation steps. Always runs on `/abra-kdabra`.
- **spektr** — security detection (auth, SQL injection, path traversal, secrets). Auto-invokes on auth / keys / exec / paths / SQL edits.
- **alchemik** — evolution analysis (hook latency, instinct quality, skill gaps). Only via `/evolve`.
- **doks** — 3-layer doc sync (public docs / commands / skills+agents; rules out of scope). Triggered by `/doks`.

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

## 53 skills — domain knowledge loaded by agents

Declared via each agent's `skills:` frontmatter as a YAML block list. Skills inject full content at sub-agent spawn; they are NOT inherited from parent session. Location: `.claude/skills/<name>/SKILL.md` (subdirectory + literal uppercase filename, per ADR-013).

- **Workflow**: search-first · context-budget · token-budget-advisor · strategic-compact · kontinuum · sprint
- **Quality**: coding-standards · tdd-workflow · verification-loop · e2e-testing · eval-harness · ai-regression-testing · receiving-code-review · systematic-debugging
- **Learning**: continuous-learning-v2
- **Architecture**: architecture-decision-records · api-design · hexagonal-architecture · docker-patterns
- **Data**: database-migrations · postgres-patterns · content-hash-cache-pattern
- **Integration**: claude-api · mcp-server-patterns · documentation-lookup
- **Meta**: skill-stocktake · agent-eval · agent-introspection-debugging · prompt-optimizer · skill-comply · rules-distill · workspace-surface-audit · codebase-onboarding · **agent-authoring** · **hook-authoring** · **fable-prompt**
- **Python**: python-patterns · python-testing
- **Frontend**: frontend-patterns
- **Research**: deep-research
- **Docs / Copy**: docs-sync · code-tour · copy-deslop · hebrew-native-copy
- **Cost / Perf**: cost-aware-llm-pipeline · benchmark · regex-vs-llm-structured-text
- **Security**: safety-guard · security-review · security-scan
- **Git / GitHub**: git-workflow · github-ops
- **Decision-making**: council

`agent-authoring` + `hook-authoring` (added 2026-04-26 per ADR-035 companion split): on-demand deep-mechanics reference for agent template contract and hook plugin-mode runtime resolution. Loaded only when relevant (creating/editing agent, lifecycle hook edits, KADMON_RUNTIME_ROOT debug). Companion to `_TEMPLATE.md.example` (scaffold) — skill is the encyclopedia, template is the blank form.

`fable-prompt` (added 2026-07-06): operator-facing prompt-authoring skill for big autonomous / long-running / creative Claude Fable 5 runs — interview → synthesize → present, applying Matt Shumer's method (goal-not-steps, house rules, concrete self-checkable done-bar, fresh-context adversarial verification, loop-until-bar, effort selection; ultracode = foundations only). Method knowledge base bundled verbatim as `references/method.md`. Benchmarked at ship: with-skill 14/14 assertions vs 4/14 baseline (2 scenarios). De-dups against the harness: does NOT recommend the method's memory/progress-verification blocks inside harness-managed sessions.

---

## 19 rules — auto-loaded based on file context

- **Common (9)**: agents · coding-style · development-workflow · git-workflow · hooks · patterns · performance · security · testing
- **TypeScript (5)** on `.ts` / `.tsx`: coding-style · hooks · patterns · security · testing
- **Python (5)** on `.py`: coding-style · hooks · patterns · security · testing

Rules live at `.claude/rules/common|typescript|python/*.md`. They encode MUST / SHOULD / NEVER conventions that kody and specialist reviewers enforce.

---

## 22 hooks — auto-fire on tool calls

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

### Post-edit verification — 5
- `post-edit-format`, `post-edit-typecheck` (language-aware: tsc for `.ts`, mypy/pyright for `.py`), `quality-gate` (ESLint for `.ts`, ruff for `.py`), `post-edit-security` (Python SAST via bandit, ADR-027), `pr-created`.

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
- ADR references: ADR-010 (hybrid distribution), ADR-013 (skills subdirectory), ADR-017 (agent template), ADR-019 (canonical root symlinks), ADR-020 (Python language support), ADR-021 (CORE permissions bootstrap), ADR-024 (install health telemetry), ADR-025 (versioning policy), ADR-026 (graphify adoption), ADR-027 (Python bandit SAST hook), ADR-028/029 (medik 9→14 checks + capability-alignment), ADR-031 (project-agnostic /skanner), ADR-032 + Amendment 2026-04-26 (project-agnostic /doks, rules out-of-scope), ADR-033 (project-agnostic /medik), ADR-034 (chekpoint diff-scope-aware), ADR-035 (rules/catalogs split).

---

## Refresh cadence

Update this file when:
- Harness minor / major version bumps (v1.1 → v1.2 → v2.0)
- Component counts change (new agents / skills / commands / hooks)
- Orchestration patterns change (new trigger rules, new chain)

Do NOT refresh for bugfixes or rule edits — those drift gracefully.
