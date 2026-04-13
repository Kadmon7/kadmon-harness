---
description: "[DEPRECATED 2026-04-20] Alias for /forge — do not use for new work"
---

## DEPRECATED — use /forge

This command is a deprecation alias and will be removed **2026-04-20**. Use `/forge` directly. See ADR-005 (`docs/decisions/ADR-005-forge-evolve-pipeline.md`) for the rename rationale.

## What Claude does when this is invoked

1. **Emit the deprecation warning verbatim** in the response:
   `/instinct is deprecated and will be removed 2026-04-20. Use /forge instead.`

2. **Map the invocation to the closest `/forge` behavior**:

   | Old invocation                                  | Forwarded to       |
   |-------------------------------------------------|--------------------|
   | `/instinct` / `/instinct status` / `/instinct eval` | `/forge --dry-run` |
   | `/instinct learn` / `/instinct promote` / `/instinct prune` | `/forge` |
   | `/instinct export`                              | `/forge export`    |
   | anything else                                   | `/forge` (fallback)|

3. **Tell the user which `/forge` invocation you are delegating to**, then execute that command as if the user had typed it directly.

The full pipeline behavior lives in `.claude/commands/forge.md`. Do not duplicate it here.
