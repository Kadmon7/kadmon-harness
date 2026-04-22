---
number: 20
title: Runtime language detection for language-agnostic commands and hooks
date: 2026-04-21
status: completed
needs_tdd: true
route: A
adr: ADR-020-runtime-language-detection.md
---

# Plan-020: Runtime language detection for language-agnostic commands and hooks

## Context

Implements ADR-020 (runtime language detection) against the 21 TS-coupled sites mapped in the approved plan file `C:\Users\kadmo\.claude\plans\y-los-commandos-chekpoint-iridescent-meteor.md`. That file has the WHAT (coupling sites, toolchain map, test strategy). This plan has the HOW and the ORDER: 5 phases, 21 steps, TDD-driven, each phase independently mergeable with a /chekpoint close-out. The harness stays TS internally; only the executable surfaces that target the consumer's project become polyglot.

## Phase breakdown

### Phase A — Core detection module (L)

**Files (create)**: `scripts/lib/detect-project-language.ts`, `tests/lib/detect-project-language.test.ts`, `tests/fixtures/lang-ts/package.json`, `tests/fixtures/lang-py/pyproject.toml`, `tests/fixtures/lang-mixed/{package.json,pyproject.toml}`, `tests/fixtures/lang-unknown/.gitkeep`.

**Acceptance**:
- `detectProjectLanguage(cwd)` returns `'typescript'|'python'|'mixed'|'unknown'` per fixture.
- `getToolchain(cwd)` returns typed `Toolchain` struct; `build`/`audit` null for Python.
- `KADMON_PROJECT_LANGUAGE` env var overrides detection; logged as `source: 'override'`.
- Detector writes a one-line JSON diagnostic to stderr (`{source, language, markers}`) every call — rolls into `hook-events.jsonl` when called from a hook.
- `npx vitest run tests/lib/detect-project-language.test.ts` green.
- `npm run build` regenerates `dist/scripts/lib/detect-project-language.js`.
- **/chekpoint full** (new production TS — spektr mandatory because env-var surface).

**Dependencies**: none. Must land first — everything else imports from this module.

**Steps inside**: 4 (1.1 red tests, 1.2 fixtures, 1.3 green impl, 1.4 chekpoint).

---

### Phase B — Hook branching (M)

**Files (modify)**: `.claude/hooks/scripts/post-edit-typecheck.js`, `quality-gate.js`, `ts-review-reminder.js`, `deps-change-reminder.js`, `console-log-warn.js`, `commit-quality.js`. **Files (extend)**: `tests/hooks/post-edit-typecheck.test.ts` + 5 sibling test files (one Python case per hook).

**Acceptance**:
- Each hook branches on file extension using the Phase A module; `.py` triggers Python toolchain, `.ts/.tsx/.js/.jsx` preserves current behavior.
- Missing Python tool (`mypy`, `ruff`, etc.) → warn on stderr, exit 0 (NEVER block).
- `console-log-warn.js` closes the `.claude/rules/python/hooks.md:18` gap (`print()` warning).
- `deps-change-reminder.js` triggers on `package.json` OR `pyproject.toml` OR `requirements.txt`.
- 6 existing TS hook tests still green; 6 new Python cases green.
- **/chekpoint full** (ts-reviewer + spektr; 6 hook edits = production code).

**Dependencies**: Phase A complete (hooks import the module).

**Steps inside**: 6 (one per hook — each is a red-test → branch-impl → chekpoint micro-cycle).

---

### Phase C — Commands + skill docs (M)

**Files (modify)**: `.claude/commands/chekpoint.md`, `medik.md`, `abra-kdabra.md`; `.claude/skills/verification-loop/SKILL.md`, `tdd-workflow/SKILL.md`, `ai-regression-testing/SKILL.md`, `coding-standards/SKILL.md`, `e2e-testing/SKILL.md`.

**Acceptance**:
- `/chekpoint` Phase 1 instructs the model to call `detectProjectLanguage()` and run the toolchain's build/typecheck/lint/test (skip null steps with logged reason).
- `/medik` checks 1, 2, 3, 6, 7 become language-aware; check 8 (lint-agent-frontmatter) stays TS by design.
- `/abra-kdabra` passes detected language into the feniks sub-agent prompt.
- Skill examples show side-by-side TS + Python blocks; `verification-loop/SKILL.md` references the detection module.
- **/chekpoint skip** (all markdown, no production code).

**Dependencies**: Phase A complete (commands reference the module by name). Independent of Phase B.

**Steps inside**: 4 (one per command group: chekpoint, medik, abra-kdabra, skills batch).

---

### Phase D — Agents + rules + patterns (M)

**Files (modify)**: `.claude/agents/feniks.md`, `mekanik.md`, `kartograf.md`, `arkonte.md`; `.claude/rules/common/development-workflow.md`; `.claude/hooks/pattern-definitions.json`.

**Acceptance**:
- Agent bodies honor the Python skill already declared in frontmatter (feniks loads `python-testing` but body was vitest-only).
- `development-workflow.md` tier table adds `.py` rows routing to `python-reviewer` instead of silently routing to ts-reviewer.
- `pattern-definitions.json` gains 3-4 parallel Python patterns (matchers on `.py`, `followedByCommands` pointing at pytest/mypy). Existing TS patterns unchanged.
- Pattern-count test (if any) in `tests/hooks/` still passes.
- **/chekpoint full** (rules + pattern-definitions.json are production surfaces; ts-reviewer + kody).

**Dependencies**: Phase A complete (agents cite the detector). Independent of B and C.

**Steps inside**: 4 (4 agents as one step each → rules → patterns).

---

### Phase E — Dogfood + docs sync (S)

**Files (modify)**: `CLAUDE.md` (metrics + "Language" line clarification), `.claude/rules/python/hooks.md` (mark print-gap closed), `.claude/rules/common/agents.md` (if doks finds drift).

**Acceptance**:
- `/chekpoint lite` against the harness itself → TS toolchain detected, identical behavior to pre-plan.
- Manual test: copy `tests/fixtures/lang-py/` to a scratch directory, invoke `/chekpoint lite` — detector returns `python`, commands call `pytest`/`ruff`/`mypy` (warn on missing tools, exit 0).
- `/doks` run syncs CLAUDE.md metrics (test count 731 + ~15 new), updates status line, confirms agents catalog unchanged.
- ADR-020 status flips `proposed` → `accepted` only after Kadmon-Sports dogfood (tracked separately, not in this plan).
- **/chekpoint full** at phase close (CLAUDE.md is the status source of truth; kody consolidates).

**Dependencies**: Phases A through D complete.

**Steps inside**: 3 (dogfood TS, dogfood Python fixture, /doks + chekpoint).

---

## Step list

| # | Step | Phase | TDD entry | Size |
|---|---|---|---|---|
| 1 | Write failing tests for `detectProjectLanguage()` (4 branches + override) | A | **feniks RED** | S |
| 2 | Create 4 fixtures under `tests/fixtures/lang-{ts,py,mixed,unknown}/` | A | — | S |
| 3 | Implement `detect-project-language.ts` (+ `Toolchain` interface + stderr diagnostic); run `npm run build` | A | feniks GREEN | M |
| 4 | Phase A close: /chekpoint full (ts-reviewer + spektr on env-var surface) | A | — | S |
| 5 | Write failing Python case for `post-edit-typecheck.js` | B | **feniks RED** | S |
| 6 | Branch `post-edit-typecheck.js` on ext; mypy fallback to `python -m py_compile`; warn-not-fail on missing tool | B | feniks GREEN | M |
| 7 | Red + branch for `quality-gate.js` (eslint ↔ ruff) | B | **feniks RED** then GREEN | M |
| 8 | Red + branch for `ts-review-reminder.js` (count `.py` too; warning reads "N code edits") | B | **feniks RED** then GREEN | S |
| 9 | Red + branch for `deps-change-reminder.js` (accept pyproject/requirements) | B | **feniks RED** then GREEN | S |
| 10 | Red + branch for `console-log-warn.js` (add `\bprint\s*\(` for `.py`; closes rules/python/hooks.md:18 gap) | B | **feniks RED** then GREEN | S |
| 11 | Red + branch for `commit-quality.js` (regex extends to `.py`; `print(`/`breakpoint()` debug markers) | B | **feniks RED** then GREEN | M |
| 12 | Phase B close: /chekpoint full (6 hook edits = production; spektr on exec-surface) | B | — | S |
| 13 | Rewrite `/chekpoint` Phase 1 + `/medik` checks 1-3, 6-7 as language-aware | C | — | M |
| 14 | Add language branch to `/abra-kdabra` feniks step (pass `projectLanguage` in prompt) | C | — | S |
| 15 | Update 5 skill SKILL.md files with side-by-side TS+Python examples | C | — | M |
| 16 | Phase C close: /chekpoint skip (markdown-only — verified by diff scope rule) | C | — | S |
| 17 | Update 4 agents (feniks, mekanik, kartograf, arkonte) with Python branches in body | D | — | M |
| 18 | Add `.py` rows to `development-workflow.md` tier table (route to python-reviewer) | D | — | S |
| 19 | Add 3-4 parallel Python patterns to `pattern-definitions.json`; verify pattern-count tests green | D | — | M |
| 20 | Phase D close: /chekpoint full (patterns + rules are production; ts-reviewer + kody) | D | — | S |
| 21 | Phase E: TS dogfood + Python fixture dogfood + `/doks` sync + /chekpoint full | E | — | M |

**Total: 21 steps.**

## TDD entry points

Feniks MUST write the failing test before implementation at these steps:
- Step 1 (detect module — full red/green cycle)
- Steps 5, 7, 8, 9, 10, 11 (one red case per hook before branching)

Steps 13-19 are markdown/config and use Phase A's tests as the safety net; no new red-green cycle needed.

## Verification matrix

| Phase | Verification command | Expected outcome |
|---|---|---|
| A | `npx vitest run tests/lib/detect-project-language.test.ts` | Green — 4 branches + override covered |
| A | `npm run build && node -e "require('./dist/scripts/lib/detect-project-language.js')"` | No import error |
| B | `npx vitest run tests/hooks/` | Green — 6 existing + 6 new Python cases |
| B (hook Python) | Edit `.py` in `tests/fixtures/lang-py/`; watch stderr | `mypy` invoked OR warn (no silent exit 0) |
| C | Markdown diff review + `npx tsc --noEmit` | No TS impact; docs render |
| D | `npx vitest run` full suite | Baseline 731 + ~15 new green; no regression |
| E (TS dogfood) | `/chekpoint lite` at repo root | Detects `typescript`; behavior identical to pre-plan |
| E (Py dogfood) | `/chekpoint lite` in scratch copy of `tests/fixtures/lang-py/` | Detects `python`; calls `pytest`/`ruff`/`mypy` (warn on missing) |

## Rollback plan

**Phase A failure (detector unreliable)**: the detector has a built-in safe default — `unknown` returns the TS toolchain to preserve current behavior. If detection proves unreliable in the wild, set `KADMON_PROJECT_LANGUAGE=typescript` as a shell/user override and file a follow-up. Revert is one commit (the new module is additive — nothing consumes it until Phase B).

**Phase B failure (hook regression)**: each of the 6 hook edits is an independent commit. Revert the broken hook's commit only — the other 5 stay. The hook defaults to the TS branch on `unknown` language, so even a partial revert is safe.

**Phase C failure (command markdown)**: markdown-only. Revert the commit; command reverts to TS-hardcoded (pre-plan) behavior. No code impact.

**Phase D failure (agents/rules/patterns)**: agents and rules are markdown; pattern-definitions.json is data. Revert the commit. If pattern-count tests fail after revert, the pattern addition was the problem — isolated and safe to drop.

**Phase E failure (dogfood)**: dogfood failure triggers new red tests + bug fixes in A/B/C/D, not a revert of E. Phase E produces no new code — only updates CLAUDE.md metrics and runs dogfood.

**Cross-phase invariant**: each phase commits independently and each phase's commit leaves the harness working against TS projects. Phase A alone ships a detector nobody uses yet — safe. Phases B/C/D ship behavior that falls back to TS on `unknown` — safe. Phase E is a dogfood gate, not a behavior change.

## Out of scope

Copied verbatim from the approved plan:

- chmod-fix del plugin cache (upstream issue, lo lleva VSCode session)
- `schema.sql` faltante en `dist/` (packaging bug, lo lleva VSCode session)
- `observe-pre/post` → SQLite (no escriben a DB por diseño actual; tema aparte)
- Cambiar `.kadmon-version` a JSON (no hace falta — detección es runtime, no install-time)
- Distribución de herramientas Python (el usuario final instala sus propias deps `ruff`, `mypy`, etc.)
- `.husky/pre-commit` con `npm run build` — interno al harness repo, no se distribuye
- `README.md` Quick Start — para contribuidores del harness, no para consumers del plugin
- `scripts/lint-agent-frontmatter.ts` — TS-only intencional, los agentes del harness son TS
- `.claude-plugin/hooks.json` `HOOK_CMD_PREFIX` — se trata en otra sesión (chmod-fix upstream)
- Go / Rust / Java support — `Toolchain` struct allows it, but v1 ships TS+Python only
- Auto-installing `ruff`/`mypy`/`pytest` for the user — out of scope, user owns their deps

## Files changed summary

| File | Phase | Action | Rationale |
|---|---|---|---|
| `scripts/lib/detect-project-language.ts` | A | Create | Single source of truth for detection + Toolchain |
| `tests/lib/detect-project-language.test.ts` | A | Create | TDD red/green + coverage per branch |
| `tests/fixtures/lang-{ts,py,mixed,unknown}/` | A | Create | Deterministic fixtures for 4 detection branches |
| `.claude/hooks/scripts/post-edit-typecheck.js` | B | Modify | Branch `.ts` vs `.py` (mypy fallback) |
| `.claude/hooks/scripts/quality-gate.js` | B | Modify | Branch eslint vs ruff |
| `.claude/hooks/scripts/ts-review-reminder.js` | B | Modify | Count `.py` edits; warning text language-agnostic |
| `.claude/hooks/scripts/deps-change-reminder.js` | B | Modify | Accept pyproject.toml / requirements.txt |
| `.claude/hooks/scripts/console-log-warn.js` | B | Modify | Detect `print(` for `.py`; closes py/hooks.md:18 gap |
| `.claude/hooks/scripts/commit-quality.js` | B | Modify | Extend regex to `.py`; `print(`/`breakpoint()` debug markers |
| `tests/hooks/*.test.ts` (6 files) | B | Modify | Add one Python case per hook |
| `.claude/commands/chekpoint.md` | C | Modify | Phase 1 verification reads toolchain at runtime |
| `.claude/commands/medik.md` | C | Modify | Checks 1-3, 6-7 language-aware; check 8 stays TS |
| `.claude/commands/abra-kdabra.md` | C | Modify | Pass projectLanguage into feniks sub-agent prompt |
| `.claude/skills/verification-loop/SKILL.md` | C | Modify | Reference detection module; side-by-side example |
| `.claude/skills/tdd-workflow/SKILL.md` | C | Modify | vitest + pytest side-by-side |
| `.claude/skills/ai-regression-testing/SKILL.md` | C | Modify | vitest.config.ts + pytest.ini dual example |
| `.claude/skills/coding-standards/SKILL.md` | C | Modify | Mention pyproject.toml / ruff.toml alongside tsconfig |
| `.claude/skills/e2e-testing/SKILL.md` | C | Modify | Add pytest-playwright example |
| `.claude/agents/feniks.md` | D | Modify | Honor `python-testing` skill already declared |
| `.claude/agents/mekanik.md` | D | Modify | Add Python diagnostic branch (mypy/pytest) |
| `.claude/agents/kartograf.md` | D | Modify | Add pytest-playwright branch |
| `.claude/agents/arkonte.md` | D | Modify | Soft — ambos ejemplos (tsc / py-spy) |
| `.claude/rules/common/development-workflow.md` | D | Modify | Tier table routes `.py` to python-reviewer |
| `.claude/hooks/pattern-definitions.json` | D | Modify | Add 3-4 parallel Python patterns |
| `CLAUDE.md` | E | Modify | Metrics + clarify "Language" line (harness vs consumer) |
| `.claude/rules/python/hooks.md` | E | Modify | Mark print-gap closed (now enforced by console-log-warn.js) |
