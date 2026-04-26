---
alwaysApply: true
---

# Development Workflow Rules

## Order
- ALWAYS follow: Research → Plan → Test → Implement → Review → Commit
- ALWAYS run /chekpoint at the appropriate tier (full/lite/skip — see "/chekpoint Tiers" section below)
- NEVER commit failing tests (red tests)
- ALWAYS write test before implementation (TDD workflow)
- ALWAYS use skill-creator:skill-creator plugin for creating, editing, optimizing, or evaluating skills. Invoke: `skill: "skill-creator:skill-creator"`. Never create skill files manually — the plugin handles structure, frontmatter, description optimization, and eval setup.

## /chekpoint Tiers

Before any commit, classify the diff scope and choose a tier. Default is **full** when ambiguous. Mechanical verification (build + typecheck + tests + lint) runs for ALL tiers.

> **Language routing**: the diff's file extensions determine the language reviewer. `.ts/.tsx/.js/.jsx` → `typescript-reviewer`. `.py` → `python-reviewer`. Mixed diffs → both in parallel. `spektr`, `orakle`, and `kody` are language-agnostic and route the same in either case.

| Trigger | Tier | Reviewers |
|---------|------|-----------|
| Production `.ts`/`.js` in the project's source tree (e.g. `src/`, `lib/`, `scripts/`, or `.claude/hooks/scripts/`) | **full** | typescript-reviewer + spektr + orakle + kody |
| Production `.py` in target project (src/, lib/, app/) | **full** | python-reviewer + spektr + orakle + kody |
| Multi-file refactor (5+ files) | **full** | Full parallel (reviewers match file extensions) |
| New feature / bug fix in production code | **full** | Full parallel (reviewers match file extensions) |
| Security-sensitive (auth, exec, SQL, file paths) | **full** | Full parallel (spektr MANDATORY) |
| DB schema or migration changes | **full** | Full parallel (orakle MANDATORY) |
| Test-only additions in `tests/` TS (no production code) | **lite** | typescript-reviewer only |
| Test-only additions in `tests/` Python (no production code) | **lite** | python-reviewer only |
| Single-file TS refactor <50 lines, no new exports | **lite** | typescript-reviewer only |
| Single-file Python refactor <50 lines, no new public API | **lite** | python-reviewer only |
| Hook script edit <20 lines, no security surface | **lite** | typescript-reviewer only |
| Hook script edit with auth/exec/path surface | **lite** | typescript-reviewer + spektr |
| Docs-only (`*.md` in README/docs/agents/skills/commands) | **skip** | — |
| Config-only (`tsconfig.json`, `pyproject.toml`, `.gitignore`, `eslintrc`, `ruff.toml`) | **skip** | — |
| Agent frontmatter metadata (`model:`, `tools:`) | **skip** | — |
| Routing/rules metadata (`rules/**/*.md`, `CLAUDE.md`) | **skip** | — |
| Typo fixes (1-5 char changes, no semantic change) | **skip** | — |
| Revert commits | **skip** | — |

**Tier semantics:**

- **full** — all 4 phases of /chekpoint (verification + parallel reviewers + kody consolidation + commit)
- **lite** — Phase 1 verification + ONE scope-matched reviewer (skip kody consolidation, skip BLOCK gate unless the reviewer reports BLOCK), then commit
- **skip** — Phase 1 verification + manual `git diff` review by Claude, then commit (no reviewers at all)

**Overrides:** user can explicitly request a tier (`"chekpoint lite"`, `"skip chekpoint"`). Claude must still verify the override makes sense and document the tier in the commit message footer: `Reviewed: full` or `Reviewed: lite (ts-reviewer)` or `Reviewed: skip (verified mechanically)`.

**When in doubt:** default to **full**. Err on the side of safety. Never apply `skip` to anything touching runtime behavior.

> Full Command Reference (11 commands across 7 phases: Observe, Plan, Build, Scan, Research, Remember, Evolve) — see [.claude/commands/CATALOG.md](../../commands/CATALOG.md). Single source-of-truth per ADR-035.

## Commits
- MUST use conventional commits: feat/fix/chore/docs/refactor/test
- PREFER small focused commits over large monolithic ones
- MUST include scope when relevant: `feat(instincts): add export function`
- NEVER commit unrelated changes in the same commit

## Research
- ALWAYS follow search-first skill (5 steps: codebase → dependencies → docs → evaluate → proceed)
- SHOULD search GitHub for existing implementations: `gh search code <query>`
- ALWAYS use /almanak for API lookups instead of relying on memory
- MUST read existing code before modifying it (enforced by no-context-guard hook)

## Enforcement
- no-context-guard hook blocks edits without prior Read (PreToolUse on Edit|Write)
- block-no-verify hook prevents skipping git hooks (PreToolUse on Bash)
- git-push-reminder hook warns before git push without /chekpoint (PreToolUse on Bash)
- post-edit-typecheck hook validates TypeScript after edits (PostToolUse on Edit|Write)
- quality-gate hook runs lint/style checks after edits (PostToolUse on Edit|Write)
