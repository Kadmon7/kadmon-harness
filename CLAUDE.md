# CLAUDE.md — Kadmon Harness

> User-level config at `~/.claude/CLAUDE.md` (identity, language, environment)

## Quick Start
```bash
npm install                        # Install dependencies
npm run build                      # Compile TypeScript → dist/
npx vitest run                     # Run 146+ tests
npx tsx scripts/dashboard.ts       # Show harness dashboard
```

## Core Principle
no_context — if no evidence exists, respond `no_context` and flag what is missing.
Never invent. Never hallucinate.
Enforced by the `no-context-guard` hook on Write/Edit operations.

## Mantra
Observe → Remember → Verify → Specialize → Evolve

| Phase | Components |
|-------|-----------|
| Observe | observe hooks, context-budget, search-first, suggest-compact |
| Remember | session persistence, instinct store, ADRs, /checkpoint, /docs |
| Verify | TDD, code review, security review, quality gates, type checking, no-context-guard |
| Specialize | domain agents, skill catalog, /kplan |
| Evolve | instinct learning, /learn, /refactor-clean, pattern extraction, skill-creator (for all skill work) |

## Stack
- Language: TypeScript / JavaScript (primary)
- Persistence: SQLite (local fast cache, v1) — Supabase planned for v2
- Source of truth: GitHub (Kadmon7/kadmon-harness)
- Runtime: Claude Code CLI on Windows
- MCPs: Supabase (persistence), Context7 (live documentation)
- GitHub: via `gh` CLI (authenticated as Kadmon7, no MCP plugin)

## File Structure
```
scripts/
├── lib/                # Core library (state-store, session-manager, instinct-manager, etc.)
└── dashboard.ts        # CLI dashboard entry point
.claude/
├── hooks/
│   ├── scripts/        # 23 hook scripts (JS)
│   └── pattern-definitions.json
├── rules/
│   ├── common/         # 9 cross-language rules
│   └── typescript/     # 5 TS-specific rules
├── agents/             # 13 agent definitions
├── skills/             # 24 skill documents
└── commands/           # 24 command templates
tests/
├── lib/                # Unit tests for scripts/lib/
├── hooks/              # Hook integration tests
└── eval/               # E2E evaluation tests
docs/
├── GUIDE.md            # User guide (Spanish)
├── HOW-TO-USE.md       # How-to guide (Spanish)
└── REFERENCE.md        # Technical reference
```

## Environment Variables
- `KADMON_TEST_DB` — Override SQLite DB path (used in tests with `:memory:`)
- `KADMON_DISABLED_HOOKS` — Comma-separated hook names to skip (non-critical only)

## Agents (13)
| Agent | Model | Purpose |
|-------|-------|---------|
| architect | opus | System design, architecture decisions |
| planner | opus | Implementation planning, task breakdown |
| code-reviewer | sonnet | Code quality and security review |
| typescript-reviewer | sonnet | TypeScript-specific review |
| database-reviewer | opus | PostgreSQL/Supabase review |
| security-reviewer | opus | Security vulnerability detection |
| tdd-guide | sonnet | Test-driven development workflow |
| build-error-resolver | sonnet | Build/compile error resolution |
| refactor-cleaner | sonnet | Code refactoring |
| docs-lookup | sonnet | Documentation lookup via Context7 |
| doc-updater | sonnet | Codemap and documentation generation |
| e2e-runner | sonnet | E2E testing specialist |
| harness-optimizer | opus | Harness configuration analysis |

## Commands (24)
Defined in `.claude/commands/` — organized by phase:
- **Observe** (3): /dashboard, /kompact, /context-budget
- **Remember** (4): /checkpoint, /docs, /sessions, /update-docs
- **Verify** (8): /tdd, /verify, /build-fix, /code-review, /quality-gate, /test-coverage, /e2e, /eval
- **Specialize** (1): /kplan
- **Evolve** (8): /learn, /learn-eval, /evolve, /instinct-status, /promote, /prune, /instinct-export, /refactor-clean

## Skills (24)
Reusable knowledge documents in `.claude/skills/` referenced by agents during tasks.

| Category | Skills |
|----------|--------|
| Workflow | search-first, explore-before-act, verify-before-commit, strategic-compact, context-budget |
| Quality | coding-standards, security-review, tdd-workflow, verification-loop, e2e-testing |
| Learning | continuous-learning-v2, eval-harness |
| Architecture | agentic-engineering, architecture-decision-records, api-design |
| Data | database-migrations, postgres-patterns, iterative-retrieval, iterative-retrieval-hebrew |
| Integration | claude-api, cost-aware-llm-pipeline, mcp-server-patterns, documentation-lookup |
| Safety | safety-guard |

## Development Workflow
1. Research first (/docs, search-first skill)
2. Plan (/kplan command, planner agent)
3. Test first (/tdd command, tdd-guide agent)
4. Implement (build-error-resolver if needed)
5. Review (/code-review, /verify)
6. Commit (conventional commits via /checkpoint)
7. Skill work (create, edit, optimize, evaluate) → MUST use skill-creator:skill-creator plugin

## Transparency
Three-layer observability — no manual discipline required.

| Layer | Mechanism | Visibility |
|-------|-----------|------------|
| Output | Agent emoji+text labels in output headers (e.g., `## 🏗️ Decision [architect]`) | Always visible |
| Dashboard | `/dashboard` command — instincts, sessions, costs, hook health | On demand |
| Traces | `observations.jsonl` via observe-pre/post hooks | Deep dive |

Each agent defines its own labeled output format in `.claude/agents/*.md`.

## Memory
- **Sessions**: summaries persist to SQLite
- **Instincts**: learned patterns with confidence scoring (0.3→0.9), promotable at confidence ≥0.7 + occurrences ≥3 (manual via /promote)
- **Cost events**: token usage tracked per session
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: project memory in `~/.claude/projects/<project>/memory/` with typed files (6 types: user, feedback, project, reference, decision, gotcha)
- **AutoDream**: enabled — consolidates memory automatically every 24h/5+ sessions
- **MEMORY.md**: index file with budget limits per section (max 200 lines total)
- **Dashboard**: `npx tsx scripts/dashboard.ts` shows instincts, sessions, hook health

## Hook Latency Budget
- observe-pre / observe-post: < 50ms each (file append only)
- no-context-guard: < 100ms (reads observations JSONL)
- All other hooks: < 500ms

## Common Pitfalls
- Database lives at `~/.kadmon/kadmon.db` (NOT `data/harness.db`) — use `path.join(homedir(), '.kadmon', 'kadmon.db')`
- Sessions table uses `id` column (not `session_id`) — check schema with `PRAGMA table_info(sessions)`
- Auto-memory directory is `~/.claude/projects/C--Command-Center-Kadmon-Harness/` (with hyphens, not spaces)
- Lifecycle hooks (session-start, session-end-persist, evaluate-session, cost-tracker) import from `dist/` — run `npm run build` after changing `scripts/lib/` or hooks fail silently
- Hook latency budgets are for hook LOGIC only — Node.js cold start adds ~236ms on Windows, so absolute times appear higher than budgets
- ORDER BY queries need `rowid` tiebreaker for deterministic results when timestamps collide
- evaluate-session.js evaluates 13 pattern definitions from `.claude/hooks/pattern-definitions.json`
- `new URL().pathname` encodes spaces as `%20` — ALWAYS use `fileURLToPath()` for file paths derived from URLs
- Stop hooks only fire on clean session termination — `/kompact`, terminal close, or crashes do NOT trigger them
- `npx tsx -e` produces no output on Windows — use temp script files or `node --input-type=module` with compiled dist/ imports

## Status
v0.2 — Operational (146 tests passing, 23 hooks, 13 agents, 24 skills, 24 commands)
