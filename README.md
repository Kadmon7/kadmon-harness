# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

`260 tests` | `20 hooks` | `15 agents` | `20 skills` | `14 commands` | `19 rules`

## Mantra

**Observe &rarr; Remember &rarr; Verify &rarr; Specialize &rarr; Evolve**

| Phase | What It Does | Key Components |
|-------|-------------|----------------|
| **Observe** | Watch every tool call, manage context | observe hooks, `/kompact audit`, `/dashboard` |
| **Remember** | Persist sessions, track learned patterns | SQLite, instinct engine, `/checkpoint` |
| **Verify** | Tests first, code review, quality gates | `/ktest`, `/checkpoint`, `/kreview` |
| **Specialize** | Domain agents, curated skill catalog | 15 agents, 20 skills, `/kplan` |
| **Evolve** | Learn from sessions, promote patterns to skills | `/instinct learn`, `/evolve`, `/instinct promote` |

## Quick Start

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

Key commands inside a session:

```bash
/dashboard          # System state: instincts, sessions, costs, hook health
/kplan              # Plan complex tasks (routes to arkitect + konstruct)
/ktest              # Test-driven development cycle
/checkpoint         # Verify + review + commit + push
/kompact            # Smart context compaction
/instinct learn     # Extract patterns from current session
```

---

## Architecture

### Component Flow

```
User runs /command
    |
Command invokes agent (opus or sonnet)
    |
Agent applies relevant skills
    |
PreTool hooks validate before each operation
    |
Claude executes tool (Edit, Bash, etc.)
    |
PostTool hooks verify result (typecheck, lint, quality)
    |
Observe hooks log everything to JSONL
    |
On session end: Stop hooks persist to SQLite
```

### System Diagram

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
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 15 Agents│  │ 20 Skills│  │ 19 Rules │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  Lifecycle: SessionStart → PreCompact → Stop            │
│  Recovery:  Orphan detection on next SessionStart       │
└─────────────────────────────────────────────────────────┘
```

### Stack

| Technology | Role |
|-----------|------|
| TypeScript / Node.js | Primary language, runtime |
| sql.js (WASM) | Local database (SQLite in memory, persisted to disk) |
| Zod | Data validation at system boundaries |
| Claude API | LLM backend (Opus for architecture, Sonnet for implementation) |
| Vitest | Test framework |
| ESLint 9 | Linting with TypeScript support |

---

## Agents (15)

### Opus Agents (6) — complex decisions

| Agent | Purpose | Auto-invokes when... | Manual | Output |
|-------|---------|---------------------|--------|--------|
| **arkitect** | System design, architecture decisions. Produces ADRs. | Never | `/kplan` (architectural tasks) | ADR markdown |
| **konstruct** | Breaks down complex tasks into numbered steps with verification. | Never | `/kplan` (multi-file tasks) | Phased plan S/M/L |
| **database-reviewer** | Reviews SQL, schemas, migrations, Supabase code. Validates RLS, pgvector, sql.js. | On SQL/schema/Supabase edits | -- | Schema/Queries review |
| **security-reviewer** | Detects SQL injection, XSS, command injection, path traversal. Severity CRITICAL/HIGH/MEDIUM/LOW. | On auth/keys/exec/spawn/SQL code | `/checkpoint` | Severity report |
| **alchemik** | Analyzes hook latency, instinct quality, skill gaps, cost trends. Never auto-applies. | Never | `/evolve` | PROMOTE/CREATE/OPTIMIZE report |
| **doktor** | Updates CLAUDE.md, README, component counts. Verifies against filesystem. | Suggested after structural commits | `/kdocs` | Updated file list |

### Sonnet Agents (9) — implementation and review

| Agent | Purpose | Auto-invokes when... | Manual | Output |
|-------|---------|---------------------|--------|--------|
| **kody** | Code quality, strict mode, type safety, Node16 resolution. Severity BLOCK/WARN/NOTE. | On `.ts`/`.tsx` edits, `/checkpoint` | `/kreview`, `/checkpoint` | Review markdown |
| **typescript-reviewer** | TypeScript/JavaScript type safety, async correctness, Node/web security. | On `.ts`/`.tsx`/`.js`/`.jsx` edits | `/kreview`, `/checkpoint` | TypeScript review |
| **feniks** | Guides red-green-refactor cycle. Generates test templates before implementation. | Never | `/ktest` | TypeScript test template |
| **mekanik** | Diagnoses TS2xxx, module resolution, Vitest, sql.js WASM errors. Minimal fix. | On TypeScript/Vitest failures | `/kfix` | Error report |
| **klean** | Identifies dead code, duplication, consolidation opportunities. | Never | `/kfix clean` | Refactoring summary |
| **kronos** | Analyzes O(n^2) loops, slow queries, memory-intensive patterns. | On performance pattern detection | `/kperf` | Performance report |
| **python-reviewer** | Reviews Python code: ML, embeddings, backends. | On `.py` edits | `/kreview`, `/checkpoint` | Python review |
| **almanak** | Searches documentation via Context7 MCP. Fallback to WebSearch. Never invents APIs. | On unfamiliar API references | `/docs` | Signature + example + source |
| **kartograf** | Runs end-to-end tests: session lifecycle, instinct lifecycle, hook chains. Expensive. | Never | `/ktest e2e` | 5 test scenarios |

---

## Skills (20)

### TypeScript / Code Quality

| Skill | What It Teaches |
|-------|----------------|
| **coding-standards** | Naming (camelCase/PascalCase/kebab-case), `node:` prefix imports, .js extensions |
| **api-design** | REST/RPC patterns with Zod schemas, error handling, versioning |
| **claude-api** | Correct Anthropic SDK usage: Messages, Tool Use, streaming |

### Database / Supabase

| Skill | What It Teaches |
|-------|----------------|
| **postgres-patterns** | Indexes, upsert, RLS, pgvector, SQL cheatsheet |
| **database-migrations** | Safe ALTER TABLE, Supabase migrations, rollback strategies |

### Testing

| Skill | What It Teaches |
|-------|----------------|
| **tdd-workflow** | Red-green-refactor cycle, 80%+ coverage, `:memory:` SQLite |
| **e2e-testing** | Mock vs real matrix, lifecycle rules, cleanup patterns |
| **verification-loop** | 6-step pipeline: build, typecheck, test, lint, format, review |
| **eval-harness** | Evaluation framework: EvalCase interface, scoring rubric 1-5, criteria |

### Research / Documentation

| Skill | What It Teaches |
|-------|----------------|
| **search-first** | Search existing codebase before writing new code |
| **architecture-decision-records** | ADR templates, lifecycle, Decision/Context/Options format |

### Harness Meta-Skills

| Skill | What It Teaches |
|-------|----------------|
| **safety-guard** | 3 protection layers: block-no-verify, config-protection, no-context-guard |
| **context-budget** | Context window management, when to compact |
| **continuous-learning-v2** | Instinct lifecycle: create, reinforce, contradict, promote, prune |
| **mcp-server-patterns** | MCP configuration, health checks, secrets management |
| **orchestration-patterns** | Context-rich dispatch, parallel agents, plan execution via subagents |
| **systematic-debugging** | Structured diagnosis: reproduce, isolate, hypothesize, verify |
| **receiving-code-review** | Receiving and applying code review feedback, prioritizing findings |

### Domain-Specific

| Skill | What It Teaches |
|-------|----------------|
| **iterative-retrieval** | 4-phase RAG loop: dispatch, evaluate, refine, loop. pgvector patterns. |
| **iterative-retrieval-hebrew** | Hebrew/Aramaic RAG: Pesukim, Sugya, Rashi/Ramban, multilingual embeddings |

---

## Commands (14)

### Observe (3)

| Command | Purpose | Example |
|---------|---------|---------|
| `/dashboard` | System state: instincts, sessions, costs, hook health | `/dashboard` |
| `/kompact` | Smart compaction; `/kompact audit` audits context window usage | `/kompact audit` |
| `/kompas` | Full context rebuild — search git, memory, SQLite, docs, harness state | `/kompas` |

### Remember (3)

| Command | Purpose | Example |
|---------|---------|---------|
| `/checkpoint` | Full verification + intelligent review + commit + push | `/checkpoint` |
| `/docs` | Search live documentation (Context7) | `/docs supabase-js insert` |
| `/kdocs` | Sync project documentation with code changes (4-layer) | `/kdocs` |

### Verify (5)

| Command | Purpose | Example |
|---------|---------|---------|
| `/ktest` | TDD + coverage + E2E testing pipeline | `/ktest implement pruneInstincts` |
| `/kfix` | Diagnose build errors + refactor cleanup | `/kfix` |
| `/kreview` | Quick language-aware code review | `/kreview` |
| `/kperf` | Performance analysis and optimization | `/kperf hooks` |
| `/eval` | Evaluate agent/skill quality with structured tests | `/eval security-reviewer` |

### Specialize (1)

| Command | Purpose | Example |
|---------|---------|---------|
| `/kplan` | Smart planning (arkitect -> konstruct -> approval gate) | `/kplan migrate state to Supabase` |

### Evolve (2)

| Command | Purpose | Example |
|---------|---------|---------|
| `/instinct` | Manage instinct lifecycle: `learn`, `status`, `promote`, `prune`, `export`, `eval` | `/instinct learn` |
| `/evolve` | Harness self-optimization analysis | `/evolve` |

---

## Hooks (20)

### Security — block dangerous operations (exit 2)

| Hook | Event | Matcher | What It Does |
|------|-------|---------|-------------|
| **block-no-verify** | PreToolUse | Bash | Blocks `--no-verify` and `--no-gpg-sign` in git commands |
| **commit-format-guard** | PreToolUse | Bash | Blocks commits without conventional format (`type(scope): desc`) |
| **commit-quality** | PreToolUse | Bash | Scans staged changes for console.log, debugger, secrets |
| **config-protection** | PreToolUse | Edit\|Write | Blocks edits to critical config files (tsconfig, eslint, settings.json) |
| **no-context-guard** | PreToolUse | Edit\|Write | Blocks Edit/Write without prior Read of the file |

### Warning — suggest but allow (exit 1)

| Hook | Event | Matcher | What It Does |
|------|-------|---------|-------------|
| **git-push-reminder** | PreToolUse | Bash | Reminds to run `/checkpoint` before git push |
| **ts-review-reminder** | PostToolUse | Edit\|Write | Warns after 5+ `.ts` edits without code review |
| **console-log-warn** | PostToolUse | Edit\|Write | Warns about `console.log()` in production code |
| **deps-change-reminder** | PostToolUse | Edit\|Write | Reminds to run `/docs` when package.json dependencies change |

### Observation — log everything (exit 0)

| Hook | Event | Matcher | What It Does |
|------|-------|---------|-------------|
| **observe-pre** | PreToolUse | all | Logs tool invocation to JSONL; captures Agent, TaskCreate, TaskUpdate metadata |
| **observe-post** | PostToolUse | all | Logs tool result to JSONL; captures error messages on failures |

### Post-edit — verify after changes

| Hook | Event | What It Does |
|------|-------|-------------|
| **post-edit-format** | PostToolUse | Auto-formats edited files with Prettier |
| **post-edit-typecheck** | PostToolUse | Runs `tsc --noEmit` on edited `.ts`/`.tsx` files |
| **quality-gate** | PostToolUse | Runs ESLint on edited files |
| **pr-created** | PostToolUse | Detects PR creation and logs URL |

### Session lifecycle

| Hook | Event | What It Does |
|------|-------|-------------|
| **session-start** | SessionStart | Initializes session: loads 3 recent sessions, shows history, "Pending Work" carry-forward, recovers orphaned sessions |
| **pre-compact-save** | PreCompact | Saves session state and pending tasks before context compaction |
| **session-end-all** | Stop | Consolidated: persist session + evaluate patterns + track cost + write marker + daily log |

### MCP monitoring

| Hook | Event | What It Does |
|------|-------|-------------|
| **mcp-health-check** | PreToolUse (mcp__) | Validates MCP server health before calls |
| **mcp-health-failure** | PostToolUseFailure (mcp__) | Logs MCP server failures for diagnostics |

---

## Rules (19)

### Common Rules (9) — always loaded

| File | What It Enforces | Enforced By |
|------|-----------------|-------------|
| **agents.md** | Model routing (opus/sonnet), when to invoke agents | Built-in routing |
| **coding-style.md** | Naming, types, imports | post-edit-typecheck, quality-gate |
| **development-workflow.md** | Research->Plan->Test->Implement->Review->Commit order | no-context-guard, block-no-verify |
| **git-workflow.md** | Conventional commits, never force push, never --no-verify | block-no-verify, config-protection |
| **hooks.md** | Hook catalog (20 entries), exit codes, latency budgets | Self-documenting |
| **patterns.md** | Dependency injection, no global state, context in errors | no-context-guard |
| **performance.md** | No files > 50KB, batch SQLite ops, lazy loading | cost-tracker |
| **security.md** | No secrets in git, Zod for input, parameterized SQL | security-reviewer, config-protection |
| **testing.md** | 80%+ coverage, `:memory:` SQLite, Vitest, TDD | feniks, post-edit-typecheck |

### TypeScript Rules (5) — loaded on `.ts`/`.tsx` files

| File | What It Enforces | Enforced By |
|------|-----------------|-------------|
| **coding-style.md** | Strict mode, .js extensions, `import type` | kody |
| **hooks.md** | parseStdin(), lifecycle hooks from dist/, `npm run build` | post-edit-typecheck |
| **patterns.md** | Result pattern, Zod schemas, `catch (e: unknown)` | kody |
| **security.md** | Branded types, path.resolve(), parameterized queries | security-reviewer |
| **testing.md** | vi.fn(), mock externals, close DB in afterEach | feniks |

### Python Rules (5) — loaded on `.py`/`.pyi` files

| File | What It Enforces | Enforced By |
|------|-----------------|-------------|
| **coding-style.md** | PEP 8, naming, type annotations, black/ruff/isort | python-reviewer |
| **hooks.md** | Python PostToolUse hooks (black/ruff, mypy/pyright) | python-reviewer |
| **patterns.md** | Protocol, dataclasses, context managers, error handling | python-reviewer |
| **security.md** | Secret management, subprocess safety, deserialization | python-reviewer, security-reviewer |
| **testing.md** | pytest, fixtures, parametrize, 80%+ coverage | python-reviewer, feniks |

---

## Contexts (3)

| Context | When to Activate | Priorities |
|---------|-----------------|------------|
| **dev.md** | Active development — implementing features, fixing bugs | Working -> Right -> Clean |
| **research.md** | Research and exploration — understanding code, searching APIs | Understand -> Explore -> Hypothesis -> Verify |
| **review.md** | Code review — reviewing PRs, auditing code | Security -> Correctness -> Performance -> Readability |

---

## Session Lifecycle

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

---

## Instinct System

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

---

## Database (SQLite)

### Location

```
~/.kadmon/kadmon.db     # Persistent data (sessions, instincts, costs)
$TMPDIR/kadmon/{sid}/   # Ephemeral observations (JSONL per session)
```

### Tables

#### sessions

| Column | Type | Description |
|--------|------|------------|
| id | TEXT PK | Session UUID |
| project_hash | TEXT | SHA256 hash of project (first 16 chars) |
| started_at / ended_at | TEXT | ISO 8601 timestamps |
| duration_ms | INTEGER | Duration in milliseconds |
| branch | TEXT | Active git branch |
| tasks | TEXT (JSON) | Array of tasks performed |
| files_modified | TEXT (JSON) | Array of modified files |
| tools_used | TEXT (JSON) | Array of tools used |
| message_count | INTEGER | Messages exchanged |
| total_input/output_tokens | INTEGER | Tokens consumed |
| estimated_cost_usd | REAL | Estimated cost |
| instincts_created | TEXT (JSON) | Instincts generated in this session |
| compaction_count | INTEGER | Context compaction count |

#### instincts

| Column | Type | Description |
|--------|------|------------|
| id | TEXT PK | Instinct UUID |
| project_hash | TEXT | Associated project |
| pattern | TEXT | The learned pattern |
| action | TEXT | Associated action |
| confidence | REAL (0-1) | Confidence (starts at 0.3, +0.1 per reinforcement, max 0.9) |
| occurrences | INTEGER | Times observed |
| contradictions | INTEGER | Times contradicted |
| source_sessions | TEXT (JSON) | Sessions where observed |
| status | TEXT | 'active', 'promoted', 'contradicted', 'archived' |
| scope | TEXT | 'project' (local) or 'global' (system-wide) |
| promoted_to | TEXT | Reference to skill if promoted |

#### cost_events

| Column | Type | Description |
|--------|------|------------|
| id | TEXT PK | Event UUID |
| session_id | TEXT FK | Associated session |
| model | TEXT | Model used (opus/sonnet/haiku) |
| input_tokens / output_tokens | INTEGER | Input/output tokens |
| estimated_cost_usd | REAL | Estimated cost |

#### sync_queue

Sync queue for future cloud persistence (Supabase v2).

| Column | Type | Description |
|--------|------|------------|
| id | INTEGER PK | Autoincrement |
| table_name | TEXT | Source table |
| record_id | TEXT | Record ID |
| operation | TEXT | 'insert', 'update', 'delete' |
| payload | TEXT (JSON) | Serialized data |
| synced_at | TEXT | NULL = pending |

---

## scripts/lib (10 files)

| File | Lines | Key Exports | Purpose |
|------|-------|------------|---------|
| **state-store.ts** | 387 | `openDb()`, `closeDb()`, `upsertSession()`, `upsertInstinct()`, `insertCostEvent()` | SQLite persistence layer. Converts camelCase <-> snake_case. |
| **dashboard.ts** | 212 | `renderDashboard()`, `getInstinctRows()`, `getHookHealthRows()` | CLI dashboard renderer with ANSI colors. |
| **instinct-manager.ts** | 117 | `createInstinct()`, `reinforceInstinct()`, `contradictInstinct()`, `promoteInstinct()`, `pruneInstincts()` | Instinct lifecycle: create, reinforce, contradict, promote, prune. |
| **types.ts** | 109 | `Instinct`, `SessionSummary`, `ObservabilityEvent`, `CostEvent`, `ProjectInfo` | TypeScript interfaces for all data models. |
| **session-manager.ts** | 80 | `startSession()`, `endSession()`, `getLastSession()`, `loadSessionContext()` | Session lifecycle: create, end, load previous context. |
| **utils.ts** | 54 | `nowISO()`, `generateId()`, `hashString()`, `kadmonDataDir()`, `formatDuration()` | Utilities: timestamps, UUIDs, SHA256 hashing, paths. |
| **cost-calculator.ts** | 41 | `calculateCost()`, `formatCost()` | LLM cost calculation per model and tokens. |
| **project-detect.ts** | 29 | `detectProject()` | Detects git project: remote URL, branch, root dir, project hash. |
| **schema.sql** | 73 | -- | SQL schema: 4 tables + 8 indexes. Applied on DB init. |
| **sql.js.d.ts** | 28 | `Database`, `Statement`, `SqlJsStatic` | Type definitions for sql.js (WASM SQLite). |

---

## Tests (260)

Framework: Vitest. All database tests use `:memory:` SQLite.

```bash
npx vitest run                                # All tests
npx vitest run --watch                        # Watch mode
npx vitest run tests/lib/state-store.test.ts  # Specific file
```

| Category | Files | What They Verify |
|----------|-------|-----------------|
| Hook tests | 20 | All 20 hooks (block-no-verify, commit-format-guard, commit-quality, config-protection, console-log-warn, deps-change-reminder, git-push-reminder, mcp-health, no-context-guard, observe-pre, observe-post, post-edit-format, post-edit-typecheck, pr-created, pre-compact-save, quality-gate, session-end-all, session-start, ts-review-reminder) |
| Library tests | 8 | dashboard, utils, instinct-manager, state-store, cost-calculator, session-manager, project-detect, pattern-engine |
| E2E tests | 1 | instinct-lifecycle end-to-end |
| Other | 1 | global-teardown |

---

## Plugins (5 active)

| Plugin | Type | Value | What It Adds |
|--------|------|-------|-------------|
| **context7** | MCP Server | CRITICAL | Live library documentation via `resolve-library-id` + `query-docs` |
| **skill-creator** | Skill Plugin | CRITICAL | Create, modify, evaluate, and benchmark skills |
| **supabase** | MCP Server | MEDIUM | Supabase integration: DB, auth, storage, edge functions, migrations (standby for v2) |
| **frontend-design** | Skill Plugin | LOW | Production-grade frontend interfaces with distinctive design |
| **ralph-loop** | Skill Plugin | LOW | Recurring execution loop (ralph-loop, cancel-ralph, help) |

---

## MCPs (3)

| MCP | Type | What It Enables | Used By |
|-----|------|----------------|---------|
| **GitHub** | HTTP | Search code, create PRs/issues, read files, commits, reviews | kody, doktor |
| **Context7** | Command (`npx -y @upstash/context7-mcp`) | Live documentation for any library | almanak agent, `/docs` |
| **Supabase** | HTTP | DB operations, auth, storage, edge functions, migrations, SQL | database-reviewer, arkitect |

Health monitored by `mcp-health-check` (PreToolUse) and `mcp-health-failure` (PostToolUseFailure).

---

## Schemas (3)

JSON Schema (draft 2020-12) files in `schemas/`:

| Schema | Validates | Used By |
|--------|----------|---------|
| **instinct.schema.json** | Instinct: confidence [0,1], occurrences >= 0, status enum | instinct-manager |
| **session.schema.json** | SessionSummary: ID, project_hash, ISO 8601 timestamps | session-manager |
| **observability.schema.json** | ObservabilityEvent: event_type enum (tool_pre/tool_post/tool_fail/compaction/hook) | observe hooks |

---

## Configuration (settings.json)

Central configuration file. Controls:

**Hooks:** Registers all 20 hooks with event, matcher, and command. Pattern:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "PATH=\"$PATH:/c/Program Files/nodejs\" node .claude/hooks/scripts/block-no-verify.js"
          }
        ]
      }
    ]
  }
}
```

**Permissions deny:** Protects sensitive files from reading:
```json
"deny": ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)"]
```

---

## Root Files

| File | Purpose |
|------|---------|
| **CLAUDE.md** | Document Claude reads at session start. Defines: identity, stack, agents, commands, skills, workflow, memory, hooks, status. |
| **README.md** | This file — complete project reference for GitHub. |
| **package.json** | ES Module. Dependencies: sql.js, zod. Scripts: build, test, typecheck, lint. Node >= 18. |
| **tsconfig.json** | Target ES2022, module Node16, strict mode. Compiles scripts/ and tests/ to dist/. |
| **eslint.config.js** | ESLint 9 with TypeScript plugin. Applies to scripts/ and tests/. Errors on `any`, warns on unused vars. |
| **vitest.config.ts** | Vitest config. Sets `KADMON_TEST_DB=:memory:` as global safety net. |
| **.gitignore** | Excludes: node_modules, dist, .env*, .db, logs, OS artifacts. |

---

## Quick Reference

### What do I use for...?

| Situation | Component |
|-----------|-----------|
| Plan a new task | `/kplan` -> konstruct agent (opus) |
| Do TDD | `/ktest` -> feniks agent (sonnet) |
| Review code before commit | `/checkpoint` -> 5 reviewers + kody consolidation |
| Check harness state | `/dashboard` |
| Look up API documentation | `/docs supabase-js insert` -> almanak + Context7 MCP |
| Fix build errors | `/kfix` -> mekanik agent |
| Learn from session | `/instinct learn` |
| Evolve the harness | `/evolve` -> alchemik agent (opus) |
| Design UI | `/kplan` with design signals -> arkitect agent |
| Audit security | `/checkpoint` -> security-reviewer agent (opus) |
| Check instincts | `/instinct status` |
| Export instincts | `/instinct export` |
| Refactor code | `/kfix clean` -> klean agent (sonnet) |

### Key Numbers

| Metric | Value |
|--------|-------|
| Agents | 15 (6 opus, 9 sonnet) |
| Skills | 20 |
| Commands | 14 |
| Hooks | 20 |
| Rules | 19 (9 common + 5 TypeScript + 5 Python) |
| Tests | 260 passing |
| SQLite Tables | 4 + 8 indexes |
| MCPs | 3 (GitHub, Context7, Supabase) |
| Plugins | 5 active |

---

## Dashboard

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

## Windows Compatibility

- Shared `parseStdin()` helper sanitizes unescaped backslashes in hook stdin
- `PATH` prefix ensures Node.js resolution in Git Bash
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var
- MCP servers use `cmd /c npx` wrapper

## Attribution

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.

## Status

v0.3.3 — Python stack (260 tests passing, 20 hooks, 15 agents, 20 skills, 14 commands, 19 rules)
