# Prompt 7 Output — Commands + Rules + Context7 MCP

## Date
2026-03-24

## Part A: Context7 MCP
- Status: **Connected and working**
- Command: `npx -y @upstash/context7-mcp@latest`
- Configured in: `~/.claude.json` (project scope)
- CLAUDE.md updated with MCP entry

## Part B: Commands (22/22 complete)

| Command | Group | Status |
|---------|-------|--------|
| /plan | Observe | Complete |
| /context-budget | Observe | Complete |
| /sessions | Remember | Complete |
| /checkpoint | Remember | Complete |
| /docs | Remember | Complete |
| /update-docs | Remember | Complete |
| /instinct-export | Evolve | Complete |
| /tdd | Verify | Complete |
| /verify | Verify | Complete |
| /build-fix | Verify | Complete |
| /code-review | Verify | Complete |
| /quality-gate | Verify | Complete |
| /test-coverage | Verify | Complete |
| /e2e | Verify | Complete |
| /eval | Verify | Complete |
| /learn | Evolve | Complete |
| /learn-eval | Evolve | Complete |
| /instinct-status | Evolve | Complete |
| /promote | Evolve | Complete |
| /prune | Evolve | Complete |
| /refactor-clean | Evolve | Complete |
| /evolve | Evolve | Complete |

## Part C: Rules (14/14 complete)

### Common Rules (9)
| Rule | Status |
|------|--------|
| agents | Complete — model routing, when to invoke |
| coding-style | Complete — naming, types, validation, files |
| development-workflow | Complete — research-plan-test-implement-review |
| git-workflow | Complete — conventional commits, no --no-verify |
| hooks | Complete — exit codes, latency budgets |
| patterns | Complete — composition, DI, error handling |
| performance | Complete — sql.js, context window, model routing |
| security | Complete — secrets, input, SQL injection, exec |
| testing | Complete — coverage, TDD, Vitest, :memory: |

### TypeScript Rules (5)
| Rule | Status |
|------|--------|
| coding-style | Complete — strict mode, types, modules |
| hooks | Complete — compilation, stdin, import patterns |
| patterns | Complete — Result pattern, Zod, immutability |
| security | Complete — type safety, file ops, data sanitization |
| testing | Complete — mocking, cleanup, hook testing |

## TODOs Remaining
**Zero** — grep confirms no `## TODO` in commands/ or rules/.

## Test Results
- 63 passing, 0 failing, 4 todo (session-start stubs)
- TypeScript: 0 errors

## Git Commit
- Hash: 10ebb11
- Pushed to: main

## Next Phase
Prompt 8 — Integration test + first real session
