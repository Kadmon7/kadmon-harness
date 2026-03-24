# Prompt 2 Output — Kadmon Harness v1 Design

## Date
2026-03-23

## Architect Decisions Applied

| Decision | Ruling |
|----------|--------|
| Persistence | SQLite (local cache) + Supabase (queryable source of truth) |
| tmux | DROP completely |
| Windows hooks | Node.js only. No .sh, no bash, no /tmp/. Use os.tmpdir(). |
| Python | Omitted from v1. instinct-cli.py → TypeScript. |
| O.L.A.M. | Out of scope for v1 |
| n8n | Zero |
| Hook profiles | Single "Kadmon" profile |
| Docker | OPTIONAL — not in v1 |
| ToratNetz RAG | Project-level. Harness carries iterative-retrieval only. |
| no_context enforcement | NEW PreToolUse hook on Write/Edit |

---

## 1. Final Component List

### 1.1 Agents (10)

| Agent | Model | Mantra | Role |
|-------|-------|--------|------|
| architect | opus | Specialize | System design, architecture decisions, ADRs |
| planner | opus | Observe+Specialize | Implementation planning, task decomposition |
| code-reviewer | sonnet | Verify | Code quality, conventions, no_context enforcement |
| typescript-reviewer | sonnet | Verify | TypeScript-specific: strict types, patterns, generics |
| database-reviewer | sonnet | Verify+Specialize | PostgreSQL/Supabase schema, queries, RLS |
| security-reviewer | sonnet | Verify | Vulnerability detection, dependency audit |
| tdd-guide | sonnet | Verify | Red-green-refactor workflow |
| build-error-resolver | sonnet | Verify | Build/compile error diagnosis and fixes |
| refactor-cleaner | sonnet | Evolve | Dead code, duplication, structural improvement |
| docs-lookup | sonnet | Remember | Documentation retrieval via Context7 MCP |

### 1.2 Skills (19)

| Skill | Mantra | Purpose |
|-------|--------|---------|
| agentic-engineering | Specialize | AI-first dev methodology (merged from ai-first-engineering) |
| api-design | Specialize | RESTful/RPC API design patterns |
| architecture-decision-records | Remember | ADR discipline, template, lifecycle |
| claude-api | Specialize | Claude API usage patterns |
| coding-standards | Specialize | General coding standards |
| context-budget | Observe | Context window management strategy |
| continuous-learning | Evolve | Instinct observation, extraction, promotion |
| cost-aware-llm-pipeline | Specialize | Token cost optimization |
| database-migrations | Specialize | Supabase migration patterns |
| documentation-lookup | Remember | How to find and verify documentation |
| iterative-retrieval | Specialize | RAG retrieval patterns (CORE for ToratNetz) |
| mcp-server-patterns | Specialize | Building and consuming MCP servers |
| postgres-patterns | Specialize | PostgreSQL best practices, pgvector |
| safety-guard | Verify | Destructive operation prevention |
| search-first | Observe | Research-before-code methodology |
| security-review | Verify | Security review patterns |
| strategic-compact | Observe | When and how to compact context |
| tdd-workflow | Verify | TDD methodology and patterns |
| verification-loop | Verify | Multi-step verification methodology |

### 1.3 Commands (12)

| Command | Mantra | What It Does |
|---------|--------|--------------|
| /plan | Observe | Invoke planner agent for implementation planning |
| /tdd | Verify | Start TDD cycle: write test, implement, verify |
| /verify | Verify | Run full verification loop (types, tests, lint) |
| /build-fix | Verify | Diagnose and fix build errors |
| /code-review | Verify | Invoke code-reviewer agent on staged changes |
| /quality-gate | Verify | Run quality checks (format, lint, types, tests) |
| /test-coverage | Verify | Check and report test coverage |
| /checkpoint | Remember | Git commit + session state save |
| /docs | Remember | Lookup documentation via Context7 |
| /context-budget | Observe | Audit current context window usage |
| /refactor-clean | Evolve | Invoke refactor-cleaner agent |
| /learn | Evolve | Extract patterns from current session into instincts |

### 1.4 Hooks (17)

See Section 3 for detailed design.

### 1.5 Rules (14 files)

**common/ (9):** agents, coding-style, development-workflow, git-workflow, hooks, patterns, performance, security, testing

**typescript/ (5):** coding-style, hooks, patterns, security, testing

### 1.6 Contexts (3)

| Context | Mantra | Behavior |
|---------|--------|----------|
| dev | Specialize | Code first, all hooks active, full verification |
| research | Observe | Read widely, relaxed write guards, search-first emphasis |
| review | Verify | Code analysis, severity-based findings |

### 1.7 MCPs (3)

| MCP | Status | Purpose |
|-----|--------|---------|
| github | Configured | Source of truth for code |
| supabase | Configured | Persistence layer |
| context7 | To configure | Documentation lookup, prevents hallucination |

---

## 2. Schemas

### 2.1 TypeScript Interfaces

```typescript
// ─── Instinct Store ───

interface Instinct {
  id: string;                    // UUID
  project_hash: string;          // SHA-256 of git remote URL
  pattern: string;               // What was observed (e.g., "always runs tsc after edit")
  action: string;                // What to do (e.g., "run tsc --noEmit after TypeScript edits")
  confidence: number;            // 0.0-1.0 (starts at 0.3, +0.1 per occurrence, max 0.9)
  occurrences: number;           // Times pattern was seen
  contradictions: number;        // Times pattern was contradicted
  source_sessions: string[];     // Session IDs that contributed
  status: 'active' | 'promoted' | 'contradicted' | 'archived';
  scope: 'project' | 'global';  // Project-scoped or cross-project
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
  promoted_to?: string;          // Skill/command name if promoted
}

// Lifecycle:
// 1. Created: confidence=0.3, occurrences=1, status='active'
// 2. Reinforced: confidence += 0.1, occurrences++
// 3. Contradicted: contradictions++; if contradictions > occurrences → status='contradicted'
// 4. Promotable: confidence >= 0.7 AND occurrences >= 3 AND status='active'
// 5. Promoted: status='promoted', promoted_to='skill-name'
// 6. Archived: manually or when contradictions dominate

// ─── Session Summary ───

interface SessionSummary {
  id: string;                    // Claude session_id
  project_hash: string;          // SHA-256 of git remote URL
  started_at: string;            // ISO 8601
  ended_at: string;              // ISO 8601
  duration_ms: number;
  branch: string;
  tasks: string[];               // Summary of tasks performed
  files_modified: string[];      // Files changed during session
  tools_used: string[];          // Unique tool names used
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  instincts_created: string[];   // Instinct IDs created/updated
  compaction_count: number;      // Times context was compacted
}

// ─── Observability Event (ephemeral, per-session JSONL) ───

interface ObservabilityEvent {
  timestamp: string;             // ISO 8601
  session_id: string;
  event_type: 'tool_pre' | 'tool_post' | 'tool_fail' | 'compaction' | 'hook';
  tool_name: string;
  file_path?: string;            // If tool operates on a file
  success?: boolean;             // For tool_post events
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}
```

### 2.2 Supabase SQL Schema

```sql
-- ─── Sessions ───
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_hash TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  branch TEXT,
  tasks JSONB DEFAULT '[]',
  files_modified JSONB DEFAULT '[]',
  tools_used JSONB DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4) DEFAULT 0,
  instincts_created JSONB DEFAULT '[]',
  compaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Instincts ───
CREATE TABLE instincts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_hash TEXT NOT NULL,
  pattern TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.30,
  occurrences INTEGER NOT NULL DEFAULT 1,
  contradictions INTEGER NOT NULL DEFAULT 0,
  source_sessions JSONB DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'promoted', 'contradicted', 'archived')),
  scope TEXT NOT NULL DEFAULT 'project'
    CHECK (scope IN ('project', 'global')),
  promoted_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Cost Events ───
CREATE TABLE cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd NUMERIC(10,6) NOT NULL
);

-- ─── Indexes ───
CREATE INDEX idx_sessions_project ON sessions(project_hash);
CREATE INDEX idx_sessions_started ON sessions(started_at DESC);
CREATE INDEX idx_instincts_project ON instincts(project_hash);
CREATE INDEX idx_instincts_status ON instincts(status);
CREATE INDEX idx_instincts_confidence ON instincts(confidence DESC);
CREATE INDEX idx_cost_events_session ON cost_events(session_id);
CREATE INDEX idx_cost_events_timestamp ON cost_events(timestamp DESC);
```

### 2.3 SQLite Local Schema

```sql
-- Mirrors Supabase but with SQLite types
-- Same tables: sessions, instincts, cost_events
-- Plus sync queue (SQLite only):

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  payload TEXT NOT NULL,  -- JSON string
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;
```

---

## 3. Hooks Design (17 hooks)

### PreToolUse (7)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 1 | block-no-verify | Bash | Blocks `--no-verify`, `--no-gpg-sign` flags on git commands. Exits 2 if found. | YES |
| 2 | git-push-reminder | Bash | Prints reminder to review before `git push`. Exit 0 (non-blocking). | YES |
| 3 | suggest-compact | * | Checks context usage from a local counter file. Suggests `/compact` if >70%. Sub-50ms target. | YES |
| 4 | config-protection | Edit,Write | Blocks weakening of `.eslintrc*`, `.prettierrc*`, `tsconfig.json`. Exits 2 if dangerous patterns detected. | YES |
| 5 | mcp-health-check | mcp__* | Reads local health status file. Warns if MCP recently failed. Exit 0. | YES |
| 6 | observe-pre | * | Appends tool call metadata to session JSONL at `os.tmpdir()/kadmon/<session-id>/observations.jsonl`. Fast file append, no DB. | YES |
| 7 | **no-context-guard** (NEW) | Write,Edit | Reads observations JSONL to check if target file/directory was Read/Grep/Glob'd. Exits 2 if no research found. Exceptions: test files (`*.test.ts`, `*.spec.ts`), markdown files, files already read, files in already-explored directories. Override: `KADMON_NO_CONTEXT_GUARD=off`. | YES |

### PostToolUse (4)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 8 | quality-gate | Edit,Write | Runs ESLint check on `.ts`/`.js` files. Reports errors. Exit 0. | YES |
| 9 | post-edit-format | Edit,Write | Runs `npx prettier --write <file>` on `.ts`/`.js`/`.json` files. | YES |
| 10 | post-edit-typecheck | Edit,Write | Runs `npx tsc --noEmit` after `.ts` edits. Reports type errors. Exit 0. | YES |
| 11 | observe-post | * | Appends tool result metadata (success/failure) to observations JSONL. Same fast-append as observe-pre. | YES |

### PostToolUseFailure (1)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 12 | mcp-health-failure | mcp__* | Writes failure record to health status file. Used by mcp-health-check. | YES |

### PreCompact (1)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 13 | pre-compact-save | * | Summarizes current observations, writes state to SQLite, increments compaction count. | YES |

### SessionStart (1)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 14 | session-start | * | Detects project (git remote hash), loads last session summary from SQLite, loads active instincts, creates session observations directory. Injects context. | YES |

### Stop (3)

| # | Name | Matcher | What It Does | Windows-Safe |
|---|------|---------|-------------|-------------|
| 15 | session-end-persist | * | Reads observations JSONL, computes SessionSummary, writes to SQLite, queues async Supabase sync. | YES |
| 16 | evaluate-session | * | Extracts recurring patterns from observations, creates/updates Instinct records in SQLite, queues sync. | YES |
| 17 | cost-tracker | * | Calculates token costs per model, writes to SQLite cost_events, queues sync. | YES |

**All 17 hooks: Windows-safe = YES. Node.js only. No bash, no /tmp/.**

---

## 4. CLAUDE.md Design

```markdown
# CLAUDE.md — Kadmon Harness

## Identity
- Architect: Ych118 (final decisions always mine)
- Implementer: Claude Code (senior, proactive, opinionated)
- Language: respond in Spanish, write all code and files in English

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
| Specialize | domain agents, skill catalog, /plan |
| Evolve | instinct learning, /learn, /refactor-clean, pattern extraction |

## Stack
- Language: TypeScript / JavaScript (primary)
- Persistence: SQLite (local fast cache) + Supabase (Postgres + pgvector, queryable source of truth)
- Source of truth: GitHub (Kadmon7/kadmon-harness)
- Runtime: Claude Code CLI on Windows
- Sync strategy: SQLite writes are synchronous. Supabase writes are async, best-effort, with retry queue.

## Active Projects
- **ToratNetz** — Torah RAG system (Supabase + pgvector)
- **UNIVERSO KAIRON** — AI companion universe

## Agents
| Agent | Model | Purpose |
|-------|-------|---------|
| architect | opus | System design, architecture decisions |
| planner | opus | Implementation planning, task breakdown |
| code-reviewer | sonnet | Code quality and security review |
| typescript-reviewer | sonnet | TypeScript-specific review |
| database-reviewer | sonnet | PostgreSQL/Supabase review |
| security-reviewer | sonnet | Security vulnerability detection |
| tdd-guide | sonnet | Test-driven development workflow |
| build-error-resolver | sonnet | Build/compile error resolution |
| refactor-cleaner | sonnet | Code refactoring |
| docs-lookup | sonnet | Documentation lookup via Context7 |

## Commands
| Command | Phase | Purpose |
|---------|-------|---------|
| /plan | Observe | Plan before implementing |
| /tdd | Verify | Test-driven development cycle |
| /verify | Verify | Run verification loop |
| /build-fix | Verify | Fix build errors |
| /code-review | Verify | Run code review |
| /quality-gate | Verify | Run quality checks |
| /test-coverage | Verify | Check test coverage |
| /checkpoint | Remember | Save progress + git commit |
| /docs | Remember | Lookup documentation |
| /context-budget | Observe | Audit context window |
| /refactor-clean | Evolve | Refactor code |
| /learn | Evolve | Extract session patterns |

## Development Workflow
1. Research first (/docs, search-first skill)
2. Plan (/plan command, planner agent)
3. Test first (/tdd command, tdd-guide agent)
4. Implement (build-error-resolver if needed)
5. Review (/code-review, /verify)
6. Commit (conventional commits via /checkpoint)

## Memory
- **Sessions**: summaries persist to SQLite + sync to Supabase
- **Instincts**: learned patterns with confidence scoring (0.3→0.9), auto-promoted at confidence ≥0.7
- **Cost events**: token usage tracked per session
- **Observations**: ephemeral JSONL per session, summarized at session end

## Hook Latency Budget
- observe-pre / observe-post: < 50ms each (file append only)
- no-context-guard: < 100ms (reads observations JSONL)
- All other hooks: < 500ms

## Status
Phase 2 — Design complete, scaffold pending (Prompt 3)
```

---

## 5. Repo Structure

```
kadmon-harness/
├── CLAUDE.md
├── README.md
├── .gitignore
├── package.json
├── tsconfig.json
├── agents/
│   ├── architect.md
│   ├── build-error-resolver.md
│   ├── code-reviewer.md
│   ├── database-reviewer.md
│   ├── docs-lookup.md
│   ├── planner.md
│   ├── refactor-cleaner.md
│   ├── security-reviewer.md
│   ├── tdd-guide.md
│   └── typescript-reviewer.md
├── skills/
│   ├── agentic-engineering.md
│   ├── api-design.md
│   ├── architecture-decision-records.md
│   ├── claude-api.md
│   ├── coding-standards.md
│   ├── context-budget.md
│   ├── continuous-learning.md
│   ├── cost-aware-llm-pipeline.md
│   ├── database-migrations.md
│   ├── documentation-lookup.md
│   ├── iterative-retrieval.md
│   ├── mcp-server-patterns.md
│   ├── postgres-patterns.md
│   ├── safety-guard.md
│   ├── search-first.md
│   ├── security-review.md
│   ├── strategic-compact.md
│   ├── tdd-workflow.md
│   └── verification-loop.md
├── commands/
│   ├── build-fix.md
│   ├── checkpoint.md
│   ├── code-review.md
│   ├── context-budget.md
│   ├── docs.md
│   ├── learn.md
│   ├── plan.md
│   ├── quality-gate.md
│   ├── refactor-clean.md
│   ├── tdd.md
│   ├── test-coverage.md
│   └── verify.md
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── block-no-verify.js
│       ├── config-protection.js
│       ├── cost-tracker.js
│       ├── evaluate-session.js
│       ├── git-push-reminder.js
│       ├── mcp-health-check.js
│       ├── mcp-health-failure.js
│       ├── no-context-guard.js
│       ├── observe-post.js
│       ├── observe-pre.js
│       ├── post-edit-format.js
│       ├── post-edit-typecheck.js
│       ├── pre-compact-save.js
│       ├── quality-gate.js
│       ├── session-end-persist.js
│       ├── session-start.js
│       └── suggest-compact.js
├── rules/
│   ├── common/
│   │   ├── agents.md
│   │   ├── coding-style.md
│   │   ├── development-workflow.md
│   │   ├── git-workflow.md
│   │   ├── hooks.md
│   │   ├── patterns.md
│   │   ├── performance.md
│   │   ├── security.md
│   │   └── testing.md
│   └── typescript/
│       ├── coding-style.md
│       ├── hooks.md
│       ├── patterns.md
│       ├── security.md
│       └── testing.md
├── contexts/
│   ├── dev.md
│   ├── research.md
│   └── review.md
├── scripts/
│   └── lib/
│       ├── state-store.ts
│       ├── supabase-sync.ts
│       ├── instinct-manager.ts
│       ├── session-manager.ts
│       ├── cost-calculator.ts
│       ├── project-detect.ts
│       └── utils.ts
├── schemas/
│   ├── instinct.schema.json
│   ├── session.schema.json
│   └── observability.schema.json
├── tests/
│   ├── hooks/
│   │   └── .gitkeep
│   └── lib/
│       └── .gitkeep
├── docs/
│   ├── analysis/
│   │   └── prompt-1-output.md
│   ├── design/
│   │   └── prompt-2-output.md
│   └── setup/
│       ├── prompt-0A-output.md
│       └── prompt-0B-output.md
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql
```

---

## 6. Implementation Phases

| Phase | Prompt | Scope |
|-------|--------|-------|
| Scaffold | Prompt 3 | Create all directories, markdown files, package.json, tsconfig.json, hooks.json, CLAUDE.md |
| Core Library | Prompt 4 | Implement scripts/lib/*.ts (state-store, supabase-sync, managers, utils) |
| Hooks | Prompt 5 | Implement all 17 hook scripts, measure latency on Windows |
| Supabase | Prompt 6 | Apply migration, verify sync, test instinct lifecycle |
| Integration | Prompt 7 | End-to-end testing: session lifecycle, instincts, no-context-guard, costs |

---

## 7. Open Risks

### Risk 1: SQLite + Supabase Sync Complexity
Two persistence layers must stay consistent. If sync fails, data diverges.
**Mitigation:** SQLite is write-first (always succeeds locally). Supabase sync is async via sync_queue table with retry. Process queue on session-start AND session-end. Never block on Supabase writes.

### Risk 2: no-context-guard False Positives
Could block legitimate edits (typo fixes, comments) that don't need prior research.
**Mitigation:** Exception list (test files, markdown, already-read files, same-directory files). Emergency override: `KADMON_NO_CONTEXT_GUARD=off`. Measure false positive rate in Phase 5.

### Risk 3: Hook Latency on Windows
17 hooks, observe-pre/post run on every tool call. Each spawns Node.js on Windows.
**Mitigation:** (a) observe hooks do file append only — no DB, no network. Target <50ms. (b) Use specific matchers to limit hooks to relevant tools. (c) Measure in Phase 5, disable slow hooks if needed.

### Risk 4: Context7 MCP Availability
If Context7 service is down, docs-lookup agent breaks.
**Mitigation:** docs-lookup should gracefully degrade to WebSearch. mcp-health-check hook provides early warning.

### Risk 5: ECC License / Attribution
Copying content from ECC repo requires license verification.
**Mitigation:** Check ECC license before scaffold (Prompt 3). If restrictive, rewrite all content from scratch using analysis as conceptual inspiration, not copied verbatim.

---

## 8. Architectural Decision Records

### ADR-001: Dual Persistence (SQLite + Supabase)
SQLite is write-first local store. Every write goes to SQLite immediately. Supabase sync is async via queue. Zero-latency writes and offline resilience. Supabase is queryable source of truth for cross-session analysis.

### ADR-002: No tmux, No bash, No Python
All hooks are Node.js. All temp files use `os.tmpdir()`. No `/tmp/` literals. No `.sh` files. Windows-native system.

### ADR-003: Single Hook Profile
No minimal/standard/strict. All hooks always active. To disable a hook, remove from hooks.json. Simplicity over flexibility.

### ADR-004: no-context-guard as PreToolUse Hook
The `no_context` principle is enforced at the tool level, not just encouraged. Claude physically cannot write code without having read related code first. Strongest possible enforcement.

### ADR-005: Observations as Ephemeral JSONL
Per-session observations stored as JSONL in os.tmpdir(), not SQLite. Summarized at session end. Keeps observe hooks fast (file append vs database write).

---

## Status
Prompt 2 complete. Waiting for architect approval before Prompt 3 (scaffold).
