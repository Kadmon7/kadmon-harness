---
name: architecture-decision-records
description: Document architectural decisions as ADRs in docs/decisions/ — context, options, consequences. Use this skill whenever making a decision that affects multiple components, choosing between persistence strategies, adding new hooks or agents, changing the data model, or when the user asks "why did we do it this way?" or "should we change the approach?". Even if the decision seems small, if it constrains future choices it deserves an ADR.
---

# Architecture Decision Records

Capture architectural decisions as structured documents so future sessions have context.

## When to Use
- Choosing between persistence strategies (SQLite vs Supabase)
- Designing new hook behavior or adding new hooks
- Changing module boundaries or data flow
- Selecting libraries or dependencies
- Any decision where "why" matters more than "what"

## How It Works

### ADR Template
```markdown
# ADR-NNN: [Decision Title]

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXX

## Context
[Why this decision is needed — the problem or constraint]

## Decision
[What we decided and why]

## Alternatives Considered
1. [Option A] — [why rejected]
2. [Option B] — [why rejected]

## Consequences
- [positive consequence]
- [negative consequence or trade-off]
- [what must change as a result]
```

### File Location
`docs/decisions/ADR-NNN-short-title.md`

## Examples

### Example 1: ADR-001 (actual)
```markdown
# ADR-001: Dual Persistence (SQLite + Supabase)
## Decision: SQLite write-first, Supabase sync async
## Why: Zero-latency writes, offline resilience
```

### Example 2: Hook enforcement
```markdown
# ADR-004: no-context-guard as PreToolUse Hook
## Decision: Block Write/Edit without prior Read
## Why: Strongest possible enforcement of no_context principle
```

## Rules
- Every ADR gets a sequential number (ADR-001, ADR-002, ...)
- Once accepted, an ADR is never edited — only superseded by a new ADR
- The architect agent produces ADRs automatically
- ADRs are committed and pushed alongside the code they affect

## no_context Application
ADRs are the "Remember" mechanism. They ensure that architectural decisions survive context compaction and session boundaries. Without ADRs, the same decision gets re-debated in every session.
