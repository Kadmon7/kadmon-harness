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
| Agents | 13 (5 opus, 7 sonnet, 1 haiku) | `.claude/agents/` |
| Skills | 21 | `.claude/skills/` |
| Commands | 22 | `.claude/commands/` |
| Hooks | 17 | `.claude/hooks/scripts/` |
| Rules | 14 | `.claude/rules/` |
| Contexts | 3 | `.claude/contexts/` |

## Stack

- **Language**: TypeScript / JavaScript
- **Persistence**: SQLite (local, v1) — Supabase planned for v2
- **Source of truth**: GitHub
- **Runtime**: Claude Code CLI on Windows
- **MCPs**: GitHub, Supabase, Context7

## Windows Compatibility

- Hook stdin parsing: shared `parseStdin()` helper sanitizes unescaped backslashes
- Hook execution: `PATH` prefix ensures Node.js is found in bash
- MCP servers: `cmd /c npx` wrapper for GitHub and Context7
- `/doctor`: 0 warnings

## Attribution

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.

## Status

v0.1 — Operational (63 tests passing)
