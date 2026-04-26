# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

[![Tests](https://img.shields.io/badge/tests-1069%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.3.0-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)]()
[![Node](https://img.shields.io/badge/Node-20%2B-339933)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

---

## What is this?

Kadmon Harness is **infrastructure, not a product**. It is a portable set of agents, commands, skills, hooks, and rules that encode how Claude Code should work on any TypeScript or Python project. Built once, carried to every new project via bootstrap. It turns every session into an observable, memorable, self-improving loop.

> **Language support today**: TypeScript/JavaScript and Python.

Instead of asking Claude "please write a test first", you define it in a rule, a hook enforces it, and an agent specializes in it. The next session already knows.

---

## 🎯 Mantra

**Observe → Remember → Verify → Specialize → Evolve**

| Phase | What It Does | Key Components |
|-------|-------------|----------------|
| **Observe** | Watch every tool call, manage context | observe hooks, `/kompact audit`, `/nexus` |
| **Remember** | Persist sessions, track learned patterns | SQLite, instinct engine, `/chekpoint` |
| **Verify** | Tests first, code review, quality gates | `/skanner`, `/chekpoint` |
| **Specialize** | Domain agents, curated skill catalog | 16 agents, 46 skills, `/abra-kdabra` |
| **Evolve** | Forge observations into instincts, generate artifacts | `/forge`, `/evolve` (step 6 Generate EXPERIMENTAL through 2026-04-28) |

---

## 🚀 Install — 5 steps to install everything

**Steps 1–3** install the plugin (agents, skills, commands, hooks — 80 %).
**Steps 4–5** bootstrap the rules and security permissions (the 20 % Claude Code plugins can't ship: **19 rules**, **14 `permissions.deny`**, **9 `permissions.allow` CORE**).

### Steps 1–3 · Install the plugin

Open a Claude Code session in any project and run each on its own line:

**Step 1 — Register the marketplace**
```
/plugin marketplace add https://github.com/Kadmon7/kadmon-harness.git
```

**Step 2 — Install the plugin**
```
/plugin install kadmon-harness@kadmon-harness
```

**Step 3 — Reload to activate**
```
/reload-plugins
```

Run `/plugin` and you'll see **kadmon-harness Enabled** with **16 agents · 46 skills · 11 commands · 22 hooks** live in the session.

### Steps 4–5 · Bootstrap rules + permissions

Pick your OS:

<details>
<summary><strong>🍎 macOS / 🐧 Linux · bash</strong></summary>

**Step 4 — Clone and build the harness** _(once per machine)_
```bash
git clone https://github.com/Kadmon7/kadmon-harness.git ~/projects/kadmon-harness
cd ~/projects/kadmon-harness
npm install && npm run build
```

**Step 5 — Run the installer for your project** _(once per project · re-run to update)_
```bash
./install.sh /path/to/your/project
```

Dry-run first: `./install.sh --dry-run /path/to/your/project`

**Updating the harness later**:
```bash
cd ~/projects/kadmon-harness && git pull && npm install && npm run build   # refresh clone
./install.sh /path/to/your/project                                         # re-apply per project
```

</details>

<details>
<summary><strong>🪟 Windows · PowerShell</strong></summary>

**One-time machine setup** (symlinks won't resolve without this):

1. Settings → Privacy & Security → For Developers → **Developer Mode: ON**
2. In any terminal: `git config --global core.symlinks true`

**Step 4 — Clone and build the harness** _(once per machine)_
```powershell
cd C:\projects
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install; npm run build
```

**Step 5 — Run the installer for your project** _(once per project · re-run to update)_
```powershell
.\install.ps1 -TargetPath C:\path\to\your\project
```

Dry-run first: `.\install.ps1 -TargetPath C:\path\to\your\project -DryRun`

**Updating the harness later**:
```powershell
cd C:\projects\kadmon-harness; git pull; npm install; npm run build   # refresh clone
.\install.ps1 -TargetPath C:\path\to\your\project                     # re-apply per project
```

</details>

<details>
<summary>🔍 <strong>What the installer does</strong> · 11 deterministic steps</summary>

| # | Action | Why |
|---|---|---|
| 1 | Parse args `<target>` + flags (`--dry-run`, `--force-permissions-sync`) | Flexibility |
| 2 | Validate target is a writable directory and isn't the harness repo itself | Safety |
| 3 | Detect OS (linux / darwin / gitbash / windows) | Error messaging |
| 4 | Verify the 3 canonical root symlinks (`agents`, `skills`, `commands`) resolve — else abort with Developer Mode instructions | Plugin loader needs these resolved to discover components |
| 5 | Verify `node --version >= 20` | Required for `npx tsx` |
| 6 | Copy `.claude/rules/**` → `target/.claude/rules/` | Plugin can't ship rules |
| 7a | Merge **14 canonical `permissions.deny`** rules into `target/.claude/settings.json` | Block `.env` reads, `rm -rf /`, `git push --force` |
| 7b | Merge **9 canonical `permissions.allow` CORE** rules into `target/.claude/settings.json` | Skip permission prompts for git/npm/node/npx/cd/ls/pwd/which + Skill |
| 7c | Write `extraKnownMarketplaces.kadmon-harness` + `enabledPlugins[...] = true` into user `~/.claude/settings.json` | Auto-register the plugin |
| 8 | Preserve `target/.claude/settings.local.json` if present; else create `{}` template | Respect machine-specific overrides |
| 9 | Append 3 lines to `target/.gitignore` (dedup): `.claude/settings.local.json`, `.claude/agent-memory/`, `dist/` | Avoid committing secrets/artifacts |
| 10 | Write `target/.kadmon-version` with plugin version | Future `install.sh --update` marker |
| 11 | Print post-install checklist | Onboarding |

**Flags** · `--dry-run` (preview without writing) · `--force-permissions-sync` (re-apply deny rules even if target already has entries) · env `KADMON_USER_SETTINGS_PATH` (test-only: redirect plugin registration to a non-default file)

</details>

<details>
<summary>🩹 <strong>Troubleshooting</strong></summary>

**Hooks don't fire · no `🚀 Kadmon Session Started` banner** — usually an environment issue, not a plugin bug. Check [`docs/onboarding/TROUBLESHOOTING.md`](docs/onboarding/TROUBLESHOOTING.md#systematic-checklist-when-the-3-bugs-above-dont-cover-it) — 6-item ordered checklist (symlinks, Node version, plugin registration, marketplace path, `.kadmon-version`, git remote). Verify the plugin is live with `/plugin` in Claude Code.

**Windows: symlinks appear as text files** — Developer Mode is OFF, `core.symlinks=true` was never set, OR `MSYS=winsymlinks:nativestrict` was unset at clone time (the third is the most common gotcha, verified 2026-04-22). Full remediation with PowerShell and git-checkout paths: [`docs/onboarding/TROUBLESHOOTING.md`](docs/onboarding/TROUBLESHOOTING.md#bug-1--canonical-symlinks-cloned-as-text-files-windows). Detect automatically: `/medik` Check #9 reports state of all 3 canonical symlinks + `dist/` + runtime env.

**`/plugin install` fails to clone** — verify https://github.com/Kadmon7/kadmon-harness loads in your browser (the repo is public). If it does and it still fails, run the three slash commands one at a time — don't paste them together.

**Installer can't find Node 20+** — `install.sh` / `install.ps1` aborts if `node --version` is below 20. Install Node 20 LTS and re-run. On Git Bash make sure `PATH` includes `/c/Program Files/nodejs`.

**A hook is too noisy or misbehaving** — temporarily disable specific hooks with `KADMON_DISABLED_HOOKS` (comma-separated hook names), e.g. `KADMON_DISABLED_HOOKS=ts-review-reminder,console-log-warn`. Only non-critical hooks honor this — security hooks always run.

**Windows: MCP server won't start** — MCP commands need the `cmd /c npx` wrapper on Windows (e.g. `cmd /c npx -y @context7/mcp`). Without it the server won't spawn in Git Bash or PowerShell.

**Rollback**:
```bash
rm -rf <target>/.claude/rules <target>/.claude/settings.json <target>/.kadmon-version
# settings.local.json is never overwritten
# Remove the 3 lines from <target>/.gitignore if desired
# Remove kadmon-harness entries from ~/.claude/settings.json to unregister the plugin
```

</details>

### ✅ Verify

Inside your first session in the target project:

```
/plugin           → kadmon-harness Enabled
/nexus            → dashboard
/chekpoint        → full reviewer matrix on first change
```

### 🧠 Onboard Claude to the harness (optional but recommended)

Want every Claude session in your project to start knowing the 11 commands, 16 agents, 46 skills, 22 hooks, and orchestration chain? Open Claude Code in your project and paste this:

```
Read https://raw.githubusercontent.com/Kadmon7/kadmon-harness/main/docs/onboarding/reference_kadmon_harness.md and save it as a reference memory in this project. Add a one-line pointer under `## References` in MEMORY.md.
```

Claude will fetch the catalog, detect your project's memory directory, write the file with proper frontmatter, and update the index. One turn, done.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ PreTool  │→ │  Tool    │→ │ PostTool │             │
│  │ Hooks(8) │  │ Execute  │  │ Hooks(11)│             │
│  └──────────┘  └──────────┘  └──────────┘             │
│       │                            │                    │
│       ▼                            ▼                    │
│  ┌──────────────────────────────────────┐              │
│  │        observations.jsonl            │ ← ephemeral  │
│  └──────────────────────────────────────┘              │
│       │                                                 │
│  ┌────┴────┐  ┌──────────┐  ┌──────────┐             │
│  │Sessions │  │Instincts │  │  Costs   │ ← SQLite    │
│  └─────────┘  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │HookEvents│  │AgentInvoc│  │SyncQueue │ ← SQLite    │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 16 Agents│  │ 46 Skills│  │ 19 Rules │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  Lifecycle: SessionStart → PreCompact → Stop            │
│  Recovery:  Orphan detection on next SessionStart       │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ What do I use for...?

| Situation | Component |
|-----------|-----------|
| Plan a new task | `/abra-kdabra` → konstruct agent (opus) |
| Do TDD | `/abra-kdabra` with TDD → feniks agent (sonnet) |
| Review code before commit | `/chekpoint` → 5 reviewers + kody consolidation |
| Check harness state | `/nexus` |
| Look up API documentation | `/almanak supabase-js insert` → almanak + Context7 MCP |
| Fix build errors | `/medik` → mekanik agent |
| Forge session observations into instincts | `/forge` (unified pipeline, preview gate) |
| Evolve the harness | `/evolve` → alchemik agent (opus) — step 6 Generate EXPERIMENTAL |
| Design architecture | `/abra-kdabra` with design signals → arkitect agent |
| Audit security | `/chekpoint` → spektr agent (opus) |
| Dry-run instinct forge | `/forge --dry-run` |
| Export instincts | `/forge export` |
| Refactor code | `/medik clean` → kurator agent (sonnet) |

---

## 📦 What's Inside

| Metric | Value |
|--------|-------|
| Agents | **16** (5 opus, 11 sonnet) |
| Skills | **46** |
| Commands | **11** |
| Hooks | **22** |
| Rules | **19** (9 common + 5 TypeScript + 5 Python) |
| Tests | **1069 passing** (85 files) |
| SQLite Tables | **7** + 17 indexes |
| MCPs | **1 active** (Context7) |
| Plugins | **4 active** |

Full component details are below (collapsed by default). For the operational catalog see [`CLAUDE.md`](CLAUDE.md).

<details>
<summary><strong>16 Agents</strong> — 5 opus + 11 sonnet (click to expand)</summary>

> New agents derive from `.claude/agents/_TEMPLATE.md.example`. The canonical skeleton defines 4 mandatory sections (frontmatter, identity, `## Output Format`, `## Memory`) plus strongly-recommended and optional blocks. The `.md.example` extension keeps the template invisible to Claude Code's sub-agent loader and the frontmatter linter, both of which scan only `.md` files. Contract summary lives in `.claude/rules/common/agents.md` §Agent Template Contract.

### Opus Agents (5) — complex decisions

| Agent | Role | Purpose | Auto-invokes when... | Manual |
|-------|------|---------|---------------------|--------|
| **arkitect** | Architect | System design, architecture decisions. Produces decision records. | Never | `/abra-kdabra` |
| **konstruct** | Planner | Breaks down complex tasks into ordered, verifiable steps. | Never | `/abra-kdabra` |
| **spektr** | Security Specialist | Detects injection, XSS, path traversal, secrets. | On auth/keys/exec/SQL | `/chekpoint` |
| **alchemik** | Evolution Analyst | Analyzes hook latency, instinct quality, skill gaps. | Never | `/evolve` |
| **doks** | Doc Sync | Syncs all 4 documentation layers. Behavior-over-counts. | After structural commits | `/doks` |

### Sonnet Agents (11) — implementation and review

| Agent | Role | Purpose | Auto-invokes when... | Manual |
|-------|------|---------|---------------------|--------|
| **kody** | Lead Reviewer | Code quality, strict mode, type safety, Node16 resolution. | On `.ts`/`.tsx` edits | `/chekpoint` |
| **typescript-reviewer** | TS Specialist | TypeScript/JavaScript type safety, async correctness. | On `.ts`/`.tsx`/`.js`/`.jsx` edits | `/chekpoint` |
| **orakle** | DB Specialist | Reviews SQL, schemas, migrations, Supabase, sql.js. | On SQL/schema edits | `/chekpoint` |
| **feniks** | TDD Enforcer | Red-green-refactor cycle. Writes tests + implementation. | Never | `/abra-kdabra` |
| **mekanik** | Build Fixer | Diagnoses TS2xxx, module resolution, Vitest, sql.js errors. | On TypeScript/Vitest failures | `/medik` |
| **kurator** | Refactoring | Identifies dead code, duplication, consolidation. | Never | `/medik clean` |
| **arkonte** | Performance | Analyzes O(n²) loops, slow queries, memory patterns. | On performance patterns | auto-invoke only |
| **python-reviewer** | Python Specialist | Reviews Python: PEP 8, type hints, ML, security. | On `.py` edits | `/chekpoint` |
| **almanak** | Docs Lookup | Searches live documentation via Context7 MCP. | On unfamiliar APIs | `/almanak` |
| **kartograf** | E2E Testing | Writes and runs E2E tests, profile-aware (`harness|web|cli` per ADR-031): Vitest/pytest (harness), Playwright/Stagehand (web), subprocess + exit-code contracts (cli). | Never | `/skanner` |
| **skavenger** | Researcher | Multi-source deep research: web, YouTube transcripts, PDFs. Synthesizes cited reports. | On research/investigate/deep-dive intent | `/skavenger` |

</details>

<details>
<summary><strong>46 Skills</strong> — domain knowledge loaded on demand</summary>

> Each skill lives at `.claude/skills/<name>/SKILL.md` (subdirectory layout with literal uppercase `SKILL.md`). Flat files like `.claude/skills/<name>.md` are invisible to the Claude Code skill loader. Layout enforced by `/medik` Check #8.

### TypeScript / Code Quality
- **coding-standards** — Naming, `node:` prefix imports, .js extensions
- **api-design** — REST/RPC patterns with Zod schemas, error handling, versioning
- **claude-api** — Correct Anthropic SDK usage: Messages, Tool Use, streaming

### Frontend
- **frontend-patterns** — React/React Native: composition, custom hooks, Context+Reducer, memo/lazy/Suspense, accessibility

### Database / Supabase
- **postgres-patterns** — Indexes, upsert, RLS, pgvector, SQL cheatsheet
- **database-migrations** — Safe ALTER TABLE, Supabase migrations, rollback strategies

### Testing
- **tdd-workflow** — Red-green-refactor cycle, 80%+ coverage, `:memory:` SQLite
- **e2e-testing** — Mock vs real matrix, lifecycle rules, cleanup patterns
- **verification-loop** — 6-step pipeline: build, typecheck, test, lint, format, review
- **eval-harness** — EDD framework: define pass/fail before implementing, capability + regression evals, pass@k metrics, code/model/human graders

### Python
- **python-patterns** — Type hints (3.9+, Protocol, TypeVar), error handling, context managers, dataclasses
- **python-testing** — pytest: fixtures, async testing, autospec mocking, coverage

### Research / Documentation
- **search-first** — Search existing codebase before writing new code
- **architecture-decision-records** — Decision record templates, lifecycle, Decision/Context/Options format
- **deep-research** — Multi-source research methodology with citations
- **docs-sync** — 4-layer documentation synchronization: behavior-over-counts

### Harness Meta-Skills
- **safety-guard** — 3 protection layers: block-no-verify, config-protection, no-context-guard
- **context-budget** — Context window management, when to compact
- **continuous-learning-v2** — Instinct lifecycle: create, reinforce, contradict, promote, prune
- **mcp-server-patterns** — MCP configuration, health checks, secrets management
- **systematic-debugging** — Structured diagnosis: reproduce, isolate, hypothesize, verify
- **receiving-code-review** — Receiving and applying code review feedback

### Harness Self-Improvement (Sprint F — ECC import)
- **skill-stocktake** — Audit skills for quality/drift with Keep/Improve/Update/Retire/Merge verdicts
- **agent-eval** — Head-to-head coding agent comparison with pass rate, cost, time, consistency
- **agent-introspection-debugging** — 4-phase self-debug workflow for agent failures (capture, diagnose, recover, report)
- **prompt-optimizer** — Rewrite raw prompts into harness-optimized versions with right commands/skills/agents
- **skill-comply** — Measure whether rules and skills are actually followed, not just documented
- **rules-distill** — Extract cross-cutting principles from 2+ skills into new rules
- **workspace-surface-audit** — Inventory repo + MCP + plugins + hooks and recommend next moves
- **codebase-onboarding** — Generate architecture map + starter CLAUDE.md for unfamiliar repos

</details>

<details>
<summary><strong>11 Commands</strong> — organized by lifecycle phase</summary>

### Observe (2)
| Command | Purpose |
|---------|---------|
| `/nexus` | System state: instincts, sessions, costs, hook health |
| `/kompact` | Smart compaction; `/kompact audit` audits context window usage |

### Plan (1)
| Command | Purpose |
|---------|---------|
| `/abra-kdabra` | Smart planning (arkitect → konstruct → feniks if TDD → kody) |

### Build (1)
| Command | Purpose |
|---------|---------|
| `/medik` | Full harness diagnostic — 14 health checks, repair, cleanup |

### Scan (1)
| Command | Purpose |
|---------|---------|
| `/skanner` | Deep system assessment — performance + E2E workflow tests. Profile-aware (`harness|web|cli` per ADR-031); hook-latency benchmarking is harness-only |

### Research (1)
| Command | Purpose |
|---------|---------|
| `/skavenger` | Multi-source deep research (web, YouTube transcripts, PDFs, GitHub repos). Auto-writes to `docs/research/`. Flags: `--continue`, `--plan`, `--verify <h>`, `--drill <N>`, `--history <q>`, `--verify-citations <N>`. Disable auto-write with `KADMON_RESEARCH_AUTOWRITE=off` |

### Remember (3)
| Command | Purpose |
|---------|---------|
| `/chekpoint` | Tiered verification + review + commit + push (full/lite/skip) |
| `/almanak` | Search live documentation (Context7) |
| `/doks` | Sync project documentation with code changes (4-layer) |

### Evolve (2)
| Command | Purpose |
|---------|---------|
| `/forge` | Unified instinct pipeline (read → extract → cluster → preview gate → apply). Flags: `--dry-run`, `export`. Writes ClusterReport JSON consumed by `/evolve` step 6. |
| `/evolve` | Harness self-optimization analysis. Step 6 "Generate" (EXPERIMENTAL through 2026-04-28) reads `/forge` ClusterReports and proposes new skills/commands/agents/rules through a preview gate. |

</details>

<details>
<summary><strong>22 Hooks</strong> — by severity (block / warn / observe / verify / lifecycle)</summary>

### Security — block dangerous operations (exit 2)
| Hook | Event | What It Does |
|------|-------|-------------|
| **block-no-verify** | PreToolUse Bash | Blocks `--no-verify` and `--no-gpg-sign` in git commands |
| **commit-format-guard** | PreToolUse Bash | Blocks commits without conventional format |
| **commit-quality** | PreToolUse Bash | Scans staged changes for console.log, debugger, secrets |
| **config-protection** | PreToolUse Edit/Write | Blocks edits to critical config files |
| **no-context-guard** | PreToolUse Edit/Write | Blocks Edit/Write without prior Read of the file |

### Warning — suggest but allow (exit 1)
| Hook | Event | What It Does |
|------|-------|-------------|
| **git-push-reminder** | PreToolUse Bash | Reminds to run `/chekpoint` before git push |
| **ts-review-reminder** | PostToolUse | Warns after 10+ `.ts` edits without code review |
| **console-log-warn** | PostToolUse | Warns about `console.log()` in production code |
| **deps-change-reminder** | PostToolUse | Reminds to run `/almanak` when package.json changes |
| **agent-metadata-sync** | PostToolUse Edit/Write | Auto-syncs `.claude/agents/*.md` frontmatter changes to CLAUDE.md + `rules/common/agents.md` catalogs (never exit 2) |

### Observation — log everything (exit 0)
| Hook | Event | What It Does |
|------|-------|-------------|
| **observe-pre** | PreToolUse all | Logs tool invocation to JSONL with metadata |
| **observe-post** | PostToolUse all | Logs tool result to JSONL; captures errors |

### Post-edit verification
| Hook | Event | What It Does |
|------|-------|-------------|
| **post-edit-format** | PostToolUse | Auto-formats edited files with Prettier |
| **post-edit-typecheck** | PostToolUse | Language-aware: `tsc --noEmit` on `.ts`/`.tsx`; mypy/pyright/py_compile on `.py` |
| **quality-gate** | PostToolUse | Language-aware: ESLint on `.ts`/`.js`; `ruff check` on `.py` |
| **post-edit-security** | PostToolUse | Python SAST: `bandit -ll` on `.py` edits (warn-only, graceful fallback) — ADR-027 |
| **pr-created** | PostToolUse | Detects PR creation and logs URL |

### Session lifecycle
| Hook | Event | What It Does |
|------|-------|-------------|
| **session-start** | SessionStart | Initializes session, loads 3 recent sessions, recovers orphans |
| **pre-compact-save** | PreCompact | Saves session state before context compaction |
| **session-end-all** | Stop | Consolidated: persist + daily log + evaluate patterns + cost |

### MCP monitoring
| Hook | Event | What It Does |
|------|-------|-------------|
| **mcp-health-check** | PreToolUse mcp__ | Validates MCP server health before calls |
| **mcp-health-failure** | PostToolUseFailure mcp__ | Logs MCP server failures |

</details>

<details>
<summary><strong>19 Rules</strong> — 9 common + 5 TypeScript + 5 Python</summary>

Rules auto-load based on file context. They enforce conventions via hooks, agents, and built-in routing.

### Common (9) — always loaded
`agents.md` · `coding-style.md` · `development-workflow.md` · `git-workflow.md` · `hooks.md` · `patterns.md` · `performance.md` · `security.md` · `testing.md`

### TypeScript (5) — on `.ts`/`.tsx` edits
`coding-style.md` · `hooks.md` · `patterns.md` · `security.md` · `testing.md`

### Python (5) — on `.py` edits
`coding-style.md` · `hooks.md` · `patterns.md` · `security.md` · `testing.md`

Detailed rule content in [`.claude/rules/`](.claude/rules/).

</details>

<details>
<summary><strong>Session Lifecycle</strong> — from start to clean exit (or crash recovery)</summary>

```
SessionStart hook
  ├── Back up SQLite database
  ├── Recover orphaned sessions (crash recovery)
  ├── Load previous session context + instincts
  └── Start new session record

During session
  ├── observe-pre: log every tool call to observations.jsonl
  └── observe-post: log every tool result

On /kompact (PreCompact hook)
  ├── Persist messageCount, filesModified, toolsUsed
  ├── Generate session summary
  ├── Evaluate and reinforce instinct patterns
  └── Reset tool counter

On clean exit (Stop hook — session-end-all)
  ├── Persist final session summary + tasks
  ├── Evaluate patterns → create/reinforce instincts
  ├── Track cost (tokens, model, USD)
  └── Write clean-exit marker

On crash / terminal close
  └── Next SessionStart recovers the orphaned session
```

</details>

<details>
<summary><strong>Instinct System</strong> — patterns that grow with evidence</summary>

Instincts are patterns learned from sessions. They start weak and grow with evidence.

```
Created:    confidence 0.3, occurrences 1
Reinforced: confidence += 0.1 per matching session
Promotable: confidence >= 0.7 AND occurrences >= 3
Promoted:   becomes a permanent skill via /forge (preview gate approves promotion; /evolve step 6 Generate can then scaffold the skill from ClusterReports)
```

Example instincts:
```
[█████████░] 0.9  Build after editing TypeScript (14x)  → /forge (promote)
[████████░░] 0.8  Re-run tests after fixing failures (12x) → /forge (promote)
[███░░░░░░░] 0.3  Research before building (1x)
```

</details>

<details>
<summary><strong>Dashboard</strong> — `/nexus` output</summary>

```
  ╔════════════════════════════════════════════╗
  ║  🧠  KADMON HARNESS DASHBOARD              ║
  ╚════════════════════════════════════════════╝

  🎯 Health: 95/100 EXCELLENT    |  📊 12 sessions    |  💰 $8.47 total

  ────────────────────────────────────────────────────────────
  🔮 INSTINCTS (9 active, 5 promotable)

  [██████████] 0.9  Build after editing types.ts (14x) → promote
  [██████████] 0.9  Re-run tests after failures (12x) → promote
  [████████░░] 0.8  Schema check after state-store edit (8x) → promote
  [███░░░░░░░] 0.3  Research before building (1x)

  ────────────────────────────────────────────────────────────
  📅 RECENT SESSIONS

  Date        Branch              Files  Msgs  Cmps  Duration  Cost
  2026-04-22  feat/install-health     8   145     1    2h 10m  $0.42 ▃▃▃
  2026-04-21  main                    4    62     0       45m  $0.18 █
  2026-04-20  feat/sprint-d          12   320     2    4h 05m  $1.87 █████████
  ⚡ = live session

  ────────────────────────────────────────────────────────────
  💰 COST SUMMARY (by model)

  Model              Sessions  Tokens In  Tokens Out   Cost
  opus                      4       2.1M       0.8M    $6.12
  sonnet                    8       1.4M       0.5M    $2.35
  ──────────────────────────────────────────────────────────
  Total                                                 $8.47

  ────────────────────────────────────────────────────────────
  🚨 HOOK EVENTS (persistent)

  Hook                     Total  Blocks  Avg ms  Status
  no-context-guard            84       3    42ms   [ WARN ]
  block-no-verify             12       0    18ms   [ OK ]
  quality-gate                96       0   124ms   [ OK ]

  ────────────────────────────────────────────────────────────
  🤖 AGENT USAGE (persistent)

  Agent                Total  Avg Duration  Fail%  Status
  kody                     8          12.3s     0%   [ OK ]
  typescript-reviewer     14           8.1s     0%   [ OK ]
  arkitect                 3          42.7s     0%   [ OK ]

  ────────────────────────────────────────────────────────────
  ⚡ LIVE SESSION (current)

  Tool            Total  Fail  Status
  Read               62     0   [ OK ]
  Edit               14     0   [ OK ]
  Bash               45     0   [ OK ]

  ────────────────────────────────────────────────────────────
  💾 DATABASE (kadmon.db)

  sessions                   45  ██████████
  instincts                  12  ███
  cost_events               160  ██████████
  hook_events               480  ██████████
  agent_invocations          32  ██████
  sync_queue                  0
  research_reports            7  ██

  v1.0 | 2026-04-22T20:30:00 | project: 9444ca5b
```

</details>

<details>
<summary><strong>Using graphify</strong> — external knowledge-graph layer (v1.3+, ADR-026)</summary>

The harness adopts [`graphify`](https://github.com/safishamsi/graphify) (MIT, Python 3.10+) as an external knowledge-graph layer. It scans the repo, builds `graphify-out/graph.json`, and registers a PreToolUse hook nudging Claude to consult the graph before blanket `Grep` / `Glob` scans.

**Install (one-time, per collaborator):**

```bash
uv tool install graphifyy          # or: pipx install graphifyy
graphify install
graphify claude install            # writes project-scoped CLAUDE.md section + .claude/settings.json hook
```

**First build** (LLM-expensive — Claude subagents extract concepts from non-code files):

```bash
graphify .
git add graphify-out/ .graphifyignore
git commit -m "chore: initial graphify build"
```

**Keep the graph fresh:**

```bash
graphify hook install              # post-commit hook, AST-only incremental rebuilds (no LLM cost for code-only changes)
graphify --update                  # manual re-run when docs / ADRs / plans change significantly
```

**Measurement (Sprint E):** 5-query token benchmark pre/post graphify. Adoption removed if real reduction < 3×. See [`ADR-026`](docs/decisions/ADR-026-graphify-adoption.md).

</details>

---

## 📊 Status & Attribution

**v1.3.0 — latest: project-agnostic /skanner stack — kartograf + arkonte + /skanner profile-aware (harness|web|cli, ADR-031, 2026-04-26)**
`1069 tests passing` · `85 files` · `22 hooks` · `16 agents` · `46 skills` · `11 commands` · `19 rules` · `7 DB tables`

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.
