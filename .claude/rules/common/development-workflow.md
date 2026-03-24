---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /verify before /checkpoint
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (/tdd workflow)

## Commits
- MUST use conventional commits: feat/fix/chore/docs/refactor/test
- PREFER small focused commits over large monolithic ones
- MUST include scope when relevant: `feat(instincts): add export function`
- NEVER commit unrelated changes in the same commit

## Research
- ALWAYS search codebase before writing new code (search-first skill)
- ALWAYS use /docs for API lookups instead of relying on memory
- MUST read existing code before modifying it (enforced by no-context-guard hook)