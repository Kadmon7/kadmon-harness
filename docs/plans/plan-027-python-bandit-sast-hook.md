---
number: 27
title: Python bandit SAST auto-invoke hook
date: 2026-04-24
status: pending
needs_tdd: true
route: A
adr: ADR-027-python-bandit-sast-hook.md
---

## Plan: Python bandit SAST auto-invoke hook [konstruct]

### Overview

Ship a dedicated PostToolUse Edit|Write hook `post-edit-security.js` that runs `bandit -ll <file>` on `.py` edits, warn-only, with graceful fallback when bandit is missing. This closes the ADR-020 toolchain asymmetry where Python edits get inline typecheck + lint but no SAST until `/chekpoint`. The hook is Python-only at launch, registered as hook #22, and mirrors the shape of `post-edit-typecheck.js` (single-file scope, warn-not-fail, `durationMs` instrumented).

### Assumptions

- The decision is ADR-027 Option A (new dedicated hook) — validated by reading `docs/decisions/ADR-027-python-bandit-sast-hook.md:30-47`.
- `.claude-plugin/hooks.json` is **generated** from `.claude/settings.json` by `scripts/generate-plugin-hooks.ts` — validated by reading that generator (source of truth is `.claude/settings.json`; generator rewrites commands into `${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/...` form). Implication: we edit `.claude/settings.json` and run the generator, **not** the JSON by hand.
- `parseStdin()`, `isDisabled()` (from `parse-stdin.js`), and `logHookEvent()` (from `log-hook-event.js`) are the reusable primitives — validated by reading both files.
- The skip-path list (`node_modules`, `dist`, `.claude/hooks`, `test_`, `/tests/`, `\tests\`, `.test.`, `.spec.`) is the canonical Python-aware skip pattern — validated against `console-log-warn.js:11-20`.
- `toolAvailable(cmd)` with platform-branched `where`/`which` probe is the canonical pattern — validated against `quality-gate.js:15-23` and `post-edit-typecheck.js:16-24`.
- Absolute path resolution before `execFileSync` prevents flag-injection — validated against `quality-gate.js:44` and `post-edit-typecheck.js:57`.
- Python test fixture already exists at `tests/fixtures/lang-py/example.py` — validated by Read; will be reused. A second "dirty" fixture with an intentional bandit finding must be added.
- The `KADMON_SKIP_BANDIT_CHECK` env var gating pattern (Vitest/NODE_ENV only) is established — referenced in ADR-027 line 154, matches `agent-metadata-sync.js` precedent.
- Hook count references are concentrated in 5 files to update in this plan: `CLAUDE.md` (3 occurrences), `rules/common/hooks.md` (3), `rules/typescript/hooks.md` (1), `docs/onboarding/reference_kadmon_harness.md` (1), and the `marketplace.json` / `README.md` / `CHANGELOG.md` / `workspace-surface-audit/SKILL.md` / `CLAUDE.template.md` count copies. Plan-003/010/019 and historical `docs/roadmap/` files are frozen history — NOT updated (per `docs/decisions/` convention).
- `scripts/smoke-all-hooks.ts` + `tests/scripts/smoke-all-hooks.test.ts` hardcode "21 hooks" — they must be updated to 22.
- `dist/` is rebuilt before any lifecycle hook runs (`npm run build`) — no dist edits in this plan.

### Phase 0: Research

- [x] Read `docs/decisions/ADR-027-python-bandit-sast-hook.md` — decision contract (completed in pre-plan reconnaissance)
- [x] Read `.claude/hooks/scripts/quality-gate.js` — pattern template (completed)
- [x] Read `.claude/hooks/scripts/post-edit-typecheck.js` — fallback chain template (completed)
- [x] Read `.claude/hooks/scripts/console-log-warn.js` — skip-list + `durationMs` template (completed)
- [x] Read `.claude/hooks/scripts/log-hook-event.js` — event emission contract (completed)
- [x] Read `.claude/hooks/scripts/parse-stdin.js` — `parseStdin`/`isDisabled` contract (completed)
- [x] Read `.claude-plugin/hooks.json` — current registration layout (completed; 7 PostToolUse Edit|Write entries)
- [x] Read `scripts/generate-plugin-hooks.ts` — confirmed source of truth is `.claude/settings.json` (completed)
- [x] Read `tests/hooks/quality-gate.test.ts` and `tests/hooks/post-edit-typecheck.test.ts` — test templates (completed)
- [x] Grep hook count references across repo — mapped all update sites (completed)
- [ ] Before Phase 1: re-read `rules/common/hooks.md:10-105` (full PostToolUse Edit|Write catalog) to identify exact insertion row for the new hook.
- [ ] Before Phase 1: re-read `rules/python/security.md` Enforcement section to locate the exact bullet insertion point.
- [ ] Before Phase 1: re-read `rules/python/hooks.md` PostToolUse section to identify where the bandit bullet slots in.

### Phase 1: Red tests (TDD) — all failing first

Write `tests/hooks/post-edit-security.test.ts` following the `quality-gate.test.ts` structure (spawnSync + JSON.stringify input). All tests must FAIL before Phase 2 because the hook file does not yet exist.

- [ ] Step 1.1: Create dirty Python fixture (S)
  - File: `tests/fixtures/lang-py/insecure.py`
  - Content: a minimal file that triggers a known bandit `-ll` finding (e.g., `subprocess.call("...", shell=True)` or `exec(user_input)`) — pick a finding stable across bandit versions 1.7+. Add a header comment marking it as a test fixture.
  - Verify: `bandit -ll tests/fixtures/lang-py/insecure.py` exits non-zero with at least one finding on a dev machine with bandit installed.
  - Depends on: none
  - Risk: Low (fixture-only, no production impact)

- [ ] Step 1.2: Scaffold test file with shared `runHook()` helper (S)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Mirror the `quality-gate.test.ts` scaffold: `spawnSync("node", [HOOK], { encoding: "utf8", input: JSON.stringify(input) })`, `HOOK = path.resolve(".claude/hooks/scripts/post-edit-security.js")`.
  - Include test env setup: every test that needs to force "bandit missing" sets `env: { ...process.env, KADMON_SKIP_BANDIT_CHECK: "1", VITEST: "1" }` on `spawnSync`.
  - Verify: `npx vitest run tests/hooks/post-edit-security.test.ts` fails with "hook not found" / Node error on spawn (expected — file doesn't exist yet).
  - Depends on: 1.1
  - Risk: Low

- [ ] Step 1.3: Test — bandit available + finding → exit 1 + stderr contains bandit output (M)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Gate: only run when `toolAvailable("bandit")`; otherwise `it.skip(...)` with `KADMON_SKIP_BANDIT_TOOLCHAIN_TEST` annotation (keeps CI green on machines without bandit). Invert-gated via a helper that runs `where bandit` / `which bandit` in the test file's setup and caches the result.
  - Input: `{ tool_input: { file_path: path.resolve("tests/fixtures/lang-py/insecure.py") }, session_id: "test-session-1" }`
  - Assertions: `code === 1`, `stderr` matches `/bandit/i` AND matches the finding marker (e.g. `/Issue:|Severity:|>>/`).
  - Verify: fails (hook not implemented).
  - Depends on: 1.2
  - Risk: Medium (bandit output format drifts across versions — test matches generic keywords, not exact strings)

- [ ] Step 1.4: Test — bandit available + clean file → exit 0 + no stderr bandit output (M)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Same gate as 1.3.
  - Input: `{ tool_input: { file_path: path.resolve("tests/fixtures/lang-py/example.py") }, session_id: "test-session-2" }` (the existing clean fixture).
  - Assertions: `code === 0`, `stderr` does NOT match `/Issue:|Severity:/` (allows diagnostic "running bandit on ..." trace).
  - Verify: fails (hook not implemented).
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.5: Test — bandit NOT installed → stderr warning + exit 0 (M)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Mechanism: set `KADMON_SKIP_BANDIT_CHECK=1` on the spawn env (mock: forces `toolAvailable("bandit")` to return false in hook code).
  - Input: `{ tool_input: { file_path: path.resolve("tests/fixtures/lang-py/example.py") }, session_id: "test-session-3" }`.
  - Assertions: `code === 0`, `stderr` matches `/bandit not installed|skipping/i`.
  - Verify: fails (hook not implemented).
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.6: Test — non-`.py` file (`.ts`, `.js`, `.md`, `.json`) → early return, no bandit probe (S)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Use `it.each([".ts", ".js", ".md", ".json"])` with paths like `/project/src/index.ts`, `/project/README.md`.
  - Assertions: `code === 0`, `stderr` does NOT match `/bandit/i`.
  - Verify: fails (hook not implemented).
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.7: Test — Python test files skipped (S)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Use `it.each(["/project/tests/test_foo.py", "/project/src/foo_test.py", "/project/tests/unit/bar.py"])` (the three skip patterns: `test_` prefix, `_test` suffix, `/tests/` path).
  - Add Windows-path variant: `C:\\project\\tests\\unit\\bar.py` with `\\tests\\` skip marker.
  - Assertions: `code === 0`, `stderr` does NOT match `/bandit/i`.
  - Verify: fails.
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.8: Test — `KADMON_DISABLED_HOOKS=post-edit-security` → immediate exit 0 (S)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Mechanism: `env: { ...process.env, KADMON_DISABLED_HOOKS: "post-edit-security" }`.
  - Input: the dirty fixture from 1.1.
  - Assertions: `code === 0`, `stderr` does NOT match `/bandit|Issue:/i`.
  - Verify: fails.
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.9: Test — flag-injection safety (argument array, absolute path) (M)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Input: a file_path that starts with `-` when interpreted relatively: `{ tool_input: { file_path: "-c.py" }, session_id: "test-session-4" }`.
  - Assertions: `code === 0` OR `code === 1` (depending on whether bandit is installed), BUT stderr must NOT contain Python interpreter syntax output (which would indicate bandit parsed `-c` as a flag). Specifically, assert stderr does NOT match `/usage: bandit/i` (the help text bandit prints on unknown flag).
  - Verify: fails.
  - Depends on: 1.2
  - Risk: Medium (platform-dependent — `.py` files starting with `-` are rare on Windows; assertion focuses on bandit's unknown-flag error)

- [ ] Step 1.10: Test — `durationMs` is logged on finding path (M)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Mechanism: set `session_id` to a unique value, invoke hook against dirty fixture, then read `path.join(os.tmpdir(), "kadmon", sessionId, "hook-events.jsonl")` and assert the last entry has `hookName === "post-edit-security"`, `exitCode === 1`, `durationMs > 0`, `durationMs < 5000`.
  - Gate: same bandit-availability gate as 1.3.
  - Verify: fails (hook not implemented).
  - Depends on: 1.2
  - Risk: Medium (tmp dir cleanup; test must remove the session dir in `afterEach` — per `rules/common/testing.md`)

- [ ] Step 1.11: Test — empty input / missing `file_path` → exit 0 silent (S)
  - File: `tests/hooks/post-edit-security.test.ts`
  - Inputs: `{}`, `{ tool_input: {} }`, `{ tool_input: { file_path: "" } }`.
  - Assertions: `code === 0`, no stderr bandit output.
  - Verify: fails.
  - Depends on: 1.2
  - Risk: Low

- [ ] Step 1.12: Run `npx vitest run tests/hooks/post-edit-security.test.ts` → confirm all ~11 tests RED (S)
  - Verify: every test fails; capture output for Phase 2 comparison.
  - Depends on: 1.3-1.11
  - Risk: Low

### Phase 2: Green implementation

Write `post-edit-security.js` to pass all Phase 1 tests. No refactor yet — optimize for green.

- [ ] Step 2.1: Create hook file skeleton (S)
  - File: `.claude/hooks/scripts/post-edit-security.js`
  - Shebang `#!/usr/bin/env node`, header comment describing purpose (copy structure from `quality-gate.js:1-7`).
  - Imports: `path`, `execFileSync` from `node:child_process`, `parseStdin`, `isDisabled` from `./parse-stdin.js`, `logHookEvent` from `./log-hook-event.js`.
  - Top-level constants: `PY_EXT = new Set([".py"])`, `SKIP_PATHS = [...]` matching `console-log-warn.js:11-20`.
  - Verify: file compiles / parses via `node --check .claude/hooks/scripts/post-edit-security.js`.
  - Depends on: Phase 1 complete (all red)
  - Risk: Low

- [ ] Step 2.2: Implement `toolAvailable(cmd)` probe with `KADMON_SKIP_BANDIT_CHECK` test gate (S)
  - File: `.claude/hooks/scripts/post-edit-security.js`
  - Shape: mirror `quality-gate.js:15-23`. Add early `if (process.env.KADMON_SKIP_BANDIT_CHECK === "1" && (process.env.VITEST || process.env.NODE_ENV === "test")) return false;` BEFORE the `where`/`which` probe (gated to test env only, per ADR-027:154).
  - Verify: Step 1.5 test passes when implementation is in place.
  - Depends on: 2.1
  - Risk: Low

- [ ] Step 2.3: Implement `runBandit(fp)` function (M)
  - File: `.claude/hooks/scripts/post-edit-security.js`
  - Shape:
    ```js
    function runBandit(fp) {
      const safeFp = path.isAbsolute(fp) ? fp : path.resolve(fp);
      console.error(`post-edit-security: running bandit on ${safeFp}`);
      if (!toolAvailable("bandit")) {
        console.error(`\u{26A0} post-edit-security: bandit not installed; skipping ${safeFp}`);
        return { findings: false };
      }
      try {
        execFileSync("bandit", ["-ll", safeFp], {
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
          timeout: 10000,
        });
        return { findings: false };
      } catch (err) {
        if (err.stdout) console.error(`\u{26A0} bandit:\n${err.stdout}`);
        if (err.stderr) console.error(`\u{26A0} bandit:\n${err.stderr}`);
        return { findings: true };
      }
    }
    ```
  - NEVER pass a string command to `execFileSync`; always argument array (per `rules/common/security.md`).
  - Verify: Steps 1.3, 1.4, 1.5, 1.9 tests pass.
  - Depends on: 2.2
  - Risk: Medium (bandit exit code semantics: 0=no findings, 1=findings; behavior on parse errors must be treated as findings path to avoid silent drop — err on the side of exit 1 + stderr)

- [ ] Step 2.4: Wire main entry block (disabled-check → parse → skip → dispatch) (M)
  - File: `.claude/hooks/scripts/post-edit-security.js`
  - Sequence (mirror `console-log-warn.js:27-67`):
    1. `if (isDisabled("post-edit-security")) process.exit(0);`
    2. `const start = Date.now();`
    3. `const input = parseStdin();`
    4. `const filePath = input.tool_input?.file_path ?? ""; if (!filePath) process.exit(0);`
    5. `const ext = path.extname(filePath); if (!PY_EXT.has(ext)) process.exit(0);`
    6. `if (SKIP_PATHS.some(s => filePath.includes(s))) process.exit(0);`
    7. `const { findings } = runBandit(filePath);`
    8. If findings: `logHookEvent(input.session_id, { hookName: "post-edit-security", eventType: "post_tool", toolName: input.tool_name, exitCode: 1, blocked: false, durationMs: Date.now() - start, error: "bandit findings in " + path.basename(filePath) }); process.exit(1);`
    9. Final `process.exit(0);`
  - Outer `try/catch` wraps the whole block; catch logs JSON error to stderr and falls through to `process.exit(0)` (safety rule from `rules/common/hooks.md`).
  - Verify: Steps 1.6, 1.7, 1.8, 1.10, 1.11 tests pass.
  - Depends on: 2.3
  - Risk: Medium (order matters: `isDisabled` BEFORE `parseStdin` so the kill-switch works even if stdin is malformed)

- [ ] Step 2.5: Run `npx vitest run tests/hooks/post-edit-security.test.ts` → all green (S)
  - Verify: all ~11 tests pass. If any red, iterate Steps 2.2-2.4 until green.
  - Depends on: 2.4
  - Risk: Medium (bandit output format; may need assertion tightening in Step 1.3 during iteration)

- [ ] Step 2.6: Manual smoke test on Windows (S)
  - Command: `echo '{"tool_input":{"file_path":"C:/Command-Center/Kadmon-Harness/tests/fixtures/lang-py/insecure.py"},"session_id":"smoke-1","tool_name":"Edit"}' | node .claude/hooks/scripts/post-edit-security.js`
  - Verify: exit code 1, stderr contains bandit finding output.
  - Second smoke: clean fixture → exit 0.
  - Third smoke: `.ts` file → exit 0, silent.
  - Depends on: 2.5
  - Risk: Low

### Phase 3: Wire into Claude Code plugin

- [ ] Step 3.1: Register hook in `.claude/settings.json` PostToolUse Edit|Write matcher (S)
  - File: `.claude/settings.json`
  - Insert after the `console-log-warn.js` entry (line ~177), following the same command shape: `"cd \"$(git rev-parse --show-toplevel)\" && PATH=\"$PATH:/c/Program Files/nodejs\" node .claude/hooks/scripts/post-edit-security.js"`.
  - Verify: `jq '.hooks.PostToolUse[] | select(.matcher == "Edit|Write") | .hooks | length' .claude/settings.json` returns the new count (was 7, becomes 8).
  - Depends on: Phase 2 complete
  - Risk: Low

- [ ] Step 3.2: Regenerate `.claude-plugin/hooks.json` via the generator (S)
  - Command: `npx tsx scripts/generate-plugin-hooks.ts`
  - Verify: `.claude-plugin/hooks.json` now contains a PostToolUse Edit|Write entry for `post-edit-security.js` with the `${HOOK_CMD_PREFIX} ${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/post-edit-security.js` form.
  - Verify: `git diff .claude-plugin/hooks.json` shows exactly one new hook entry; no other changes.
  - Depends on: 3.1
  - Risk: Low

- [ ] Step 3.3: Update smoke-all-hooks expected count (S)
  - Files:
    - `scripts/smoke-all-hooks.ts` — change the "21 hooks" comment/expected count to 22 (line ~4).
    - `tests/scripts/smoke-all-hooks.test.ts:61` — change `"returns EXACTLY 21 hooks..."` and the numeric assertion to 22.
    - `scripts/dogfood-plugin-session.ts` — comments on lines 7, 10, 209 referencing "21 hooks".
  - Rebuild: `npm run build` (regenerates `dist/scripts/smoke-all-hooks.js` and `dist/scripts/dogfood-plugin-session.js`).
  - Verify: `npx vitest run tests/scripts/smoke-all-hooks.test.ts` passes.
  - Depends on: 3.2
  - Risk: Low

### Phase 4: Refactor (optional, only if duplication warrants)

- [ ] Step 4.1: Evaluate whether `toolAvailable()` should extract into `parse-stdin.js` or a new shared module (S)
  - Scope: `toolAvailable()` is now duplicated across `quality-gate.js`, `post-edit-typecheck.js`, and `post-edit-security.js` (3 copies, identical shape).
  - Decision criterion: if the duplication is byte-identical across all 3 and would likely grow to 4+ copies with future SAST tools, extract to `./tool-available.js`. Otherwise, leave in place (rule of 3 is a floor, not a mandate).
  - Action: if extraction is warranted, add new file `.claude/hooks/scripts/tool-available.js`, update all 3 callers to `import { toolAvailable } from "./tool-available.js";`. If not, document the decision in a one-line comment in `post-edit-security.js` and move on.
  - Verify: full vitest run still green after refactor.
  - Depends on: Phase 3 complete
  - Risk: Medium (touching stable hook files widens the blast radius — defer unless extraction is clean)

### Phase 5: Docs sync

All doc edits are mechanical metadata updates; no narrative changes needed.

- [ ] Step 5.1: Update `rules/common/hooks.md` (S)
  - File: `.claude/rules/common/hooks.md`
  - Change line 12 header: `## Hook Catalog (21 registered)` → `## Hook Catalog (22 registered)`.
  - Add new row to the PostToolUse Edit|Write table (after `agent-metadata-sync` row, ~line 55):
    ```
    | post-edit-security | post-edit-security.js | Python SAST: runs `bandit -ll <file>` on .py edits (ADR-027). Warn-only. Graceful fallback when bandit not installed. Skips tests/fixtures and dep paths. | 1 on findings |
    ```
  - Update line 85 (`parse-stdin.js` module row): `All 21 hooks` → `All 22 hooks`.
  - Update line 122 prose: `All 21 registered hooks` → `All 22 registered hooks`.
  - Verify: grep `rules/common/hooks.md` for `21` — no remaining stale references to the count.
  - Depends on: Phase 3
  - Risk: Low

- [ ] Step 5.2: Update `rules/python/security.md` Enforcement section (S)
  - File: `.claude/rules/python/security.md`
  - Section: lines 50-55 (Enforcement bullets).
  - Add bullet after the existing bandit line (~line 52): `- post-edit-security hook runs bandit -ll on .py edits (PostToolUse Edit|Write, exit 1 on findings, exit 0 when bandit missing) — ADR-027`
  - Verify: `grep -n "post-edit-security" .claude/rules/python/security.md` returns a match.
  - Depends on: Phase 3
  - Risk: Low

- [ ] Step 5.3: Update `rules/python/hooks.md` PostToolUse section (S)
  - File: `.claude/rules/python/hooks.md`
  - Add bullet under PostToolUse Hooks section (~after the existing hook bullets):
    ```
    - **post-edit-security.js** — `.py` edits run `bandit -ll <file>` (new hook, ADR-027). Warn-only (exit 1 on findings). Skips with a warning if `bandit` is not installed.
    ```
  - Verify: grep confirms bullet present.
  - Depends on: Phase 3
  - Risk: Low

- [ ] Step 5.4: Update `CLAUDE.md` hook count references (S)
  - File: `CLAUDE.md`
  - Change line 58: `21 hooks` → `22 hooks`.
  - Change line 143: `21 registered hooks + 8 shared modules` → `22 registered hooks + 8 shared modules`.
  - Change line 174 Status line: `21 hooks` → `22 hooks`.
  - Verify: `grep -n "21 hooks\|21 registered" CLAUDE.md` returns nothing.
  - Depends on: Phase 3
  - Risk: Low

- [ ] Step 5.5: Update `rules/typescript/hooks.md` count reference (S)
  - File: `.claude/rules/typescript/hooks.md:28`
  - Change `All 21 hooks use PATH=...` → `All 22 hooks use PATH=...`.
  - Verify: grep confirms.
  - Depends on: Phase 3
  - Risk: Low

- [ ] Step 5.6: Update secondary distribution docs (S)
  - Files: `.claude-plugin/marketplace.json:11`, `README.md:61,183,628`, `docs/onboarding/reference_kadmon_harness.md:115`, `docs/onboarding/CLAUDE.template.md:14,87`, `.claude/skills/workspace-surface-audit/SKILL.md:111`.
  - Each: change `21 hooks` → `22 hooks`.
  - CHANGELOG.md: do NOT update historical entries (lines 51, 103 are frozen release summaries — per ADR-025 versioning policy). Add a new entry in the Unreleased section referencing plan-027 / ADR-027 as a feature addition with hook count 21→22.
  - Out of scope: `docs/roadmap/*` (frozen history), `docs/plans/plan-003/010/019/*` (frozen plans), `graphify-out/**` (regenerated artifact — stomping known gotcha per `reference_graphify_update_gotcha.md`).
  - Verify: `grep -rn "21 hooks" --include="*.md" --include="*.json" .` returns only frozen-history paths.
  - Depends on: Phase 3
  - Risk: Low

### Phase 6: Verification

- [ ] Step 6.1: Build (S)
  - Command: `npm run build`
  - Verify: exit 0, `dist/scripts/smoke-all-hooks.js` timestamp updated.
  - Depends on: Phase 5 complete
  - Risk: Low

- [ ] Step 6.2: Typecheck (S)
  - Command: `npx tsc --noEmit`
  - Verify: exit 0, zero errors.
  - Depends on: 6.1
  - Risk: Low

- [ ] Step 6.3: Run target test file (S)
  - Command: `npx vitest run tests/hooks/post-edit-security.test.ts`
  - Verify: all Phase 1 tests pass (green).
  - Depends on: 6.2
  - Risk: Low

- [ ] Step 6.4: Full test suite (M)
  - Command: `npx vitest run`
  - Verify: all 939+ tests pass (new hook adds ~11 tests → 950+). Zero regressions in `smoke-all-hooks.test.ts`, `quality-gate.test.ts`, `post-edit-typecheck.test.ts`, `console-log-warn.test.ts`.
  - Depends on: 6.3
  - Risk: Medium (hook count change in `smoke-all-hooks.test.ts` is the most likely breakage site; Step 3.3 is the primary defense)

- [ ] Step 6.5: Manual latency smoke test (M)
  - Script: time 3 hook invocations end-to-end on representative `.py` files (small: <50 lines; medium: ~200 lines; large: ~500 lines) using `time node .claude/hooks/scripts/post-edit-security.js < input.json`.
  - Verify: P95 < 500ms on Windows (per ADR-027 acceptance criterion #4). Record in plan artifact as completion note. If P95 > 500ms, escalate per ADR-027 Risk Mitigation — tighten bandit flags to `--severity-level high`.
  - Depends on: 6.4
  - Risk: Medium (Windows cold start adds ~236ms; bandit on a 500-line file may push total to 600ms+)

- [ ] Step 6.6: Plugin-mode smoke (optional — Sprint E candidate) (L)
  - Command: `npx tsx scripts/dogfood-plugin-session.ts` (if updated; otherwise manual)
  - Verify: hook fires under plugin mode (`KADMON_RUNTIME_ROOT` set), all 22 hooks register cleanly.
  - Note: OPTIONAL for this plan — the dogfood harness is itself being hardened elsewhere. If time-boxed, document as deferred and move to Phase 7.
  - Depends on: 6.5
  - Risk: Medium

### Phase 7: Commit

- [ ] Step 7.1: Run `/chekpoint` at **full** tier (M)
  - Rationale: this touches production hook code (.claude/hooks/scripts/) + hook registration (.claude/settings.json, .claude-plugin/hooks.json) + 7 rule/doc files. Full tier is mandatory per the `/chekpoint` Tiers table in `rules/common/development-workflow.md` ("Production .js in .claude/hooks/scripts/" → full).
  - Expected reviewers: typescript-reviewer (for `.js` + `.ts` test), spektr (auth/exec surface — `execFileSync`), orakle (no DB surface — will no-op), kody (consolidator).
  - Verify: no BLOCKs from any specialist; kody consolidates; Phase 3 gate passes.
  - Depends on: Phase 6 complete
  - Risk: Medium (spektr may flag bandit-exec subprocess handling — mitigation: flag-injection test case 1.9 is pre-baked defense)

- [ ] Step 7.2: Commit with conventional scope + Reviewed footer (S)
  - Message:
    ```
    feat(hooks): add post-edit-security hook (bandit SAST for Python)

    Closes ADR-027: Python bandit SAST auto-invoke hook.
    - New hook .claude/hooks/scripts/post-edit-security.js runs
      `bandit -ll <file>` on .py edits. Warn-only (exit 1 on findings),
      graceful fallback when bandit is not installed.
    - Hook count 21 → 22. Registered under PostToolUse Edit|Write
      matcher in .claude/settings.json; .claude-plugin/hooks.json
      regenerated via scripts/generate-plugin-hooks.ts.
    - 11 new test cases at tests/hooks/post-edit-security.test.ts
      covering bandit present/missing, findings/clean, skip paths,
      disabled-hook env var, flag-injection safety, durationMs logging.
    - Docs synced: CLAUDE.md, rules/common/hooks.md,
      rules/typescript/hooks.md, rules/python/security.md,
      rules/python/hooks.md, README.md, marketplace.json,
      reference_kadmon_harness.md, CLAUDE.template.md,
      workspace-surface-audit/SKILL.md.

    Reviewed: full
    ```
  - Verify: `git log -1 --format=%B` shows the full message; footer matches `Reviewed: full`.
  - Depends on: 7.1
  - Risk: Low

### Testing Strategy

- **Unit**: `tests/hooks/post-edit-security.test.ts` — 11 cases covering exit 0/1 paths, skip-list, disabled-hook env var, flag-injection, durationMs logging, bandit missing, empty input.
- **Integration**: `tests/scripts/smoke-all-hooks.test.ts` updated to assert 22 hooks register cleanly (catches hook registration drift).
- **Manual smoke**: latency measurement on 3 representative `.py` files (Phase 6.5) and end-to-end invocation via stdin (Phase 2.6).
- **Fixtures**: reuse existing clean `tests/fixtures/lang-py/example.py`; add `tests/fixtures/lang-py/insecure.py` with a deterministic bandit finding.
- **Coverage target**: 80%+ on new hook code (`rules/common/testing.md`). The 11 test cases cover every branch (disabled, empty input, non-py skip, test-path skip, dep-path skip, bandit missing, bandit clean, bandit findings, flag-injection, durationMs, fixture reuse) — should exceed 80%.

### Risks & Mitigations

- **Risk**: bandit output format drifts across versions → test assertions on bandit stderr become brittle.
  - **Mitigation**: Step 1.3 asserts against generic markers (`/bandit/i`, `/Issue:|Severity:|>>/`), not exact strings. If a future bandit version changes all three markers, the test breaks loudly and prompts a conscious update.

- **Risk**: P95 latency exceeds 500ms on Windows cold start.
  - **Mitigation**: Step 6.5 measures empirically; if over budget, ADR-027 pre-authorizes tightening to `bandit -ll --severity-level high` before shipping. Not a blocker — a scope adjustment inside the same plan.

- **Risk**: Phase 3.3 (smoke-all-hooks count) is forgotten → `npx vitest run` breaks on a stale assertion.
  - **Mitigation**: Step 6.4 full-suite run is explicit defense; Step 3.3 is a pre-Phase-6 dependency so breakage surfaces inside the intended workflow.

- **Risk**: `scripts/generate-plugin-hooks.ts` is the source of truth but someone edits `.claude-plugin/hooks.json` by hand (Step 3.2 forgotten) → drift on next generator run.
  - **Mitigation**: Step 3.1 explicitly edits `.claude/settings.json` (not the plugin manifest); Step 3.2 explicitly regenerates. Plan text calls out the flow.

- **Risk**: bandit flag-injection via a relative path starting with `-` passes the hook but produces a confusing error.
  - **Mitigation**: Step 2.3 resolves the path to absolute before `execFileSync`, mirroring `quality-gate.js:44`. Step 1.9 test pins this behavior.

- **Risk**: `KADMON_SKIP_BANDIT_CHECK` env var is enabled in production by mistake (user sets it in shell profile).
  - **Mitigation**: the guard in Step 2.2 gates the env var behind `VITEST || NODE_ENV === "test"` — identical pattern to `agent-metadata-sync.js`. Without that gate, production is unaffected.

- **Risk**: The dirty fixture (`insecure.py`) gets picked up by project-wide security scans (e.g., spektr reviewing the plan commit itself).
  - **Mitigation**: fixture path under `tests/fixtures/lang-py/` matches every existing skip pattern (`tests/`). Header comment marks it as a test fixture. No runtime execution path.

### Success Criteria

- [ ] All 11 Phase 1 tests pass (green) under `npx vitest run tests/hooks/post-edit-security.test.ts`.
- [ ] Full suite `npx vitest run` passes with 950+ tests (previous 939 + ~11 new).
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `.claude/hooks/scripts/post-edit-security.js` exists and manually invocable via stdin (Step 2.6 smoke passes).
- [ ] `.claude-plugin/hooks.json` contains the new PostToolUse Edit|Write entry in `${HOOK_CMD_PREFIX}` form (Step 3.2).
- [ ] `scripts/smoke-all-hooks.ts` + `tests/scripts/smoke-all-hooks.test.ts` count assertions at 22 (Step 3.3).
- [ ] P95 end-to-end hook latency on Windows < 500ms across 3 representative `.py` files (Step 6.5).
- [ ] All 5 rule / doc / metadata count updates applied (Phase 5 steps 5.1-5.6).
- [ ] `CLAUDE.md` Status line reflects 22 hooks (Step 5.4).
- [ ] Hook warn-not-fails cleanly when bandit is absent (Step 1.5 + Step 2.6 smoke).
- [ ] Commit lands at `Reviewed: full` tier with `/chekpoint` no-BLOCK gate (Step 7.1-7.2).
- [ ] ADR-027 status moves from `proposed` to `accepted` (follow-up after plan ships — not part of this plan).
