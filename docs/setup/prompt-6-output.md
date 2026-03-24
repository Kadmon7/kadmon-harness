# Prompt 6 Output — Agent + Skill Content

## Date
2026-03-24

## Part A: Agents (13/13 complete)

| Agent | Model | Status | Notes |
|-------|-------|--------|-------|
| architect | opus | Complete | ADR production, system design |
| planner | opus | Complete | Numbered plans with verification |
| code-reviewer | sonnet | Complete | BLOCK/WARN/NOTE severity |
| typescript-reviewer | sonnet | Complete | strict mode, generics, Node16 |
| database-reviewer | sonnet | Complete | sql.js + Supabase patterns |
| security-reviewer | sonnet | Complete | OWASP Top 10, CRITICAL-LOW |
| tdd-guide | sonnet | Complete | Red-green-refactor, Vitest |
| build-error-resolver | sonnet | Complete | TS errors, module resolution |
| refactor-cleaner | sonnet | Complete | Dead code, before/after summary |
| docs-lookup | sonnet | Complete | Context7 MCP + WebSearch fallback |
| doc-updater | sonnet | Complete | CLAUDE.md maintenance |
| e2e-runner | sonnet | Complete | Session/instinct lifecycle tests |
| harness-optimizer | sonnet | Complete | Hook perf, instinct quality |

## Part B: Skills (21/21 complete)

| Skill | Group | Status | Notes |
|-------|-------|--------|-------|
| search-first | Observe | Complete | no_context foundation |
| context-budget | Observe | Complete | Tool call monitoring |
| strategic-compact | Observe | Complete | When to compact |
| architecture-decision-records | Remember | Complete | ADR template + lifecycle |
| documentation-lookup | Remember | Complete | Context7 + WebSearch |
| continuous-learning-v2 | Remember | Complete | Full instinct lifecycle |
| tdd-workflow | Verify | Complete | Red-green-refactor |
| verification-loop | Verify | Complete | 6-step verification |
| security-review | Verify | Complete | Checklist + examples |
| safety-guard | Verify | Complete | 3 layers of protection |
| e2e-testing | Verify | Complete | Session + instinct lifecycle |
| eval-harness | Verify | Complete | Structured evaluation |
| agentic-engineering | Specialize | Complete | Model routing, eval-first |
| api-design | Specialize | Complete | REST + Zod validation |
| claude-api | Specialize | Complete | Messages, tools, streaming |
| coding-standards | Specialize | Complete | TS conventions, naming |
| cost-aware-llm-pipeline | Specialize | Complete | Pricing table, optimization |
| database-migrations | Specialize | Complete | SQLite + Supabase patterns |
| iterative-retrieval | Specialize | **PRIORITY** | Hebrew text, pgvector, Torah chunking, multi-source RAG |
| mcp-server-patterns | Specialize | Complete | Build + consume MCP servers |
| postgres-patterns | Specialize | Complete | Indexes, RLS, pgvector |

## Content Gaps
None — all files have production-ready content.

## Significant Adaptations from ECC
- All Python/Go/Rust/Java examples removed and replaced with TypeScript
- sql.js patterns used instead of better-sqlite3
- Windows-safe paths (path.join, os.tmpdir) in all examples
- tmux references completely removed
- iterative-retrieval: added Hebrew text specifics, Torah chunking strategies, pgvector patterns (not in ECC)
- safety-guard: restructured around Kadmon's 3-hook system (not ECC's generic approach)

## Git Commit
- Hash: 211baec
- Pushed to: main

## Next Phase
Prompt 7 — Commands + Rules content
