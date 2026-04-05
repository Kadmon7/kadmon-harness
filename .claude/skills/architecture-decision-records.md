---
name: architecture-decision-records
description: Document architectural decisions as ADRs in docs/decisions/ — context, options, consequences. Use this skill whenever making a decision that affects multiple components, choosing between persistence strategies, adding new hooks or agents, changing the data model, or when the user asks "why did we do it this way?" or "should we change the approach?". Even if the decision seems small, if it constrains future choices it deserves an ADR.
---

# Architecture Decision Records

Capture architectural decisions as structured documents so future sessions have context. Decisions live alongside code -- not in Slack threads, PR comments, or someone's memory.

## When to Use
- Choosing between persistence strategies (SQLite vs Supabase)
- Designing new hook behavior or adding new hooks
- Changing module boundaries or data flow
- Selecting libraries or dependencies
- Any decision where "why" matters more than "what"

## Decision Detection Signals

Watch for these patterns in conversation:

**Explicit signals**
- "Let's go with X"
- "We should use X instead of Y"
- "The trade-off is worth it because..."
- "Record this as an ADR"

**Implicit signals** (suggest recording -- do not auto-create without user confirmation)
- Comparing two frameworks or libraries and reaching a conclusion
- Making a database schema design choice with stated rationale
- Choosing between architectural patterns (monolith vs microservices, REST vs GraphQL)
- Deciding on authentication/authorization strategy
- Selecting deployment infrastructure after evaluating alternatives

## ADR Template
```markdown
# ADR-NNNN: [Decision Title]

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNNN
**Deciders**: [who was involved]

## Context
What is motivating this decision? [2-5 sentences: situation, constraints, forces]

## Decision
What did we decide and why? [1-3 sentences]

## Alternatives Considered
### Alternative 1: [Name]
- Pros: [benefits]
- Cons: [drawbacks]
- Why not: [specific reason rejected]

### Alternative 2: [Name]
- Pros: [benefits]
- Cons: [drawbacks]
- Why not: [specific reason rejected]

## Consequences
### Positive
- [benefit 1]

### Negative
- [trade-off 1]

### Risks
- [risk and mitigation]
```

## Workflow

1. **Detect** -- recognize a decision moment (explicit or implicit signal)
2. **Gather context** -- what problem prompted this? What constraints exist?
3. **Document alternatives** -- what other options were considered? Why rejected?
4. **State consequences** -- what are the trade-offs? What becomes easier/harder?
5. **Assign number** -- scan existing ADRs in `docs/decisions/` and increment (4-digit: 0001)
6. **Confirm and write** -- present the draft to the user. Only write after explicit approval
7. **Update index** -- append to `docs/decisions/README.md` if it exists

### Reading Existing ADRs
When a user asks "why did we choose X?":
1. Scan `docs/decisions/` for relevant ADRs by title/content
2. Present the Context and Decision sections
3. If no match: "No ADR found. Would you like to record one now?"

## ADR Lifecycle

```
proposed -> accepted -> [deprecated | superseded by ADR-NNNN]
```

- **proposed**: under discussion, not yet committed
- **accepted**: in effect and being followed
- **deprecated**: no longer relevant (e.g., feature removed)
- **superseded**: a newer ADR replaces this one (always link the replacement)

Once accepted, an ADR is never edited -- only superseded by a new ADR.

## What Makes a Good ADR

### Do
- **Be specific** -- "Use sql.js for local persistence" not "use a database"
- **Record the why** -- the rationale matters more than the what
- **Include rejected alternatives** -- future sessions need to know what was considered
- **State consequences honestly** -- every decision has trade-offs
- **Keep it short** -- readable in 2 minutes
- **Use present tense** -- "We use X" not "We will use X"

### Don't
- Record trivial decisions -- variable naming or formatting choices
- Write essays -- if the context exceeds 10 lines, it's too long
- Omit alternatives -- "we just picked it" is not a valid rationale
- Backfill without marking it -- if recording a past decision, note the original date
- Let ADRs go stale -- superseded decisions should reference their replacement

## Categories Worth Recording

| Category | Examples |
|----------|---------|
| Technology choices | Framework, language, database, cloud provider |
| Architecture patterns | Monolith vs microservices, event-driven, CQRS |
| API design | REST vs GraphQL, versioning strategy, auth mechanism |
| Data modeling | Schema design, normalization, caching strategy |
| Infrastructure | Deployment model, CI/CD pipeline, monitoring |
| Security | Auth strategy, encryption, secret management |
| Testing | Test framework, coverage targets, E2E balance |
| Process | Branching strategy, review process, release cadence |

## File Location
`docs/decisions/ADR-NNNN-short-title.md`

## Examples

### Example 1: ADR-001 (actual)
```markdown
# ADR-001: Dual Persistence (SQLite + Supabase)
**Date**: 2026-03-15
**Status**: accepted
**Deciders**: Ych-Kadmon

## Decision: SQLite write-first, Supabase sync async
## Why: Zero-latency writes, offline resilience
```

### Example 2: Hook enforcement
```markdown
# ADR-004: no-context-guard as PreToolUse Hook
**Date**: 2026-03-20
**Status**: accepted

## Decision: Block Write/Edit without prior Read
## Why: Strongest possible enforcement of no_context principle
```

## Gotchas
- ADRs are committed and pushed alongside the code they affect -- they are not separate documentation deliverables
- The arkitect agent produces ADRs automatically during /kplan (Route A). Ensure it follows this format
- ADR numbering uses 4-digit format (0001-0999+) for consistent sorting
- An ADR directory must exist before writing. If `docs/decisions/` does not exist, ask user before creating it

## Rules
- Every ADR gets a sequential 4-digit number (ADR-0001, ADR-0002, ...)
- Once accepted, an ADR is never edited -- only superseded by a new ADR
- The arkitect agent produces ADRs automatically
- ADRs are committed and pushed alongside the code they affect

## no_context Application
ADRs are the "Remember" mechanism. They ensure that architectural decisions survive context compaction and session boundaries. Without ADRs, the same decision gets re-debated in every session.
