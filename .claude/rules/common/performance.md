---
alwaysApply: true
---

# Performance Rules

## SQLite (sql.js)
- PREFER batch operations over individual inserts in loops
- MUST call saveToDisk() after write operations (handled by wrapper)
- MUST use :memory: for tests — never touch production database
- PREFER prepared statements over raw exec for queries with parameters

## Context Window
- NEVER load files > 50KB into context without explicit reason
- PREFER reading specific line ranges over entire files
- MUST compact at natural breakpoints (after commits, between features)
- PREFER lazy loading for large data sets

## Model Routing
- MUST use appropriate model tier for task complexity
- Opus: architecture, complex planning (expensive but thorough)
- Sonnet: implementation, review, testing (balanced)
- Haiku: documentation, formatting, simple lookups (cheap and fast)