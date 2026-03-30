---
description: Active development mode — all hooks enabled, TDD enforced, verify before commit
---

# Development Context

Code first, explain after. All safety and quality hooks active.

## Priorities
1. Get it working — write test, make it pass
2. Get it right — review, fix issues
3. Get it clean — refactor without changing behavior

## Workflow
- MUST follow /tdd for new features (red → green → refactor)
- MUST run /verify before /checkpoint
- MUST read files before editing (no-context-guard active)
- PREFER small commits with conventional messages

## Hooks
- All hooks active — no exceptions
- no-context-guard: ENABLED (blocks Write/Edit without prior Read)
- observe-pre/post: logging all tool calls
- quality-gate + post-edit-format + post-edit-typecheck: auto-run on edits

## Tools to Favor
- Edit, Write — implementation
- Bash — running tests, builds, git
- Grep, Glob — searching code before writing
- Read — always before Edit (enforced by hook)

## Agents
- tdd-guide for new features
- build-error-resolver when builds fail
- code-reviewer before commits and on .ts edits (TypeScript specialist mode)
