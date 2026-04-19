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

| Trigger | Tier | Reviewers |
|---------|------|-----------|
| Production `.ts`/`.js` in `scripts/lib/` or `.claude/hooks/scripts/` | **full** | ts-reviewer + spektr + orakle + kody |
| Multi-file refactor (5+ files) | **full** | Full parallel |
| New feature / bug fix in production code | **full** | Full parallel |
| Security-sensitive (auth, exec, SQL, file paths) | **full** | Full parallel (spektr MANDATORY) |
| DB schema or migration changes | **full** | Full parallel (orakle MANDATORY) |
| Test-only additions in `tests/` (no production code) | **lite** | ts-reviewer only |
| Single-file TS refactor <50 lines, no new exports | **lite** | ts-reviewer only |
| Hook script edit <20 lines, no security surface | **lite** | ts-reviewer only |
| Hook script edit with auth/exec/path surface | **lite** | ts-reviewer + spektr |
| Docs-only (`*.md` in README/docs/agents/skills/commands) | **skip** | — |
| Config-only (`tsconfig.json`, `.gitignore`, `eslintrc`) | **skip** | — |
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

## Command Reference (11)

### Observe Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /kadmon-harness | Show harness dashboard (instincts, sessions, costs, hook health) | — |
| /kompact | Smart context compaction with audit and safety checks. Use `/kompact audit` for context audit only | — |

### Plan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /abra-kdabra | Smart planning — arkitect -> konstruct -> feniks (if TDD) -> kody chain with user approval gate | arkitect, konstruct, feniks, kody |

### Build Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /medik | Full harness diagnostic — 8 health checks, approval gate, repair, cleanup. Alias: /MediK. Use `/medik build`, `/medik hooks`, `/medik db`, or `/medik clean` for single phase | mekanik, kurator |

### Scan Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /skanner | Deep system assessment — performance profiling + E2E workflow tests in parallel. Optional agent evaluation. | arkonte, kartograf |

### Research Phase (1)
| Command | Purpose | Agent |
|---------|---------|-------|
| /skavenger | Multi-source deep research — web, media transcripts (YouTube/Vimeo/SoundCloud/Twitch/X/TikTok/Archive.org/Dailymotion via yt-dlp), PDFs. Two routes: A=Media, B=General (per ADR-016 slim refactor — Route D removed; ad-hoc GitHub research runs inline via `gh api`). Auto-writes reports to `docs/research/` unless `KADMON_RESEARCH_AUTOWRITE=off`. Flags (one at a time): `--continue` (extend last session report), `--plan <topic>` (zero-fetch dry-run), `--verify <hypothesis>` (pro/contra tagging), `--drill <N>` (expand open question N), `--history <query>` (search archive), `--verify-citations <N>` (re-fetch URLs of report N). Skavenger spawns sub-agents via `Task` for ≥3 sub-questions (F9); enforces source diversity (F10). `--premium` (Perplexity Sonar) remains deferred per ADR-009 Fase 2. | skavenger |

### Remember Phase (3)
| Command | Purpose | Agent |
|---------|---------|-------|
| /chekpoint | Tiered verification + review + commit and push (full/lite/skip — see Tiers section) | kody + specialists |
| /almanak | Look up live documentation for any library or framework | almanak |
| /doks | Sync project documentation with code changes (4-layer sync) | doks |

### Evolve Phase (2)
| Command | Purpose | Agent |
|---------|---------|-------|
| /forge | Forge session observations into instincts via unified preview-gated pipeline. Flags: `--dry-run`, `export`. (/instinct is a deprecated alias until 2026-04-20) | — |
| /evolve | Run harness self-optimization analysis. Step 6 "Generate" (EXPERIMENTAL through 2026-04-28) reads ClusterReports written by `/forge` and proposes new skills/commands/agents/rules through a preview gate; `/evolve` command invokes `skill-creator:skill-creator` plugin for PROMOTE proposals (target path `.claude/skills/<slug>/SKILL.md` per ADR-013) and `applyEvolveGenerate` for the rest (commands/agents/rules stay flat). | alchemik |

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
