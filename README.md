# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

[![Tests](https://img.shields.io/badge/tests-870%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.2-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6)]()
[![Node](https://img.shields.io/badge/Node-20%2B-339933)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

---

## What is this?

Kadmon Harness is **infrastructure, not a product**. It is a portable set of agents, commands, skills, hooks, and rules that encode how Claude Code should work on any TypeScript or Python project. Built once, carried to every new project via bootstrap. It turns every session into an observable, memorable, self-improving loop.

> **Language support today**: TypeScript/JavaScript and Python. Commands and hooks detect the target project's toolchain at runtime ([ADR-020](docs/decisions/ADR-020-runtime-language-detection.md)). Override with `KADMON_PROJECT_LANGUAGE=python|typescript`.

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

## 🚀 Install

**Three slash commands.** Open a Claude Code session in any project and run each one on its own line:

```
/plugin marketplace add https://github.com/Kadmon7/kadmon-harness.git
```

```
/plugin install kadmon-harness@kadmon-harness
```

```
/reload-plugins
```

That's it — run `/plugin` and you'll see **kadmon-harness Enabled** with **16 agents · 46 skills · 11 commands · 21 hooks** live in the session.

> ⚠️ **Run each command on its own line.** Pasting two together makes Claude Code concatenate the second into the first URL and clone fails.
> 🍎 **Fresh Mac SSH error?** The HTTPS URL above bypasses SSH. If you prefer the short form `Kadmon7/kadmon-harness`, run `ssh -T git@github.com` once in your terminal.

---

### 🧩 Want the rules and security permissions too?

The plugin ships the **80 %** — agents, skills, commands, hooks — everything Claude Code distributes natively. The remaining **20 %** are the **19 conventions-as-rules**, **14 `permissions.deny` entries** (block `.env` reads, `rm -rf /`, `git push --force`, etc.), and **9 `permissions.allow` CORE entries** (git/npm/node/npx/cd/ls/pwd/which + Skill dispatch — see [ADR-021](docs/decisions/ADR-021-install-allow-merge-and-gitattributes.md)). Claude Code plugins can't ship those today, so there's a one-shot bootstrap that copies them into your project:

<details>
<summary><strong>🍎 macOS / 🐧 Linux · bash · 4 lines</strong></summary>

```bash
git clone https://github.com/Kadmon7/kadmon-harness.git ~/projects/kadmon-harness
cd ~/projects/kadmon-harness
npm install && npm run build
./install.sh /path/to/your/project
```

Dry-run first (preview without touching the filesystem): `./install.sh --dry-run /path/to/your/project`

</details>

<details>
<summary><strong>🪟 Windows · PowerShell · 5 lines</strong></summary>

**One-time machine setup** (the canonical root symlinks won't resolve without this):

1. **Settings → Privacy & Security → For Developers → Developer Mode: ON**
2. In any terminal: `git config --global core.symlinks true`

Then:

```powershell
cd C:\projects
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install; npm run build
.\install.ps1 -TargetPath C:\path\to\your\project
```

Dry-run first: `.\install.ps1 -TargetPath C:\path\to\your\project -DryRun`

</details>

<details>
<summary><strong>🪟 Windows · Git Bash · 4 lines</strong></summary>

**One-time machine setup** (same as PowerShell above, plus symlink-mode export):

```bash
git config --global core.symlinks true
export MSYS=winsymlinks:nativestrict   # add to ~/.bashrc to persist
```

Then:

```bash
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install && npm run build
./install.sh /c/path/to/your/project
```

</details>

<details>
<summary>🔍 <strong>What the installer does</strong> · 11 deterministic steps</summary>

| # | Action | Why |
|---|---|---|
| 1 | Parse args `<target>` + flags (`--dry-run`, `--force-permissions-sync`) | Flexibility |
| 2 | Validate target is a writable directory and isn't the harness repo itself | Safety |
| 3 | Detect OS (linux / darwin / gitbash / windows) | Error messaging |
| 4 | Verify the 3 canonical root symlinks (`agents`, `skills`, `commands`) resolve — else abort with Developer Mode instructions | ADR-019 plugin-loader contract |
| 5 | Verify `node --version >= 20` | Required for `npx tsx` |
| 6 | Copy `.claude/rules/**` → `target/.claude/rules/` | Plugin can't ship rules |
| 7a | Merge **14 canonical `permissions.deny`** rules into `target/.claude/settings.json` | Block `.env` reads, `rm -rf /`, `git push --force` |
| 7b | Merge **9 canonical `permissions.allow` CORE** rules into `target/.claude/settings.json` (ADR-021) | Skip permission prompts for git/npm/node/npx/cd/ls/pwd/which + Skill |
| 7c | Write `extraKnownMarketplaces.kadmon-harness` + `enabledPlugins[...] = true` into user `~/.claude/settings.json` | Auto-register the plugin |
| 8 | Preserve `target/.claude/settings.local.json` if present; else create `{}` template | Respect machine-specific overrides |
| 9 | Append 3 lines to `target/.gitignore` (dedup): `.claude/settings.local.json`, `.claude/agent-memory/`, `dist/` | Avoid committing secrets/artifacts |
| 10 | Write `target/.kadmon-version` with plugin version | Future `install.sh --update` marker |
| 11 | Print post-install checklist | Onboarding |

**Flags** · `--dry-run` (preview without writing) · `--force-permissions-sync` (re-apply deny rules even if target already has entries) · env `KADMON_USER_SETTINGS_PATH` (test-only: redirect plugin registration to a non-default file)

</details>

<details>
<summary>🩹 <strong>Troubleshooting</strong></summary>

**`Host key verification failed`** when using `/plugin marketplace add Kadmon7/kadmon-harness` — use the HTTPS URL shown above. Permanent fix: `ssh -T git@github.com` in terminal, type `yes`.

**`Repository not found`** on the HTTPS URL — verify https://github.com/Kadmon7/kadmon-harness loads in your browser (no auth prompt, the repo is public). If it does, you probably pasted two slash commands on one line — run them separately.

**Hooks don't fire · no `🚀 Kadmon Session Started` banner** — usually an environment issue, not a plugin bug. Check [`docs/runbooks/plugin-troubleshooting.md`](docs/runbooks/plugin-troubleshooting.md) — 6-item ordered checklist (symlinks, Node version, plugin registration, marketplace path, `.kadmon-version`, git remote). The "silent banner" specifically happens when the target has no `git remote origin`: `session-start.js` now emits a visible "no git remote — session tracking disabled" log line instead of exiting silently (fixed 2026-04-21). Verify the plugin is live with `/plugin` in Claude Code.

**Windows: symlinks appear as text files** — Developer Mode is OFF or `core.symlinks=true` was never set. Fix both, then re-clone. Verify with `Get-Item agents,skills,commands | Select LinkType` (should show `SymbolicLink`).

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
/kadmon-harness   → dashboard
/chekpoint        → full reviewer matrix on first change
```

### 🧠 Onboard Claude to the harness (optional but recommended)

Want every Claude session in your project to start knowing the 11 commands, 16 agents, 46 skills, 21 hooks, and orchestration chain? Open Claude Code in your project and paste this:

```
Read https://raw.githubusercontent.com/Kadmon7/kadmon-harness/main/docs/onboarding/reference_kadmon_harness.md and save it as a reference memory in this project. Add a one-line pointer under `## References` in MEMORY.md.
```

Claude will fetch the catalog, detect your project's memory directory, write the file with proper frontmatter, and update the index. One turn, done.

Distribution architecture: [ADR-010](docs/decisions/ADR-010-harness-distribution-hybrid.md) · [ADR-019](docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md).

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
| Tests | **870 passing** (70 files) |
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

## 📊 Status & Attribution

**v1.2 — latest shipped: plan-020 runtime language detection TypeScript + Python (ADR-020, 2026-04-21)**
`870 tests passing` · `70 files` · `21 hooks` · `16 agents` · `46 skills` · `11 commands` · `19 rules` · `7 DB tables`

See [`CHANGELOG.md`](CHANGELOG.md) for the full release history.

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.
