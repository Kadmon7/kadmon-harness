---
alwaysApply: true
---

# Performance Rules

## Database
- PREFER batch operations over individual inserts in loops
- MUST flush/commit writes through the project's data-access wrapper (avoid raw client calls)
- MUST use in-memory or ephemeral databases for tests — never touch production database
- PREFER prepared/parameterized statements over raw query strings

## Context Window
- NEVER load files > 50KB into context without explicit reason
- PREFER reading specific line ranges over entire files
- MUST compact at natural breakpoints (after commits, between features)
- PREFER lazy loading for large data sets

## Model Routing
- MUST use appropriate model tier for task complexity
- Opus: architecture, complex planning (expensive but thorough)
- Sonnet: implementation, review, testing (balanced)
- Sonnet also handles: documentation (doks), formatting, lookups (almanak)

## Enforcement
- pre-compact-save hook preserves session state before context compaction (PreCompact)
- /kompact audit subcommand audits current context window usage
- session-end-all hook tracks token usage per session (Stop event, via cost-tracker sub-module)
- observe-pre and observe-post hooks enforce < 50ms latency budget
- alchemik agent analyzes hook latency and cost trends via /evolve
- orakle agent validates database query patterns when editing data-access code