---
number: 27
title: Python bandit SAST auto-invoke hook
date: 2026-04-24
status: accepted
route: A
plan: plan-027-python-bandit-sast-hook.md
---

# ADR-027: Python bandit SAST auto-invoke hook

**Deciders**: Ych-Kadmon (architect), arkitect (author)

## Context

ADR-020 made the harness language-aware at runtime: five PostToolUse hooks branch on file extension so that `.py` edits invoke the Python toolchain (`mypy`, `ruff`, `print()` detection) and `.ts/.tsx/.js/.jsx` edits invoke the TypeScript toolchain (`tsc`, ESLint, `console.log()` detection). That ADR explicitly lists `bandit` alongside `mypy`/`ruff`/`pytest` as a Python toolchain expectation (`ADR-020-runtime-language-detection.md:89`), but no hook actually invokes it. Bandit is documented, not wired.

The gap is verified in three places:

- `rules/python/security.md:43-45` tells humans to run `bandit -r src/ -ll` manually.
- `rules/python/security.md:52` says "bandit runs as part of python-reviewer diagnostic workflow" — i.e., only during `/chekpoint` review, not during edit.
- `.claude/agents/python-reviewer.md:29,37,155` includes bandit in the agent's diagnostic commands and report template.

The cost of this asymmetry: Python developers get inline feedback on typecheck (`post-edit-typecheck.js`) and lint (`quality-gate.js`) on every edit, but only discover SAST findings when they run `/chekpoint` at commit time. TypeScript developers have no comparable SAST gap — `eslint-plugin-security` exists but is narrower than bandit and is not adopted by the harness. So adding a Python-only SAST hook is an intentional asymmetry that reflects ecosystem reality, not a new general pattern.

The forcing function is ADR-020 itself: by declaring the harness language-aware, we made the bandit gap visible. A hook that flags SAST findings inline is the cheapest way to honor the toolchain contract ADR-020 already advertises.

Scope bound: this hook is **warn-only** (exit 1). Bandit at `-ll` still surfaces low-severity noise on common idioms (`subprocess` with `shell=False`, `assert` in non-test code, use of `random`), and blocking edits would break flow on false positives. Blocking is reserved for the commit boundary (`commit-quality.js`), not the edit boundary.

## Decision

**Option A — new dedicated hook `post-edit-security.js`, Python-only for now, registered under the existing `PostToolUse Edit|Write` matcher in `.claude-plugin/hooks.json`.**

Hook behavior:
- On `.py` edit → `bandit -ll <file>` (single-file, never recursive).
- On anything else → `exit 0` silently.
- Bandit not installed → stderr warning + `exit 0` (same warn-not-fail pattern as `mypy`/`ruff`/`eslint` already use in `post-edit-typecheck.js:58-73` and `quality-gate.js:46-49`).
- Findings present → stderr + `exit 1` (warning, never blocking).
- Skip: non-`.py` files, test files (`test_*.py`, `*_test.py`, `/tests/`, `\tests\`), `node_modules`, `dist`, `.claude/hooks` (same skip list as `console-log-warn.js:11-20`).
- Respect `KADMON_DISABLED_HOOKS` via `isDisabled("post-edit-security")` (same pattern as every existing bilingual hook).
- Log to `hook-events.jsonl` with `durationMs` per ADR-007 instrumentation contract.

Separation of concerns is the deciding factor: SAST is distinct from lint style, distinct from typecheck. Putting bandit into `quality-gate.js` (Option B) would fuse "lint style" and "security SAST" so that `KADMON_DISABLED_HOOKS=quality-gate` disables both — a footgun when a user wants to silence noisy lint output but keep security signal. A dedicated hook preserves single-responsibility and per-hook disable granularity.

The hook targets ONLY the edited file, never the project tree. Recursive scans (`bandit -r .`) would blow the 500ms hook budget (`rules/common/hooks.md` Performance section) and duplicate what `/chekpoint`'s python-reviewer already does at commit time.

This mirrors the shape of `post-edit-typecheck.js` (language-aware, warn-not-fail on missing tool, single-file scope), so the hook reads as a consistent extension of the ADR-020 pattern rather than a novel surface.

## Alternatives Considered

### Option A (Chosen) — new dedicated hook `post-edit-security.js`
- **Pros**:
  - Single responsibility. One hook = one tool = one purpose.
  - Disable granularity: `KADMON_DISABLED_HOOKS=post-edit-security` silences SAST without touching lint or typecheck.
  - Future-proof: if/when a TS SAST tool is adopted (e.g., `semgrep`), the `.ts/.tsx` branch lands in the same hook — no new registration, no matcher churn.
  - Consistent with the five existing bilingual hooks — reads as a sixth entry in the same pattern, not a new architecture.
  - Hook latency stays scoped: bandit on a single file is ~150-200ms typical; Node cold start ~236ms on Windows. Total ~400-500ms — within the 500ms budget for non-observe/guard hooks.
- **Cons**:
  - Adds one more hook to the catalog (21 → 22 registered).
  - Adds one more entry to `.claude-plugin/hooks.json` PostToolUse Edit|Write matcher.
  - One more test file to maintain (`tests/hooks/post-edit-security.test.ts`).
  - Consumes ~400-500ms on every `.py` edit when bandit is installed — close to budget ceiling on cold-start Windows.

### Option B — extend `quality-gate.js` to chain `ruff check` + `bandit -ll`
- **Pros**:
  - Fewer hook entries (no new registration).
  - Slightly lower cumulative latency (one Node cold start instead of two — saves ~236ms on Windows when bandit runs).
  - Less test file churn.
- **Cons**:
  - Conflates lint (style) and SAST (security) into one surface. `KADMON_DISABLED_HOOKS=quality-gate` now silences both — no way to keep SAST on while muting noisy lint.
  - `quality-gate.js` doubles its responsibility — the name no longer describes what it does.
  - Breaks the one-tool-per-hook pattern established by `post-edit-typecheck.js` (one typechecker) and `console-log-warn.js` (one pattern detector).
  - When a TS SAST tool is adopted later, it would also need to land in `quality-gate.js` — compounding the conflation.
- **Why not**: the latency win (~236ms) is real but small; the granularity loss is permanent. Users who want "lint off, SAST on" (or vice versa) would need code changes, not an env var.

### Option C — extend `post-edit-typecheck.js` to also run bandit
- **Pros**: none beyond Option B's.
- **Cons**:
  - Conflates three distinct toolchains (typecheck + lint + security) in one script.
  - The name actively lies about the script's responsibility.
  - Even Option B's proponents reject this one.
- **Why not**: worst option; rejected in the constraint brief.

### Option D — do nothing (baseline)
- **Pros**: zero engineering cost. `rules/python/security.md:43` already tells humans to run `bandit` manually.
- **Cons**:
  - The harness keeps the ADR-020 asymmetry: TS edits get lint + typecheck + warn on `console.log()`; Python edits get lint + typecheck + warn on `print()` but no SAST until `/chekpoint`.
  - Bandit findings surface at commit time, not edit time — so the feedback loop is 50+ edits late. SAST caught early is an order of magnitude cheaper to fix than SAST caught at commit.
  - Keeps bandit as documentation-only, which contradicts `rules/python/security.md:43` ("MUST use bandit for static security analysis") — currently the MUST is on humans, not the harness.
- **Why not**: the harness already ships rules that mandate bandit; shipping a rule without a hook that enforces it is exactly the "documented but unused" gap ADR-020 identified. Honoring the ADR-020 toolchain contract costs one hook.

## Consequences

### Positive
- Python edits receive inline SAST feedback, closing the ADR-020 toolchain asymmetry.
- Bandit findings surface at edit time (tight feedback loop), not at `/chekpoint` time.
- Single source of truth for SAST invocation on the edit surface: `post-edit-security.js` — not duplicated across agents, skills, and hooks.
- Separation of concerns preserved: lint (`quality-gate.js`), typecheck (`post-edit-typecheck.js`), SAST (`post-edit-security.js`) — each disableable independently.
- Future TS SAST tool (semgrep, CodeQL CLI) lands in the same hook as a new branch, not a new file.

### Negative
- Hook count grows from 21 to 22 (`rules/common/hooks.md` catalog table must be updated).
- Cumulative PostToolUse latency on `.py` edits grows by ~400-500ms when bandit is installed. Still within the 500ms per-hook budget, but users editing rapidly will notice.
- Docs sync obligation: `rules/common/hooks.md` catalog, `rules/python/security.md` Enforcement section, `rules/python/hooks.md` PostToolUse section, `CLAUDE.md` hook count (currently claims 21 hooks), `scripts/lib/install-apply.ts` if it references a hook count.
- False-positive triage burden: bandit at `-ll` flags legitimate patterns (`subprocess` with list args, `assert` in non-test code, `random` for non-crypto). Warn-only status keeps flow unbroken, but the stderr noise adds cognitive load. Mitigation: the test suite includes a "known-safe file produces zero findings" fixture to establish a noise baseline, and users can set `KADMON_DISABLED_HOOKS=post-edit-security` per-session.
- Test surface expansion: 6-10 new test cases (bandit installed + finding present, bandit installed + clean file, bandit not installed + warn-not-fail, non-`.py` skipped, test file skipped, `KADMON_DISABLED_HOOKS` respected, flag-injection via relative path resolved safely).

### Neutral
- Bandit is not shipped with the harness. ADR-020 already establishes the policy: Python consumers install their own toolchain; hooks warn-not-fail when a tool is missing. This hook follows that contract.
- The hook is Python-only at launch. When/if a TS SAST tool is adopted, the same hook gains a `.ts/.tsx` branch without re-registration. This is an intentional asymmetry that reflects ecosystem reality (no TS SAST equivalent with comparable scope), not a design oversight.

### Risks
- **Risk**: bandit latency exceeds 500ms on Windows cold start combined with Node cold start, breaching the `rules/common/hooks.md` budget.
  - **Mitigation**: measure on three representative files during implementation; if P95 > 500ms, add a `--severity-level high` flag to reduce bandit's scan scope before shipping. The budget is per-hook; if bandit exceeds it the hook ships with the tighter flag, not deferred.
- **Risk**: false positives train users to disable the hook and then forget to re-enable it.
  - **Mitigation**: warn-only status (exit 1) means no flow break; combined with the session-scoped `KADMON_DISABLED_HOOKS` (not persistent), this limits permanent disables. If telemetry later shows the hook is disabled in >30% of sessions, revisit the severity threshold.
- **Risk**: the hook fires on Python files in non-production paths that legitimately use bandit-flagged patterns (fixtures, scratch scripts).
  - **Mitigation**: the skip list already covers `/tests/`, `test_*.py`, `*_test.py`, `node_modules`, `dist`, `.claude/hooks`. Fixtures and scratch scripts should live under `tests/fixtures/` or be explicitly named. This matches the existing `commit-quality.js` and `console-log-warn.js` contract.
- **Risk**: flag-injection via a relative path starting with `-` (e.g., editing `-c.py` from `./scripts/`) causes bandit to parse the filename as a flag.
  - **Mitigation**: resolve to absolute path before passing to `execFileSync`, same pattern as `quality-gate.js:44` (`path.isAbsolute(fp) ? fp : path.resolve(fp)`). Covered by a dedicated test case.
- **Risk**: docs drift — `rules/common/hooks.md` catalog table, `CLAUDE.md` hook count, and `rules/python/hooks.md` PostToolUse section go out of sync.
  - **Mitigation**: `/doks` Check #8 runs drift audit. The plan-027 follow-up plan enumerates the four doc-sync obligations as required steps.

## Acceptance Criteria

The ADR moves from `proposed` to `accepted` when:

1. `post-edit-security.js` exists at `.claude/hooks/scripts/post-edit-security.js`, imports `parseStdin`/`isDisabled` from `parse-stdin.js` and `logHookEvent` from `log-hook-event.js`.
2. `.claude-plugin/hooks.json` registers the hook under PostToolUse Edit|Write matcher after `quality-gate.js`.
3. Tests at `tests/hooks/post-edit-security.test.ts` cover the 6-10 cases listed under "Test surface expansion" and pass via `npx vitest run`.
4. P95 total hook latency (Node cold start + bandit + logging) measured against three representative `.py` files stays below 500ms on Windows.
5. `rules/common/hooks.md` catalog table, `rules/python/security.md` Enforcement section, and `rules/python/hooks.md` PostToolUse section are updated to reference the hook.
6. `CLAUDE.md` hook count reflects 22 hooks (up from 21).
7. Hook warn-not-fails cleanly on a machine without bandit installed (smoke-tested by uninstalling bandit or renaming it on PATH).

## Related

- **ADR-020 (Runtime Language Detection)** — this ADR closes the bandit gap ADR-020 enumerated at line 89. Same language-aware hook pattern, one tool later.
- **ADR-007 (Sprint C Data Integrity Fixes / Hook Duration Instrumentation)** — `post-edit-security.js` MUST emit `durationMs` on every `logHookEvent` call, following the Sprint C contract.
- **`rules/python/security.md:43-52`** — the rule that documents bandit and names it as enforcement; this ADR upgrades enforcement from "manual + review-time" to "manual + review-time + edit-time hook".
- **`rules/common/hooks.md`** — Exit Codes, Safety, Performance sections establish the warn-only / 500ms / exit-0-on-error invariants this hook inherits.
- **`rules/python/hooks.md`** — existing bilingual hook catalog; this ADR adds a sixth entry.
- **`.claude/agents/python-reviewer.md:29,37,155`** — the agent that runs bandit at `/chekpoint` review time; this hook does NOT replace that — they operate at different boundaries (edit vs commit/review).

## Implementation Notes

Not a plan — sketch only. The follow-up `plan-027` will detail phasing and test fixtures.

- **Hook file**: `.claude/hooks/scripts/post-edit-security.js`. Shape mirrors `quality-gate.js` (tool-availability probe → execFileSync with argument array → warn-not-fail → exit 0/1). Reuse `parseStdin`, `isDisabled`, `logHookEvent`, `toolAvailable` helpers rather than duplicating.
- **Hook registration**: add one entry to `.claude-plugin/hooks.json` under PostToolUse Edit|Write matcher, after the `quality-gate.js` entry. Run the plugin-hooks generator (`scripts/generate-plugin-hooks.ts`) if it is the source of truth; otherwise edit the JSON by hand.
- **Command invocation**: `execFileSync("bandit", ["-ll", safeFp], { timeout: 10000, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] })`. Absolute path resolution before the call. Never `shell: true`. Never interpolate `fp` into a command string.
- **Tool availability probe**: reuse the `toolAvailable(cmd)` pattern from `quality-gate.js:15-23` (`where` on Windows, `which` elsewhere).
- **Test location**: `tests/hooks/post-edit-security.test.ts`. Use `execFileSync` with `input` option (Windows-safe per `rules/typescript/testing.md`).
- **Env var for test isolation**: `KADMON_SKIP_BANDIT_CHECK=1` forces the "bandit not installed" branch — gated by `process.env.VITEST || process.env.NODE_ENV === 'test'` so it cannot be used in production. Same pattern as `agent-metadata-sync.js` test env vars.
- **Doc updates**: `rules/common/hooks.md` (catalog table add row), `rules/python/security.md` Enforcement section (add `post-edit-security` hook line), `rules/python/hooks.md` PostToolUse section (add bullet), `CLAUDE.md` Status line (hook count 21 → 22).
- **Status propagation**: `scripts/lib/install-apply.ts` does not hardcode hook counts — no change expected, but verify.

## Review Date

2026-07-24 (three months post-ship). Revisit if:
- Hook is disabled in >30% of sessions (suggests false-positive noise is too high; consider raising severity threshold to `-lll` or restricting to `security` bandit categories).
- Two or more consumers request a blocking mode (would require a new ADR — blocking at edit is explicitly rejected here).
- A TS SAST tool (semgrep, CodeQL CLI) is adopted — branch lands in this hook; filename may need to be generalized (e.g., rename to `post-edit-sast.js`).
- P95 latency drifts above 500ms in `hook-events.jsonl` telemetry.
