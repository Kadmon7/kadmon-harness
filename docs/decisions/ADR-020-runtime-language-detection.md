---
number: 20
title: Runtime language detection for language-agnostic commands and hooks
date: 2026-04-21
status: proposed
route: A
plan: plan-020-runtime-language-detection.md
---

# ADR-020: Runtime language detection for language-agnostic commands and hooks

**Deciders**: Ych-Kadmon (architect), arkitect (author), konstruct (follow-up plan)

## Context

CLAUDE.md:17 claims the harness is "infrastructure, not product. Built once, carried to every new project via bootstrap." ADR-010 then resolved the distribution side of that claim: a single plugin installs to any project regardless of language. But a recent dogfood against Kadmon-Sports (pure Python) surfaced that runtime behavior never caught up. Joe and Eden installed the plugin on Kadmon-Sports, ran `/chekpoint`, and watched Phase 1 fail on `npm run build` because there is no `package.json`. The harness ships Python rules (`.claude/rules/python/hooks.md:11-24` prescribes `black`, `ruff`, `mypy`, `bandit`, `pytest`), and the linter in `.claude/rules/common/agents.md` names `python-reviewer` as an auto-invoke, but every executable surface (commands, hooks, verification skills) is hardcoded to the TypeScript toolchain.

A systematic audit mapped 21 sites of TS hardcoding across five surface classes:

- **Commands (3)**: `/chekpoint` Phase 1 (`chekpoint.md:33-37`), `/medik` checks 1-3 and 6-7 (`medik.md:20-27`), `/abra-kdabra` feniks step (`abra-kdabra.md:75-80`).
- **Hooks (6)**: `post-edit-typecheck.js:11,14`, `quality-gate.js:13,24`, `ts-review-reminder.js:20,40`, `deps-change-reminder.js:14`, `console-log-warn.js:15,26`, `commit-quality.js:46,75`.
- **Skills (5)**: `verification-loop/SKILL.md:21-26,50,53,56`, `tdd-workflow/SKILL.md:68,204`, `ai-regression-testing/SKILL.md:50,115-116`, `coding-standards/SKILL.md:19`, `e2e-testing/SKILL.md`.
- **Agents (4)**: `mekanik.md:3,15-29`, `kartograf.md:11,14,30,43-51`, `feniks.md:40-68`, `arkonte.md:29,33`.
- **Rules and patterns (3)**: `rules/common/development-workflow.md:18-33` (tiers table routes Python code silently to ts-reviewer), `hooks/pattern-definitions.json:8,19,63,106,117` (followedByCommands hardcoded to npm/vitest/tsc).

No language detection exists anywhere in the codebase. `install-apply.ts` never inspects `package.json` vs `pyproject.toml`. `.kadmon-version` is a scalar string (`install.sh:243-253`) with no slot for language metadata. The distribution ADR (ADR-010:89-93) already anticipated this gap: "single install profile... rules se cargan por file-context en runtime." That principle applied to rules loading; it now needs to extend to commands, hooks, and skills.

The forcing function is the Kadmon-Sports install: the harness either becomes truly language-agnostic at runtime or it silently breaks for every non-TS consumer.

## Decision

Introduce a shared module `scripts/lib/detect-project-language.ts` that the target project's cwd at invocation time, inspects filesystem markers (`pyproject.toml`, `requirements.txt`, `package.json`), and returns a typed `Toolchain` object describing the build, typecheck, test, lint, audit, and dependency-file commands for the detected language. Commands and hooks branch on the detected language; no file is duplicated per-language. The escape hatch is an env var `KADMON_PROJECT_LANGUAGE` that overrides detection when a user needs to force a toolchain (e.g. polyglot repos where the default would pick the wrong one).

The harness itself remains TS internally — only the executable surfaces that *target the consumer's project* become polyglot.

This extends ADR-010's "context-loaded at runtime" principle from rules to commands, hooks, and skills. It is consistent with the Harness-as-Infrastructure axiom: one install profile, behavior resolves from the consumer's filesystem at call time.

## Alternatives Considered

### Alternative A: Install-time detection (write language into `.kadmon-version`)
- Pros: zero per-invocation cost; language is known statically; installer can warn if Python tools are missing.
- Cons:
  - No handling of polyglot projects (JS frontend + Python backend in one repo is common — Kadmon-Sports itself has no JS today but will add a React Native layer once KAIRON integrates).
  - Stale on drift: user adds `pyproject.toml` mid-sprint, harness keeps calling `npm run build` until re-install.
  - Requires migrating `.kadmon-version` from scalar string to JSON, touching `install.sh` + `install.ps1` + `install-apply.ts` + all readers. Invasive for a behavior change.
  - Couples plugin-install to a property of the consumer project that can change after install.
- Why not: the cost of runtime detection is a single `existsSync` per invocation (<1ms on Windows NVMe, measured). The gain from install-time detection is zero runtime cost but the loss is correctness under drift and polyglot — both real, present cases. Correctness wins over negligible perf.

### Alternative B: Per-hook duplication (parallel Python hook scripts)
- Pros: each script has one responsibility; no branching logic inside hook scripts; settings.json matcher could route `.py` edits to Python-only hooks.
- Cons:
  - Doubles hook count from 21 to 27+ without adding architectural value.
  - Claude Code `settings.json` matchers do not support file-extension filters cleanly — you get tool-name matchers (`Edit|Write`) and Bash-command-pattern matchers, but not `"extension": ".py"`. A parallel Python hook would need to be registered under the same matcher and then internally decide whether to run, which is exactly the branch we are trying to avoid.
  - `/chekpoint` and `/medik` are commands, not hooks. Commands cannot be duplicated per-language without also duplicating the agent catalog, the rule references, the skill loads, and the orchestration table. The duplication would propagate into CLAUDE.md and `rules/common/agents.md`.
  - Duplicated scripts drift over time. The moment a TS hook fixes a bug its Python counterpart lags, and the reverse.
- Why not: hook-level duplication solves the wrong problem. The branching is unavoidable — the question is where to put it. Inside one script (Alternative C) keeps the contract surface and matcher registration unchanged; across two scripts (Alternative B) doubles the contract surface and still needs a matcher decision inside at least one of them.

### Alternative C (Chosen): Runtime detection with shared toolchain map
- Pros:
  - Handles polyglot correctly — caller receives a typed `Toolchain` and decides which branch to run, or gets `mixed` and can ask the user.
  - Zero install-time migration — `.kadmon-version` stays a scalar, `install.sh`/`install.ps1` stay untouched, no schema change.
  - Single source of truth in `detect-project-language.ts` + a map table. Toolchain commands (`npx tsc --noEmit` vs `mypy .`) live in one place, not scattered across 21 sites.
  - <1ms per invocation (two `fs.existsSync` calls). Below every hook latency budget in `rules/common/hooks.md`.
  - Consistent with ADR-010's "load by file-context at runtime" axiom, now extended to executable surfaces.
- Cons:
  - Every command and hook must call the detector. This is boilerplate and must be gated by tests to prevent drift.
  - The `KADMON_PROJECT_LANGUAGE` env var is an escape hatch that can mask detection bugs (user forces `typescript` on a broken Python repo, never reports the bug).
  - Mandates dogfood against a real Python project before shipping stable — cannot be validated with fixtures alone.
- Why chosen: it is the only option that preserves the single-install-profile guarantee (ADR-010), handles the polyglot case, and keeps the change surface bounded to one new module plus 21 edit sites. Alternatives A and B each require invasive changes elsewhere (installer for A, matchers + duplicated files for B) for no net gain.

### Alternative D: No change — document that non-TS projects are unsupported (rejected as trivial non-option)
- Pros: zero engineering cost.
- Cons: contradicts CLAUDE.md:17 ("infrastructure, not product"). Silently breaks the Python rules directory the harness already ships. Invalidates Kadmon-Sports as a consumer, which is the canonical external validation target. Forces every non-TS project to fork the harness.
- Why not: the harness claim is either true or it isn't. Shipping Python rules while hardcoding TS execution is worse than shipping neither.

## Consequences

### Positive
- Harness lives up to CLAUDE.md:17 claim. Cross-project dogfood (Kadmon-Sports) becomes viable without forking.
- Polyglot repos work correctly — detection returns `mixed`, toolchain defaults to TS with an explicit override available.
- Single source of truth for toolchain commands. Adding Go or Rust support in the future is a map entry plus fixtures, not 21 edits.
- No install-time migration. Existing users keep their `.kadmon-version` scalar; new behavior activates the next time commands run.
- Detection cost (<1ms) fits inside every hook latency budget (observe <50ms, guard <100ms, others <500ms per `rules/common/hooks.md`).

### Negative
- 21 sites to edit in the follow-up plan. The boilerplate of "call detector, branch on language" multiplies across commands/hooks/skills/agents.
- `KADMON_PROJECT_LANGUAGE` env var is a footgun if over-used. Mitigation: the detector MUST log the detected language (and whether it came from detection or override) on every `/chekpoint` and `/medik` run so bugs surface in observability.
- Python toolchain assumes `mypy` / `ruff` / `pytest` / `bandit` are installed on the consumer's machine. The harness does not ship these. Mitigation: hooks MUST fall back to warn-not-fail when a Python tool is missing (e.g. `mypy` absent → `post-edit-typecheck.js` warns on stderr, exits 0, never blocks).
- Requires dogfood against a real Python project before marking the ADR `accepted`. Fixtures alone are insufficient to validate — Kadmon-Sports is the canonical target.

### Risks

- **Risk**: `KADMON_PROJECT_LANGUAGE` becomes a crutch that masks detection bugs in the wild. Users force `typescript` on projects where detection fails, the bug never reaches us.
  - **Mitigation**: detector logs `{source: 'detection' | 'override', language, fixtures_found: [...]}` to `hook-events.jsonl` on every call. `/medik` surfaces a warning when the override is active for 3+ consecutive sessions without the detected language agreeing.

- **Risk**: polyglot `mixed` case defaults to TS silently. Users with genuine mixed repos get wrong behavior and never realize it.
  - **Mitigation**: `mixed` MUST emit an informational message the first time per session (`"Detected mixed TS+Python project; defaulting to TS. Set KADMON_PROJECT_LANGUAGE=python to override."`). Revisit the default if 2+ users report it wrong.

- **Risk**: Python toolchain assumes `mypy`/`ruff`/`pytest` installed — consumer-facing docs omit this.
  - **Mitigation**: `install.sh`/`install.ps1` post-install checklist MUST list Python prerequisites when `pyproject.toml` is detected in the target project. The hooks themselves warn-not-fail on missing tools (already covered under "Negative"), but the checklist makes the expectation explicit.

- **Risk**: toolchain map drifts from real-world Python idioms (e.g. projects using `poetry` vs `pip`, `uv`, `pdm`, `hatch`).
  - **Mitigation**: v1 supports the canonical `mypy`/`ruff`/`pytest`/`pip-audit` set. Tool discovery (prefer `poetry run mypy` if `poetry.lock` exists, etc.) is a follow-up ADR when a user reports the default is wrong.

## Acceptance Criteria

The ADR moves from `proposed` to `accepted` when:

1. `detectProjectLanguage()` correctly identifies the four project shapes (`typescript`, `python`, `mixed`, `unknown`) against the four fixtures (`tests/fixtures/lang-{ts,py,mixed,unknown}/`). Unit tests green.
2. `getToolchain()` returns the correct `Toolchain` struct for each of those shapes, including null `build`/`audit` for Python. Unit tests green.
3. `/chekpoint lite` run against a Python fixture invokes `pytest`, `ruff`, `mypy` — not `vitest`, `eslint`, `tsc`. Verified manually against `tests/fixtures/lang-py/` copied to a scratch directory.
4. `/medik` run against a Python fixture passes the 3 language-agnostic checks (hook-errors, DB-health, lint-agent-frontmatter on the *harness's own* agents) and adapts the 5 TS-specific checks (build, typecheck, tests, dist-sync, `npm audit`) to their Python equivalents or skips with a logged reason.
5. The 6 hooks branch correctly on file extension without regressing TypeScript behavior — verified by running the existing TS hook tests plus 6 new Python cases.
6. The 731-test baseline still passes + the ~15 new tests are green.
7. Dogfood against Kadmon-Sports: Joe or Eden confirms `/chekpoint lite` succeeds on a real Python repo with no TS hardcoding visible in the output.

## Related ADRs

- **ADR-010 (Hybrid Distribution)** — this ADR extends ADR-010's "single install profile, context-loaded at runtime" principle (ADR-010:89-93) from rules to commands, hooks, and skills. ADR-010 resolved *how* the harness reaches a non-TS project; ADR-020 resolves what happens when it gets there.
- **ADR-019 (Canonical root symlinks)** — unaffected. Symlink discovery is language-independent; only the content behind the symlinks gains language branching.
- **ADR-013 (Skill subdirectory layout)** — unaffected. Skill files gain dual examples (TS + Python) but the file layout and loader contract are unchanged.

## Red Flags to Watch

1. **`KADMON_PROJECT_LANGUAGE` creeping into day-to-day use.** If `/medik` reports the override active more than 20% of sessions, detection has a bug. Fix detection; don't lean harder on the override.
2. **`mixed` defaulting to TS silently.** The first-invocation-per-session informational message is the early warning. If any user reports the default was wrong for their repo, revisit the heuristic before v1.2.
3. **Python toolchain assumes canonical tools.** `poetry`/`uv`/`pdm`/`hatch` users will hit the default `mypy`/`ruff`/`pytest` invocations and may need to set `KADMON_PROJECT_LANGUAGE` or wrap. Document in consumer-facing docs; plan follow-up ADR for tool discovery when a second user reports it.
4. **Hook fallback to warn-not-fail must be tested.** If `mypy` is missing and the hook still exits 2, it blocks editing on every save. Every Python branch MUST have a missing-tool test case.

## Review Date

2026-07-21 (three months post-ship). Revisit if:
- Two or more consumers report polyglot-default wrong
- Any user reports `KADMON_PROJECT_LANGUAGE` set permanently in their shell config
- A third language (Go, Rust) is requested — trigger ADR-021 to generalize the Toolchain map
