---
name: safety-guard
description: Use to understand destructive operation prevention — what the harness blocks and why
---

# Safety Guard

Preventing destructive operations that could lose work or damage the project.

## When to Use
- Understanding why a command was blocked
- Reviewing hook safety mechanisms

## How It Works
Three layers:
1. **block-no-verify** — Blocks --no-verify and --no-gpg-sign on git commands
2. **config-protection** — Blocks weakening of linter/compiler configs
3. **no-context-guard** — Blocks Write/Edit without prior Read

## Rules
- Safety hooks exit code 2 (block)
- Override no-context-guard: `KADMON_NO_CONTEXT_GUARD=off`
- No override for block-no-verify — intentional

## no_context Application
The safety-guard system is the no_context principle made physical.