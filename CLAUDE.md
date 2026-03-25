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
| Specialize | domain agents, skill catalog, /kplan |
| Evolve | instinct learning, /learn, /refactor-clean, pattern extraction |

## Stack
- Language: TypeScript / JavaScript (primary)
- Persistence: SQLite (local fast cache, v1) — Supabase planned for v2
- Source of truth: GitHub (Kadmon7/kadmon-harness)
- Runtime: Claude Code CLI on Windows
- MCPs: GitHub (source of truth), Supabase (persistence), Context7 (live documentation)

## Active Projects
- **ToratNetz** — Torah RAG system (Supabase + pgvector)
- **UNIVERSO KAIRON** — AI companion universe

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

## Commands (22)
| Command | Phase | Purpose |
|---------|-------|---------|
| /kplan | Specialize | Invoke for complex multi-file or uncertain tasks |
| /tdd | Verify | Test-driven development cycle |
| /verify | Verify | Run verification loop |
| /build-fix | Verify | Fix build errors |
| /code-review | Verify | Run code review |
| /quality-gate | Verify | Run quality checks |
| /test-coverage | Verify | Check test coverage |
| /e2e | Verify | Generate and run E2E tests |
| /eval | Verify | Run evaluation harness |
| /checkpoint | Remember | Save progress + git commit |
| /docs | Remember | Lookup documentation |
| /context-budget | Observe | Audit context window |
| /refactor-clean | Evolve | Refactor code |
| /learn | Evolve | Extract session patterns |
| /learn-eval | Evolve | Evaluate learned patterns |
| /evolve | Evolve | Cluster instincts into skills |
| /instinct-status | Evolve | Show learned instincts |
| /promote | Evolve | Promote instinct to global |
| /prune | Evolve | Clean up low-confidence instincts |
| /sessions | Remember | List past sessions |
| /instinct-export | Evolve | Export instincts |
| /update-docs | Remember | Update documentation |

## Skills (21)
Reusable knowledge documents in `.claude/skills/` referenced by agents during tasks.
Key skills: search-first, safety-guard, tdd-workflow, verification-loop, context-budget, continuous-learning-v2, coding-standards, security-review, e2e-testing, eval-harness, documentation-lookup, architecture-decision-records, agentic-engineering, api-design, claude-api, cost-aware-llm-pipeline, database-migrations, iterative-retrieval, mcp-server-patterns, postgres-patterns, strategic-compact.

## Development Workflow
1. Research first (/docs, search-first skill)
2. Plan (/kplan command, planner agent)
3. Test first (/tdd command, tdd-guide agent)
4. Implement (build-error-resolver if needed)
5. Review (/code-review, /verify)
6. Commit (conventional commits via /checkpoint)

## Memory
- **Sessions**: summaries persist to SQLite
- **Instincts**: learned patterns with confidence scoring (0.3→0.9), auto-promoted at confidence ≥0.7
- **Cost events**: token usage tracked per session
- **Observations**: ephemeral JSONL per session, summarized at session end
- **Auto Memory**: Claude Code built-in memory in `~/.claude/memory/` (global) and project memory dir
- **Dashboard**: `npx tsx scripts/dashboard.ts` shows instincts, sessions, hook health

## Hook Latency Budget
- observe-pre / observe-post: < 50ms each (file append only)
- no-context-guard: < 100ms (reads observations JSONL)
- All other hooks: < 500ms

## Windows Compatibility
- Hook stdin: `parseStdin()` helper sanitizes unescaped Windows backslashes in JSON
- Hook execution: all 17 hooks use `PATH="$PATH:/c/Program Files/nodejs"` prefix
- MCP servers: `cmd /c npx` wrapper for GitHub and Context7
- /doctor: 0 warnings

## Status
v0.1 — Operational (76 tests passing, 5 opus + 8 sonnet agents)
