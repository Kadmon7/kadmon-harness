# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

[![Tests](https://img.shields.io/badge/tests-422%20passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.0-blue)]()
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
| **Specialize** | Domain agents, curated skill catalog | 15 agents, 22 skills, `/abra-kdabra` |
| **Evolve** | Learn from sessions, promote patterns to skills | `/instinct learn`, `/evolve`, `/instinct promote` |

---

## 🚀 Quick Start

```bash
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install
npm run build
```

Start a Claude Code session — Kadmon activates automatically via hooks:

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
/kompas              # Full context rebuild (after compact or session start)
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
│  │ Hooks(8) │  │ Execute  │  │ Hooks(8) │             │
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
│  │ 15 Agents│  │ 22 Skills│  │ 19 Rules │             │
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
| Learn from session | `/instinct learn` |
| Evolve the harness | `/evolve` → alchemik agent (opus) |
| Design architecture | `/abra-kdabra` with design signals → arkitect agent |
| Audit security | `/chekpoint` → spektr agent (opus) |
| Check instincts | `/instinct status` |
| Export instincts | `/instinct export` |
| Refactor code | `/medik clean` → kurator agent (sonnet) |

---

## 📦 What's Inside

| Metric | Value |
|--------|-------|
| Agents | **15** (5 opus, 10 sonnet) |
| Skills | **22** |
| Commands | **12** |
| Hooks | **20** |
| Rules | **19** (9 common + 5 TypeScript + 5 Python) |
| Tests | **422 passing** |
| SQLite Tables | **6** + 14 indexes |
| MCPs | **1 active** (Context7) |
| Plugins | **4 active** |

Full component details are below (collapsed by default). For the operational catalog see [`CLAUDE.md`](CLAUDE.md).

<details>
<summary><strong>15 Agents</strong> — 5 opus + 10 sonnet (click to expand)</summary>

### Opus Agents (5) — complex decisions

| Agent | Role | Purpose | Auto-invokes when... | Manual |
|-------|------|---------|---------------------|--------|
| **arkitect** | Architect | System design, architecture decisions. Produces ADRs. | Never | `/abra-kdabra` |
| **konstruct** | Planner | Breaks down complex tasks into ordered, verifiable steps. | Never | `/abra-kdabra` |
| **spektr** | Security Specialist | Detects injection, XSS, path traversal, secrets. | On auth/keys/exec/SQL | `/chekpoint` |
| **alchemik** | Evolution Analyst | Analyzes hook latency, instinct quality, skill gaps. | Never | `/evolve` |
| **doks** | Doc Sync | Syncs all 4 documentation layers. Behavior-over-counts. | After structural commits | `/doks` |

### Sonnet Agents (10) — implementation and review

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

</details>

<details>
<summary><strong>22 Skills</strong> — domain knowledge loaded on demand</summary>

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
- **eval-harness** — Evaluation framework: EvalCase interface, scoring rubric 1-5

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

</details>

<details>
<summary><strong>12 Commands</strong> — organized by lifecycle phase</summary>

### Observe (3)
| Command | Purpose |
|---------|---------|
| `/kadmon-harness` | System state: instincts, sessions, costs, hook health |
| `/kompact` | Smart compaction; `/kompact audit` audits context window usage |
| `/kompas` | Full context rebuild — search git, memory, SQLite, docs, harness state |

### Plan (1)
| Command | Purpose |
|---------|---------|
| `/abra-kdabra` | Smart planning (arkitect → konstruct → feniks if TDD → kody) |

### Build (1)
| Command | Purpose |
|---------|---------|
| `/medik` | Full harness diagnostic — 7 health checks, repair, cleanup |

### Scan (1)
| Command | Purpose |
|---------|---------|
| `/skanner` | Deep system assessment — performance + E2E workflow tests |

### Remember (3)
| Command | Purpose |
|---------|---------|
| `/chekpoint` | Tiered verification + review + commit + push (full/lite/skip) |
| `/almanak` | Search live documentation (Context7) |
| `/doks` | Sync project documentation with code changes (4-layer) |

### Evolve (3)
| Command | Purpose |
|---------|---------|
| `/akademy` | Evaluate agent/skill quality with structured tests |
| `/instinct` | Manage instinct lifecycle: learn, status, promote, prune, export |
| `/evolve` | Harness self-optimization analysis |

</details>

<details>
<summary><strong>20 Hooks</strong> — by severity (block / warn / observe / verify / lifecycle)</summary>

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
Promoted:   becomes a permanent skill via /instinct promote
```

Example instincts:
```
[█████████░] 0.9  Build after editing TypeScript (14x)  → /instinct promote
[████████░░] 0.8  Re-run tests after fixing failures (12x) → /instinct promote
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
  [█████████░] 0.9  Build after editing TypeScript (14x) → /instinct promote
  [█████████░] 0.9  Re-run tests after fixing failures (14x) → /instinct promote
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

**v1.0 — Production ready**
`422 tests passing` · `20 hooks` · `15 agents` · `22 skills` · `12 commands` · `19 rules` · `6 DB tables`

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.
