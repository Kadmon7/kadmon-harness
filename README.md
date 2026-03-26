# Kadmon Harness

Universal operative layer for Claude Code.

## Mantra

**Observe → Remember → Verify → Specialize → Evolve**

| Phase | What It Does |
|-------|-------------|
| Observe | Watch tool calls, manage context budget, research before code |
| Remember | Persist sessions, track instincts (learned patterns), record ADRs |
| Verify | TDD, code review, security review, quality gates, type checking |
| Specialize | Domain-specific agents, curated skill catalog |
| Evolve | Learn from sessions, extract patterns, promote instincts to skills |

## Architecture

Kadmon Harness is a Claude Code plugin system: agents, skills, commands, rules, hooks, and contexts that shape how Claude Code behaves during development. It enforces the `no_context` principle — never invent, never hallucinate — at the tool level via a PreToolUse hook that blocks code generation without prior research.

## Components

| Category | Count | Location |
|----------|-------|----------|
| Agents | 14 (6 opus, 8 sonnet) | `.claude/agents/` |
| Skills | 23 | `.claude/skills/` |
| Commands | 24 | `.claude/commands/` |
| Hooks | 20 | `.claude/hooks/scripts/` |
| Rules | 14 | `.claude/rules/` |
| Contexts | 3 | `.claude/contexts/` |

## Quick Start

### Prerequisites
- Node.js 18+
- Claude Code CLI
- Git

### Installation
```bash
git clone https://github.com/Kadmon7/kadmon-harness.git
cd kadmon-harness
npm install
npm run build
```

### Usage
```bash
# Start a Claude Code session — Kadmon Harness activates automatically
claude

# Run the dashboard to inspect system state
npx tsx scripts/dashboard.ts

# Key commands
/kplan          # Plan complex tasks
/tdd            # Test-driven development
/verify         # Run verification loop
/checkpoint     # Commit with quality gates
/docs <topic>   # Look up documentation
/instinct-status # Show learned patterns
```

## Stack

- **Language**: TypeScript / JavaScript
- **Persistence**: SQLite (local, v1) — Supabase planned for v2
- **Source of truth**: GitHub
- **Runtime**: Claude Code CLI on Windows
- **MCPs**: GitHub, Supabase, Context7

## Agents (14)

| Agent | Model | Trigger |
|-------|-------|---------|
| architect | opus | /kplan, design review |
| planner | opus | /kplan, multi-file tasks |
| code-reviewer | sonnet | /code-review, /checkpoint |
| typescript-reviewer | sonnet | Auto on .ts/.tsx edits |
| database-reviewer | opus | Auto on SQL/Supabase edits |
| security-reviewer | opus | Auto on auth/keys/input code |
| tdd-guide | sonnet | /tdd |
| build-error-resolver | sonnet | Auto on build failures |
| refactor-cleaner | sonnet | /refactor-clean |
| docs-lookup | sonnet | /docs |
| doc-updater | sonnet | /update-docs |
| e2e-runner | sonnet | /e2e |
| oren | opus | /oren-master-research, research tasks |
| harness-optimizer | opus | /evolve |

## Skills (23)

Reusable knowledge documents in `.claude/skills/` referenced by agents during tasks.

| Skill | Domain |
|-------|--------|
| search-first | Research before coding |
| daily-research | Daily research workflow |
| safety-guard | no_context enforcement |
| tdd-workflow | TDD cycle guide |
| verification-loop | Verify pipeline |
| context-budget | Context window management |
| strategic-compact | Context compaction |
| continuous-learning-v2 | Instinct/learning system |
| coding-standards | Code style enforcement |
| security-review | Security audit checklist |
| e2e-testing | End-to-end test patterns |
| eval-harness | Evaluation framework |
| documentation-lookup | Context7 doc lookup |
| architecture-decision-records | ADR templates |
| agentic-engineering | Multi-agent orchestration |
| api-design | REST/RPC design patterns |
| claude-api | Claude API usage |
| cost-aware-llm-pipeline | Token cost optimization |
| database-migrations | Schema migration patterns |
| iterative-retrieval | RAG retrieval patterns |
| iterative-retrieval-hebrew | Hebrew-specific RAG retrieval |
| mcp-server-patterns | MCP integration |
| postgres-patterns | PostgreSQL/Supabase |

## Commands (24)

| Command | Phase | Purpose |
|---------|-------|---------|
| /kplan | Specialize | Plan complex multi-file tasks |
| /tdd | Verify | Test-driven development cycle |
| /verify | Verify | Run typecheck + tests + lint |
| /build-fix | Verify | Fix build errors |
| /code-review | Verify | Run code review |
| /quality-gate | Verify | Run all quality checks |
| /test-coverage | Verify | Check test coverage |
| /e2e | Verify | Generate and run E2E tests |
| /eval | Verify | Run evaluation harness |
| /checkpoint | Remember | Save progress + commit + push |
| /docs | Remember | Lookup documentation |
| /update-docs | Remember | Update project documentation |
| /sessions | Remember | List past sessions |
| /context-budget | Observe | Audit context window |
| /dashboard | Observe | Show harness dashboard (instincts, sessions, costs, hook health) |
| /oren-master-research | Observe | Daily intelligence briefing |
| /refactor-clean | Evolve | Refactor code |
| /learn | Evolve | Extract session patterns |
| /learn-eval | Evolve | Evaluate learned patterns |
| /evolve | Evolve | Cluster instincts into skills |
| /instinct-status | Evolve | Show learned instincts |
| /instinct-export | Evolve | Export instincts |
| /promote | Evolve | Promote instinct to global |
| /prune | Evolve | Clean up low-confidence instincts |

## Windows Compatibility

- Hook stdin parsing: shared `parseStdin()` helper sanitizes unescaped backslashes
- Hook execution: `PATH` prefix ensures Node.js is found in bash
- MCP servers: `cmd /c npx` wrapper for GitHub and Context7
- `/doctor`: 0 warnings

## Attribution

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.

## Status

v0.1 — Operational (101 tests passing)
