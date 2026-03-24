# ADR-003: Single Hook Profile

## Status
Accepted

## Context
ECC supports three profiles (minimal/standard/strict) via run-with-flags.js, adding complexity to every hook invocation.

## Decision
Single "Kadmon" profile. All hooks are always active. To disable a hook, remove it from hooks.json. Simplicity over flexibility.

## Consequences
- No run-with-flags.js dispatcher needed
- Each hook script runs directly
- Disabling a hook requires editing hooks.json
- Reduced latency (no profile-checking overhead)
