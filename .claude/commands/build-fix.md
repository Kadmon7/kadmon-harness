---
description: Diagnose and fix TypeScript compilation or build errors
agent: build-error-resolver
skills: [systematic-debugging]
---

## Purpose
Invoke the build-error-resolver agent to diagnose root cause and apply minimal fix for build errors.

## Steps
1. Run `npm run build` or `npx tsc --noEmit` to capture errors
2. Invoke build-error-resolver agent (sonnet) with full error output
3. Agent reads error, traces to source file and line
4. Agent proposes minimal fix (no unrelated changes)
5. Apply fix
6. Re-run build to verify fix works

## Output
Error diagnosed + fix applied + build verification result.

## Example
```
Error: TS2345 Argument of type 'string' not assignable to 'number'
Root cause: session-manager.ts:42 — passing string ID where number expected
Fix: cast with parseInt() or change type
Verification: npx tsc --noEmit — PASS
```