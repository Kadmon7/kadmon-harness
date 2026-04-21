# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

[![Tests](https://img.shields.io/badge/tests-731%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.1-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)]()
[![Node](https://img.shields.io/badge/Node-20%2B-339933)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

---

## What is this?

Kadmon Harness is **infrastructure, not a product**. It is a portable set of agents, commands, skills, hooks, and rules that encode how Claude Code should work on any project. Built once, carried to every new project via bootstrap. It turns every session into an observable, memorable, self-improving loop.

Instead of asking Claude "please write a test first", you define it in a rule, a hook enforces it, and an agent specializes in it. The next session already knows.

---

## 🎯 Mantra

**Observe → Remember → Verify → Specialize → Evolve**

| Phase | What It Does | Key Components |
|-------|-------------|----------------|
| **Observe** | Watch every tool call, manage context | observe hooks, `/kompact audit`, `/kadmon-harness` |
| **Remember** | Persist sessions, track learned patterns | SQLite, instinct engine, `/chekpoint` |
| **Verify** | Tests first, code review, quality gates | `/skanner`, `/chekpoint` |
| **Specialize** | Domain agents, curated skill catalog | 16 agents, 46 skills, `/abra-kdabra` |
| **Evolve** | Forge observations into instincts, generate artifacts | `/forge`, `/evolve` (step 6 Generate EXPERIMENTAL through 2026-04-28) |

---

## 🎯 Which path is for me?

Two totally different use cases — pick yours before continuing:

| I want to... | Path | Who | Section |
|---|---|---|---|
| **Use the harness IN my project** (daily driver) | Install as Claude Code plugin into any project | Joe, Eden, Abraham, and 99% of users | [📥 Install into another project](#-install-into-another-project) |
| **Develop or modify the harness itself** | Clone + build + edit agents/skills/hooks/rules | Kadmon7 and harness contributors | [🚀 Quick Start (contributors)](#-quick-start-contributors) below |

If you picked the first row (use in your project), jump directly to the INSTALL section — the rest of this intro is for contributors.

---

## 🚀 Quick Start (contributors)

> Follow this ONLY if you want to edit the harness codebase itself. If you want to use the harness in another project, go to the [INSTALL section](#-install-into-another-project).

```bash
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install
npm run build
```

Start a Claude Code session **inside the harness repo** — harness hooks activate on itself (self-use / dogfood):

```bash
claude
```

Six commands to know on day one:

```bash
/kadmon-harness      # System state: instincts, sessions, costs, hook health
/abra-kdabra         # Plan complex tasks (arkitect + konstruct + feniks + kody)
/medik               # Full harness diagnostic + repair
/skanner             # Deep performance + E2E assessment
/chekpoint           # Verify + review + commit + push
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ PreTool  │→ │  Tool    │→ │ PostTool │             │
│  │ Hooks(8) │  │ Execute  │  │ Hooks(10)│             │
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
| Check harness state | `/kadmon-harness` |
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
| Hooks | **21** |
| Rules | **19** (9 common + 5 TypeScript + 5 Python) |
| Tests | **731 passing** (67 files) |
| SQLite Tables | **7** + 17 indexes (research_reports added in ADR-015) |
| MCPs | **1 active** (Context7) |
| Plugins | **4 active** |

Full component details are below (collapsed by default). For the operational catalog see [`CLAUDE.md`](CLAUDE.md).

<details>
<summary><strong>16 Agents</strong> — 5 opus + 11 sonnet (click to expand)</summary>

> New agents derive from `.claude/agents/_TEMPLATE.md.example` (per ADR-017, amended by ADR-019 dogfood 2026-04-20). The canonical skeleton defines 4 mandatory sections (frontmatter, identity, `## Output Format`, `## Memory`) plus strongly-recommended and optional blocks. The `.md.example` extension keeps the template invisible to Claude Code's sub-agent loader and the frontmatter linter, both of which scan only `.md` files. Contract summary lives in `.claude/rules/common/agents.md` §Agent Template Contract.

### Opus Agents (5) — complex decisions

| Agent | Role | Purpose | Auto-invokes when... | Manual |
|-------|------|---------|---------------------|--------|
| **arkitect** | Architect | System design, architecture decisions. Produces ADRs. | Never | `/abra-kdabra` |
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
| **kartograf** | E2E Testing | Writes and runs E2E tests: Vitest (harness), Playwright (web). | Never | `/skanner` |
| **skavenger** | Researcher | Multi-source deep research: web, YouTube transcripts, PDFs. Synthesizes cited reports. | On research/investigate/deep-dive intent | `/skavenger` |

</details>

<details>
<summary><strong>46 Skills</strong> — domain knowledge loaded on demand</summary>

> Each skill lives at `.claude/skills/<name>/SKILL.md` (subdirectory layout with literal uppercase `SKILL.md`, per ADR-013). Flat files like `.claude/skills/<name>.md` are invisible to the Claude Code skill loader. Layout enforced by `/medik` Check #8.

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
- **architecture-decision-records** — ADR templates, lifecycle, Decision/Context/Options format
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
| `/kadmon-harness` | System state: instincts, sessions, costs, hook health |
| `/kompact` | Smart compaction; `/kompact audit` audits context window usage |

### Plan (1)
| Command | Purpose |
|---------|---------|
| `/abra-kdabra` | Smart planning (arkitect → konstruct → feniks if TDD → kody) |

### Build (1)
| Command | Purpose |
|---------|---------|
| `/medik` | Full harness diagnostic — 8 health checks, repair, cleanup |

### Scan (1)
| Command | Purpose |
|---------|---------|
| `/skanner` | Deep system assessment — performance + E2E workflow tests |

### Research (1)
| Command | Purpose |
|---------|---------|
| `/skavenger` | Multi-source deep research (web, YouTube transcripts, PDFs, GitHub repos). Auto-writes to `docs/research/` (ADR-015). Flags: `--continue`, `--plan`, `--verify <h>`, `--drill <N>`, `--history <q>`, `--verify-citations <N>`. Disable auto-write with `KADMON_RESEARCH_AUTOWRITE=off` |

### Remember (3)
| Command | Purpose |
|---------|---------|
| `/chekpoint` | Tiered verification + review + commit + push (full/lite/skip) |
| `/almanak` | Search live documentation (Context7) |
| `/doks` | Sync project documentation with code changes (4-layer) |

### Evolve (2)
| Command | Purpose |
|---------|---------|
| `/forge` | Unified instinct pipeline (read → extract → cluster → preview gate → apply). Flags: `--dry-run`, `export`. Writes ClusterReport JSON consumed by `/evolve` step 6. (`/instinct` remains as a deprecated alias until 2026-04-20.) |
| `/evolve` | Harness self-optimization analysis. Step 6 "Generate" (EXPERIMENTAL through 2026-04-28) reads `/forge` ClusterReports and proposes new skills/commands/agents/rules through a preview gate. |

</details>

<details>
<summary><strong>21 Hooks</strong> — by severity (block / warn / observe / verify / lifecycle)</summary>

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
| **ts-review-reminder** | PostToolUse | Warns after 5+ `.ts` edits without code review |
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
| **post-edit-typecheck** | PostToolUse | Runs `tsc --noEmit` on `.ts`/`.tsx` |
| **quality-gate** | PostToolUse | Runs ESLint on edited files |
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
<summary><strong>Dashboard</strong> — `/kadmon-harness` output</summary>

```
╔══════════════════════════════════════╗
║       KADMON HARNESS DASHBOARD       ║
╚══════════════════════════════════════╝

── INSTINCTS (10 active | 10 promotable) ──
  [█████████░] 0.9  Build after editing TypeScript (14x) → /forge (promote)
  [█████████░] 0.9  Re-run tests after fixing failures (14x) → /forge (promote)
  [███░░░░░░░] 0.3  Research before building (1x)

── SESSIONS ──
  Date        Branch              Files  Msgs  Cmps  Duration  Cost
  2026-03-30  main                   12   640     2    3h 15m  $4.52  *
  2026-03-29  main                    6    87     0    1h 30m  $0.45

── COST SUMMARY ──
  Model              Sessions  Tokens In  Tokens Out   Cost
  opus                      3      450.2K     125.3K  $3.20
  sonnet                    8      280.1K      95.4K  $0.85
  Total                                              $4.05

── HOOK HEALTH ──
  Tool            Total  Fail  Status
  Read               62     0  OK
  Edit               14     0  OK
  Bash               45     0  OK
```

</details>

---

## 📚 Learn More

| Document | What's In It |
|----------|-------------|
| [`CLAUDE.md`](CLAUDE.md) | Operational catalog for Claude Code — stack, env vars, pitfalls, agent/skill/command inventory |
| [`docs/decisions/`](docs/decisions/) | Architecture Decision Records (ADRs) — why things are the way they are |
| [`docs/roadmap/`](docs/roadmap/) | v1.0 (current), v1.1 (learning system), v2.0 (multi-project) |
| [`docs/plans/`](docs/plans/) | Implementation plans for ongoing work |
| [`.claude/rules/`](.claude/rules/) | The 19 rules that enforce conventions |

> **Windows compatibility**: `parseStdin()` helper sanitizes unescaped backslashes in hook stdin; `PATH` prefix ensures Node.js resolution in Git Bash; MCP servers use `cmd /c npx` wrapper; non-critical hooks support `KADMON_DISABLED_HOOKS` env var.

---

## 📥 Install into another project

> **This is the path for end users** (Joe, Eden, Abraham, and anyone who wants to use the harness on their own project). Pick one of the two paths below based on what you need.

### Which option do I pick?

| You want... | Pick | How long |
|---|---|---|
| Agents + skills + commands + hooks (plugin parts — the 80%) | **Option 1 — Marketplace** | 3 slash commands, ~30 seconds |
| Everything: plugin parts + 19 rules + 15 `permissions.deny` entries | **Option 2 — `install.sh` (recommended)** | Clone + build + one script, ~2 minutes |

Distribution architecture (per [ADR-010](docs/decisions/ADR-010-harness-distribution-hybrid.md) + [ADR-019](docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md)):

- **Claude Code plugin** ships agents, skills, commands, and hooks via canonical root symlinks (auto-registered in `~/.claude/settings.json`).
- **`install.sh` / `install.ps1`** copies `rules/` and merges `permissions.deny` + writes `.kadmon-version` + updates `.gitignore` (the two categories Claude Code plugins cannot distribute today).

### Option 1 — Quick marketplace install (plugin parts only)

Installs: **16 agents + 46 skills + 11 commands + 21 hooks** (auto-registered via the Claude Code marketplace).
Does NOT install: the **19 rules + 15 canonical `permissions.deny`** entries. For those, use Option 2.

**Open a Claude Code session in any project, then run these 3 commands — one at a time, each on its own line:**

```
/plugin marketplace add https://github.com/Kadmon7/kadmon-harness.git
```

```
/plugin install kadmon-harness@kadmon-harness
```

```
/reload-plugins
```

**Verify**: inside the session run `/plugin` — you should see `kadmon-harness Enabled`, scope `user`, version `1.1.0`, with all 16 agents + 46 skills + 11 commands listed.

> **Pitfall 1 — Don't paste multiple slash commands on one line.** If you paste `/plugin marketplace add ... /plugin install ...` together, Claude Code parses the second command as part of the first URL and clone fails with `Repository not found`. Run each command separately.

> **Pitfall 2 — SSH host key error on a fresh Mac.** If you try the short form `/plugin marketplace add Kadmon7/kadmon-harness` before ever running `ssh -T git@github.com`, you'll see `Host key verification failed`. The HTTPS URL shown above bypasses SSH — use it. (Permanent fix: run `ssh -T git@github.com` in terminal once and type `yes`.)

---

### Option 2 — Complete install via `install.sh` / `install.ps1` (recommended)

### What the installer does (11 steps)

| Step | Action | Why |
|---|---|---|
| 1 | Parse args `<target>` + flags (`--dry-run`, `--force-permissions-sync`) | Flexibility |
| 2 | Validate target exists, is writable, is not the harness repo itself | Safety |
| 3 | Detect OS (linux / darwin / gitbash / windows) | Error messaging |
| 4 | Verify canonical root symlinks (`agents`, `skills`, `commands`) resolve — else ABORT with Developer Mode instructions | ADR-019 plugin-loader contract |
| 5 | Verify `node --version >= 20` | Required for `npx tsx` |
| 6 | Copy `.claude/rules/**` → `target/.claude/rules/` | Plugin can't ship rules |
| 7a | Merge 15 canonical `permissions.deny` rules into `target/.claude/settings.json` | Block `.env`, `rm -rf`, `git push --force` |
| 7b | Write `extraKnownMarketplaces.kadmon-harness` + `enabledPlugins[...] = true` into user `~/.claude/settings.json` | **Auto-registers the plugin** |
| 8 | Preserve `target/.claude/settings.local.json` if present; else create `{}` template | Respect user's machine-specific overrides |
| 9 | Append 3 lines to `target/.gitignore` (dedup): `.claude/settings.local.json`, `.claude/agent-memory/`, `dist/` | Avoid committing secrets/artifacts |
| 10 | Write `target/.kadmon-version` with plugin version | Future `install.sh --update` marker |
| 11 | Print post-install checklist | Onboarding |

### Prerequisites

- Node.js **>= 20** (`node --version`)
- `git` in `PATH` (any recent version — no auth needed, the repo is public)
- **Windows only**: Developer Mode ON (Settings → Privacy & Security → For Developers) + `git config --global core.symlinks true`. Without this, the canonical root symlinks resolve as text files and the plugin loader rejects the manifest.
- Optional: `gh` CLI (only if you prefer `gh repo clone` over `git clone`; not required since 2026-04-20 when the repo went public).

### Step-by-step — Mac / Linux (bash)

```bash
# 1. ONE-TIME per machine — clone the harness anywhere
cd ~/projects   # or wherever you keep repos
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install && npm run build

# 2. ONCE PER PROJECT — dry-run first to preview
./install.sh --dry-run /path/to/your/project

# 3. If the dry-run plan looks right, install for real
./install.sh /path/to/your/project

# 4. Open Claude Code in your project — plugin is now active
cd /path/to/your/project
claude

# 5. Verify inside the session:
#    /plugin          → should list kadmon-harness as enabled
#    /kadmon-harness  → dashboard with instincts/sessions/costs
```

### Step-by-step — Windows (native PowerShell)

```powershell
# 0. ONE-TIME per machine — enable symlinks (CRITICAL, plugin won't load without this)
# Open Settings → Privacy & Security → For Developers → turn Developer Mode ON
git config --global core.symlinks true

# 1. ONE-TIME per machine — clone
cd C:\projects
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install; npm run build

# 2. ONCE PER PROJECT — dry-run first
.\install.ps1 -TargetPath C:\path\to\your\project -DryRun

# 3. Install for real
.\install.ps1 -TargetPath C:\path\to\your\project

# 4. Open Claude Code in your project
cd C:\path\to\your\project
claude
```

### Step-by-step — Windows (Git Bash)

```bash
# 0. ONE-TIME per machine — enable native symlinks (same prereqs as PowerShell)
git config --global core.symlinks true
export MSYS=winsymlinks:nativestrict   # add to ~/.bashrc to persist across sessions

# 1. ONE-TIME per machine — clone
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install && npm run build

# 2. ONCE PER PROJECT
./install.sh --dry-run /c/path/to/your/project
./install.sh /c/path/to/your/project

# 3. Open Claude Code
cd /c/path/to/your/project
claude
```

### Post-install checklist

1. Open a Claude Code session in the target: `claude`
2. Run `/plugin` — confirm `kadmon-harness` appears as **Enabled** with Scope `user` and Version `1.1.0`
3. Run `/kadmon-harness` — dashboard should show instincts, sessions, costs
4. (Optional) Customize machine-specific overrides in `<target>/.claude/settings.local.json`
5. Run `/chekpoint` to exercise the full reviewer matrix against your first change

> **Known gap (Sprint E)**: `session-start` banner is silent in plugin mode — hooks register correctly but the `console.log` banner is suppressed. Not a blocker; the plugin itself works. Fix requires Anthropic `env` block support in `hooks.json`.

### Flags reference

| Flag | install.sh | install.ps1 | Effect |
|------|-----------|-------------|--------|
| Dry-run | `--dry-run` | `-DryRun` | Print planned operations without touching the filesystem |
| Force permissions re-merge | `--force-permissions-sync` | `-ForcePermissionsSync` | Re-apply harness `permissions.deny` even if target already has entries |
| User settings override | env `KADMON_USER_SETTINGS_PATH=...` | env `KADMON_USER_SETTINGS_PATH=...` | Test hook — points plugin registration at a non-default file instead of `~/.claude/settings.json` |

### Rollback (if something goes wrong)

Every change the installer makes is reversible manually:

```bash
rm -rf <target>/.claude/rules
rm <target>/.claude/settings.json <target>/.kadmon-version
# settings.local.json is never overwritten — leave alone
# Remove the 3 lines from <target>/.gitignore if desired
# Remove kadmon-harness entries from ~/.claude/settings.json if you want to unregister the plugin globally
```

### Troubleshooting

**`Host key verification failed` when running `/plugin marketplace add Kadmon7/kadmon-harness`**
Your Mac (or Windows box) has never connected to GitHub via SSH, so the key is not in `~/.ssh/known_hosts`. Two fixes:
- (Easiest) Use the HTTPS URL from Option 1: `/plugin marketplace add https://github.com/Kadmon7/kadmon-harness.git`.
- (Permanent) Run `ssh -T git@github.com` in terminal once and type `yes` at the prompt. After that, the short form `Kadmon7/kadmon-harness` works.

**`Repository not found` when using the HTTPS URL**
The Kadmon-Harness repo is public since 2026-04-20 — load https://github.com/Kadmon7/kadmon-harness in your browser (no auth prompt) to confirm. If you pasted two slash commands on one line, Claude Code concatenated the second command into the URL — run each command on its own line.

**Hooks don't fire / no `🚀 Kadmon Session Started` banner**
Known gap (Bug #3, deferred to Sprint E): in plugin mode the hook `console.log` banner output is suppressed, but the hooks themselves execute. Verify with `/plugin` — if kadmon-harness is `Enabled`, hooks are registered and running. Banner visibility requires an upstream Anthropic fix for `env` block support in `hooks.json`.

**Windows: canonical symlinks appear as text files after clone**
Developer Mode is OFF or `git config --global core.symlinks true` was never run. Turn Developer Mode on (Settings → Privacy & Security → For Developers), run the git config, then re-clone with `MSYS=winsymlinks:nativestrict` exported (Git Bash) or a fresh clone in PowerShell. Verify with `Get-Item agents,skills,commands | Select LinkType` (should show `SymbolicLink`).

---

## 📊 Status & Attribution

**v1.1 — latest shipped: Sprint D hybrid distribution (plan-010 + plan-019 + ADR-010 + ADR-019, 2026-04-20)**
`731 tests passing` · `67 files` · `21 hooks` · `16 agents` · `46 skills` · `11 commands` · `19 rules` · `7 DB tables`

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.
