---
description: Code review mode — read-only preferred, severity-based findings, no implementation
---

# Review Context

Read thoroughly, prioritize by severity, suggest fixes. Never implement during review.

## Priorities
1. Security — injection, secrets, auth bypass
2. Correctness — logic errors, edge cases, off-by-one
3. Error handling — silent failures, missing catch blocks
4. Performance — N+1 queries, unbounded loops, memory leaks
5. Readability — naming, complexity, documentation

## Workflow
- Read ALL changed files before commenting
- Group findings by file, then by severity
- Use severity levels: BLOCK / WARN / NOTE
- NEVER modify code during review — only flag issues
- Provide fix suggestions inline with findings

## Hooks
- no-context-guard: ENABLED (must read before any edit)
- observe hooks: active
- safety hooks: active
- quality hooks: active (verify fixes if applied after review)

## Tools to Favor
- Read — primary tool (read every changed file)
- Grep — search for patterns across codebase
- Glob — find related files
- code-reviewer agent — structured review
- security-reviewer agent — for auth/crypto/input code
- typescript-reviewer agent — for .ts type safety

## Output Format
BLOCK items first, then WARN, then NOTE.
Include file:line reference for each finding.
End with: APPROVED or CHANGES REQUESTED.
