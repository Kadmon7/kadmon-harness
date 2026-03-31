# ADR-006: Context Management Strategy

## Status
Accepted

## Context
After building the harness to v0.3 (14 agents, 20 skills, 17 commands, 15 rules, 22 hooks), the user observed persistent "forgetting" — Claude not using agents/skills despite rules mandating it. Investigation revealed the root cause is NOT harness size (only 18K tokens always-loaded, 9% of 200K context) but rather how context compaction interacts with on-demand loading.

## Decision

### Three-tier context architecture
1. **Tier 1 — Always loaded (18K tokens)**: alwaysApply rules (10 files, 8K), CLAUDE.md files (2 files, 3K), settings (3.5K), MEMORY.md (0.4K), agent routing descriptions (3K)
2. **Tier 2 — Conditional (2K tokens)**: TypeScript rules loaded only when editing .ts/.tsx files (5 files with globs)
3. **Tier 3 — On-demand (77K tokens)**: Full agent definitions (32K), skill files (34K), command files (11K) — loaded only when invoked

### Compaction survival model
- Rules with `alwaysApply: true` survive compaction (reloaded from disk)
- CLAUDE.md files survive compaction (reloaded from disk)
- MEMORY.md survives compaction (reloaded from disk)
- Everything else is lost: conversation history, file contents read, agent/skill context loaded during session
- Session state persisted to SQLite via pre-compact-save hook before compaction

### Pattern evaluation at all lifecycle points
- **Clean termination (Stop)**: evaluate-session.js evaluates patterns
- **Compaction (PreCompact)**: pre-compact-save.js evaluates patterns (via evaluate-patterns-shared.js)
- **Crash recovery (SessionStart)**: session-start.js recovers orphaned sessions AND evaluates their patterns (added in this ADR)

### Multi-project viability
- Building projects on top of the harness is viable (91% context free on 200K, 98% on 1M)
- Agents, rules, and skills are project-scoped — each project needs its own `.claude/` configuration
- Global context (identity, preferences) lives in `~/.claude/CLAUDE.md`
- Project-scoped memory lives in `~/.claude/projects/<hash>/memory/`

## Consequences
- Harness overhead is minimal and well within budget for any model tier
- The "forgetting" problem requires behavioral enforcement via rules, not architectural changes
- Pattern evaluation now covers all three lifecycle scenarios (stop, compact, crash)
- Future projects (ToratNetz, KAIRON) need their own `.claude/` with project-specific agents/skills
- The enforcement rule `agents.md` (alwaysApply) is the primary mechanism for agent/skill usage — it must stay concise and high-priority

## Alternatives Considered
- **Reduce harness size**: Rejected — 18K tokens is already efficient; reducing further would lose valuable guidance
- **Global agents across projects**: Deferred to v2 — requires a sharing mechanism that doesn't exist yet
- **Always-load all skills**: Rejected — would add 34K tokens to every session for no benefit; on-demand is correct
- **Background daemon for crash recovery**: Rejected — adds complexity; orphan recovery on next SessionStart is sufficient
