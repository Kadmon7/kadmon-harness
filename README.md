# Kadmon Harness

**Operative layer for Claude Code** — hooks, agents, skills, and commands that transform Claude from a reactive assistant into a system that observes, learns, and evolves.

`154 tests` | `23 hooks` | `14 agents` | `20 skills` | `17 commands`

## Mantra

**Observe &rarr; Remember &rarr; Verify &rarr; Specialize &rarr; Evolve**

| Phase | What It Does | Key Components |
|-------|-------------|----------------|
| **Observe** | Watch every tool call, manage context | observe hooks, `/kompact audit`, `/dashboard` |
| **Remember** | Persist sessions, track learned patterns | SQLite, instinct engine, `/checkpoint` |
| **Verify** | Tests first, code review, quality gates | `/tdd`, `/verify`, `/code-review` |
| **Specialize** | Domain agents, curated skill catalog | 14 agents, 20 skills, `/kplan` |
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
/kplan              # Plan complex tasks (routes to architect + planner)
/tdd                # Test-driven development cycle
/verify             # Typecheck + tests + lint
/checkpoint         # Verify, commit, push
/kompact            # Smart context compaction
/instinct learn     # Extract patterns from current session
```

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

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ PreTool  │→ │  Tool    │→ │ PostTool │             │
│  │ Hooks(8) │  │ Execute  │  │ Hooks(7) │             │
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
│  │ 14 Agents│  │ 20 Skills│  │ 15 Rules │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                         │
│  Lifecycle: SessionStart → PreCompact → Stop            │
│  Recovery:  Orphan detection on next SessionStart       │
└─────────────────────────────────────────────────────────┘
```

## Components

| Category | Count | Location |
|----------|-------|----------|
| Agents | 14 (5 opus, 9 sonnet) | `.claude/agents/` |
| Skills | 20 | `.claude/skills/` |
| Commands | 17 | `.claude/commands/` |
| Hooks | 22 | `.claude/hooks/scripts/` |
| Rules | 15 (9 common + 6 TS) | `.claude/rules/` |

## Agents

| Agent | Model | Trigger |
|-------|-------|---------|
| architect | opus | `/kplan` when design signals detected |
| planner | opus | `/kplan` always (after architect or directly) |
| code-reviewer | sonnet | `/code-review`, `/checkpoint`, auto on `.ts`/`.tsx` edits |
| database-reviewer | opus | Auto on SQL/Supabase edits |
| security-reviewer | opus | Auto on auth/keys/input code |
| tdd-guide | sonnet | `/tdd` |
| build-error-resolver | sonnet | Auto on build failures |
| refactor-cleaner | sonnet | `/refactor-clean` |
| performance-optimizer | sonnet | Auto on O(n^2) loops, slow queries, memory patterns |
| python-reviewer | sonnet | Auto on `.py` edits |
| almanak | sonnet | `/docs` |
| doktor | opus | `/update-docs` |
| e2e-runner | sonnet | `/e2e` |
| harness-optimizer | opus | `/evolve` |

## Commands by Phase

### Observe (2)
| Command | Purpose |
|---------|---------|
| `/dashboard` | System state: instincts, sessions, costs, hook health |
| `/kompact` | Smart compaction with audit (`/kompact audit` for context budget) |

### Remember (3)
| Command | Purpose |
|---------|---------|
| `/checkpoint` | Verify + commit + push |
| `/docs` | Look up live documentation (Context7) |
| `/update-docs` | Update project documentation |

### Verify (7)
| Command | Purpose |
|---------|---------|
| `/tdd` | Test-driven development cycle |
| `/verify` | Typecheck + tests + lint (use `/verify full` for security scan) |
| `/build-fix` | Diagnose and fix build errors |
| `/code-review` | Run code review on changes |
| `/test-coverage` | Coverage report per file |
| `/e2e` | End-to-end tests |
| `/eval` | Evaluate agent/skill quality |

### Specialize (2)
| Command | Purpose |
|---------|---------|
| `/kplan` | Smart planning (architect + planner routing) |
| `/workflow` | Show or guide through workflow chains |

### Evolve (3)
| Command | Purpose |
|---------|---------|
| `/instinct` | Manage instinct lifecycle: learn, promote, prune, export, status, eval |
| `/evolve` | Harness self-optimization analysis |
| `/refactor-clean` | Invoke refactor-cleaner agent |

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

On /compact (PreCompact hook)
  ├── Persist messageCount, filesModified, toolsUsed
  ├── Generate session summary
  ├── Evaluate and reinforce instinct patterns
  └── Reset tool counter

On clean exit (Stop hooks)
  ├── Persist final session summary + tasks
  ├── Evaluate patterns → create/reinforce instincts
  ├── Track cost (tokens, model, USD)
  └── Write clean-exit marker

On crash / terminal close
  └── Next SessionStart recovers the orphaned session
```

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

## Stack

- **Language**: TypeScript / Node.js
- **Persistence**: SQLite via sql.js (local, v1) — Supabase planned for v2
- **Runtime**: Claude Code CLI
- **MCPs**: Supabase, Context7
- **Testing**: Vitest (154 tests)

## Windows Compatibility

- Shared `parseStdin()` helper sanitizes unescaped backslashes in hook stdin
- `PATH` prefix ensures Node.js resolution in Git Bash
- Non-critical hooks support `KADMON_DISABLED_HOOKS` env var
- MCP servers use `cmd /c npx` wrapper

## Attribution

Built on concepts from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) (MIT License) — Copyright (c) 2026 Affaan Mustafa.

## Status

v0.3 — Consolidated (154 tests passing, 23 hooks, 14 agents, 20 skills, 17 commands)
