---
number: 4
title: Hook script cleanup and hardening
date: 2026-04-10
status: completed
needs_tdd: false
route: B
adr: none
---

# Plan: Hook Script Cleanup and Hardening [konstruct]

## Overview

Fix 12 findings from kurator + mekanik agents during /medik diagnostic, plus 1 bonus EBUSY race condition fix. These are hook script cleanup items: security pattern gaps, dead code, hardcoded paths, duplicated functions, and style inconsistencies. All changes are in `.claude/hooks/scripts/*.js` (plain JS, no TypeScript compilation required for the hooks themselves).

## Assumptions

- All 12 findings verified by reading every affected file (28 hook scripts + package.json)
- No ADR needed -- these are maintenance fixes, not architectural decisions
- `needs_tdd: false` because hook scripts are .js files tested via execFileSync integration tests, not unit-testable TypeScript library exports
- Existing tests in `tests/hooks/` cover hook behavior; fixes must not break them
- The `logHookError` function from `hook-logger.js` is already imported by backup-rotate.js (verified: it is NOT imported yet -- will need adding)

## Phase 1: Security Hardening (WARN-level, high priority)

These fixes close secret-leaking and input-validation gaps. Ship first.

- [ ] Step 1.1: Add session_id regex guard to observe-pre.js (S)
  - File: `.claude/hooks/scripts/observe-pre.js`
  - What: Line 11, change `if (!sid) process.exit(0)` to `if (!sid || !/^[a-zA-Z0-9_-]+$/.test(sid)) process.exit(0)` -- matching the guard already in observe-post.js line 11
  - Verify: `node -e "..." < echo '{"session_id":"../../../etc"}' | node .claude/hooks/scripts/observe-pre.js` exits 0 without writing. Also run `npx vitest run tests/hooks/observe` if observe hook tests exist
  - Depends on: none
  - Risk: Low -- identical pattern already proven in observe-post.js

- [ ] Step 1.2: Add 3 missing secret patterns to scrubSecrets in observe-post.js (S)
  - File: `.claude/hooks/scripts/observe-post.js`
  - What: In the `scrubSecrets()` function (lines 23-31), add 3 new `.replace()` calls after the existing 4:
    ```js
    .replace(/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]")
    .replace(/sbp_[a-f0-9]{40,}/g, "[REDACTED]")
    ```
    These match the patterns in `commit-quality.js` lines 14-16 (sk-ant- for Anthropic, AKIA for AWS, sbp_ for Supabase)
  - Verify: Grep observe-post.js for all 7 patterns. Cross-reference with commit-quality.js SECRET_PATTERNS array to confirm parity
  - Depends on: none
  - Risk: Low -- additive regex, no behavioral change for non-secret strings

## Phase 2: Portability (WARN-level, medium priority)

Removes hardcoded project path for bootstrap portability.

- [ ] Step 2.1: Derive auto-memory directory from process.cwd() instead of hardcoded string (M)
  - Files:
    - `.claude/hooks/scripts/session-start.js` (lines 304, 320)
    - `.claude/hooks/scripts/session-end-all.js` (line 207)
    - `.claude/hooks/scripts/pre-compact-save.js` (line 126)
  - What: In all 4 locations, replace the hardcoded `"C--Command-Center-Kadmon-Harness"` with a computed value. The Claude auto-memory directory encodes the project path by replacing path separators and colons with hyphens. Derive it:
    ```js
    // At the top of each file (or in a shared helper), add:
    function getAutoMemoryDir(cwd) {
      const encoded = cwd.replace(/[\\/]/g, "-").replace(/:/g, "");
      return path.join(os.homedir(), ".claude", "projects", encoded, "memory");
    }
    ```
    Then replace each hardcoded `path.join(os.homedir(), ".claude", "projects", "C--Command-Center-Kadmon-Harness", "memory")` with `getAutoMemoryDir(cwd)`.
    - session-start.js: `cwd` is already available (line 34). Replace at lines 300-305 and 316-321.
    - session-end-all.js: `cwd` is already available (line 62). Replace at lines 203-208.
    - pre-compact-save.js: use `input.cwd ?? process.cwd()` (already used at line 111). Replace at lines 122-127.
  - Design decision: Inline the helper in each file (3 files, ~3 lines each) rather than extracting to a shared module. Reason: these are the only consumers, and adding a shared module increases the import graph for all 20 hooks. If a 4th consumer appears, extract then.
  - Verify: `grep -r "C--Command-Center" .claude/hooks/scripts/` returns 0 matches after the change
  - Depends on: none
  - Risk: Medium -- the encoding logic must exactly match Claude's directory naming. Verify by comparing `getAutoMemoryDir(process.cwd())` output against the actual directory on disk. If encoding differs (e.g., Claude uses a hash, not literal replacement), fall back to globbing `~/.claude/projects/*/memory/` or reading the directory. MITIGATION: Test the encoding function manually before applying to all 3 files. If it does not match, use `fs.readdirSync(path.join(os.homedir(), ".claude", "projects")).find(d => ...)` as a fallback.

## Phase 3: Deduplication (WARN + NOTE level)

Removes duplicated code to reduce maintenance surface.

- [ ] Step 3.1: Export gitExec from evaluate-patterns-shared.js, import in session-start.js (S)
  - Files:
    - `.claude/hooks/scripts/evaluate-patterns-shared.js` (line 12)
    - `.claude/hooks/scripts/session-start.js` (lines 18-28)
  - What:
    1. In evaluate-patterns-shared.js, change `function gitExec` to `export function gitExec` (line 12)
    2. In session-start.js, remove the local `gitExec` function (lines 18-28) and add `import { gitExec } from "./evaluate-patterns-shared.js";` after the existing imports (line 12 area)
  - Verify: `grep "function gitExec" .claude/hooks/scripts/session-start.js` returns 0 matches. Run existing session-start tests if any
  - Depends on: none
  - Risk: Low -- identical implementation, just moving the canonical location

- [ ] Step 3.2: Replace inline git log calls with shared gitExec in session-end-all.js and pre-compact-save.js (S)
  - Files:
    - `.claude/hooks/scripts/session-end-all.js` (lines 211-216)
    - `.claude/hooks/scripts/pre-compact-save.js` (lines 131-135)
  - What: Both files already import from `evaluate-patterns-shared.js`. After Step 3.1 exports `gitExec`, update the import to include it:
    1. In session-end-all.js line 12: change `import { evaluateAndApplyPatterns } from "./evaluate-patterns-shared.js"` to `import { evaluateAndApplyPatterns, gitExec } from "./evaluate-patterns-shared.js"`
    2. Replace lines 211-216 (the try/catch with `execFileSync("git", ["log", "--oneline", "-1"], ...)`) with: `lastCommit = gitExec(["log", "--oneline", "-1"], cwd) ?? "";`
    3. In pre-compact-save.js line 10: same import update
    4. Replace lines 131-135 (the try/catch with `execFileSync("git", ["log", "--oneline", "-1"], ...)`) with: `lastCommit = gitExec(["log", "--oneline", "-1"], input.cwd ?? process.cwd()) ?? "";`
  - Verify: `grep "execFileSync.*git.*log.*oneline" .claude/hooks/scripts/session-end-all.js .claude/hooks/scripts/pre-compact-save.js` returns 0 matches
  - Depends on: 3.1

- [ ] Step 3.3: Extract rootDir constant to ensure-dist.js (S)
  - Files:
    - `.claude/hooks/scripts/ensure-dist.js`
    - `.claude/hooks/scripts/session-start.js` (lines 63-68)
    - `.claude/hooks/scripts/session-end-all.js` (lines 139-144)
    - `.claude/hooks/scripts/pre-compact-save.js` (lines 63-68)
  - What:
    1. In ensure-dist.js, add an exported helper:
       ```js
       import { fileURLToPath } from "node:url";
       // ... (already has fs, path, execSync)

       /**
        * Resolve the project root directory from a hook script's import.meta.url.
        * @param {string} metaUrl - The import.meta.url of the calling script
        * @returns {string} Absolute path to the project root
        */
       export function resolveRootDir(metaUrl) {
         return path.resolve(fileURLToPath(new URL(".", metaUrl)), "..", "..", "..");
       }
       ```
    2. In each of the 3 consumer files, replace:
       ```js
       const rootDir = path.resolve(
         fileURLToPath(new URL(".", import.meta.url)),
         "..",
         "..",
         "..",
       );
       ```
       with:
       ```js
       const rootDir = resolveRootDir(import.meta.url);
       ```
    3. Update imports in each file: add `resolveRootDir` to the `ensure-dist.js` import. Remove `fileURLToPath` import from session-start.js and session-end-all.js if no other usage remains. (Note: session-start.js still uses `fileURLToPath` indirectly via `new URL(..., import.meta.url).href` for dynamic imports, but not via direct call -- check before removing. Pre-compact-save.js does not import fileURLToPath at all since it uses `new URL(...).href` pattern.)
  - Verify: `grep "path.resolve.*fileURLToPath.*\\.\\." .claude/hooks/scripts/session-start.js .claude/hooks/scripts/session-end-all.js .claude/hooks/scripts/pre-compact-save.js` returns 0 matches
  - Depends on: none
  - Risk: Low -- pure extraction, no logic change. But verify `fileURLToPath` import removal does not break other usages in the same file

## Phase 4: Dead Code Removal (WARN + NOTE level)

- [ ] Step 4.1: Remove dead variables in commit-quality.js (S)
  - File: `.claude/hooks/scripts/commit-quality.js`
  - What: Remove lines 45-47 (`addedLines` computation) and line 50 (`fileHeaders` computation). These variables are computed but never read -- the loop at line 61 re-splits `diff` directly.
    - Delete lines 44-47:
      ```js
      // Only check added lines (lines starting with +, but not +++ headers)
      const addedLines = diff
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
      ```
    - Delete lines 49-50:
      ```js
      // Detect current file being diffed
      const fileHeaders = diff.split("\n").filter((l) => l.startsWith("+++ b/"));
      ```
    - Keep the `isTestFile`, `isDocFile`, `isScriptOrHook` helper functions and the loop at line 59 (renumbered after deletion)
  - Verify: `grep "addedLines\|fileHeaders" .claude/hooks/scripts/commit-quality.js` returns 0 matches. Run `npx vitest run tests/hooks/commit-quality` if tests exist
  - Depends on: none
  - Risk: Low -- variables are provably dead (grep confirms no read sites)

- [ ] Step 4.2: Remove unused fs imports in post-edit-typecheck.js and quality-gate.js (S)
  - Files:
    - `.claude/hooks/scripts/post-edit-typecheck.js` (line 4: `import fs from "node:fs"`)
    - `.claude/hooks/scripts/quality-gate.js` (line 4: `import fs from "node:fs"`)
  - What: Delete `import fs from "node:fs";` from both files. Neither file references `fs` anywhere in its code.
  - Verify: `grep "^import fs" .claude/hooks/scripts/post-edit-typecheck.js .claude/hooks/scripts/quality-gate.js` returns 0 matches. Both scripts still run without error
  - Depends on: none
  - Risk: Low -- unused import removal

## Phase 5: Error Handling and Logging (WARN + NOTE level)

- [ ] Step 5.1: Add logHookError to backup-rotate.js silent catch (S)
  - File: `.claude/hooks/scripts/backup-rotate.js`
  - What: Line 55-56, the outer catch returns silently. Add logging:
    1. Add import at top: `import { logHookError } from "./hook-logger.js";`
    2. Change the catch block from:
       ```js
       } catch (err) {
         return { backupPath: "", removed: [] };
       }
       ```
       to:
       ```js
       } catch (err) {
         logHookError("backup-rotate", err, { dbPath });
         return { backupPath: "", removed: [] };
       }
       ```
  - Verify: Read backup-rotate.js and confirm logHookError is called in the catch block
  - Depends on: none
  - Risk: Low -- logHookError never throws (by design)

- [ ] Step 5.2: Add instanceof Error guard to all 20 hook catch blocks (M)
  - Files: All 20 registered hook scripts in `.claude/hooks/scripts/` (see list below)
  - What: In every outer `catch (err)` block that uses `err.message`, change to safe narrowing:
    ```js
    // Before:
    catch (err) {
      console.error(JSON.stringify({ error: `hook-name: ${err.message}` }));
    }
    // After:
    catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ error: `hook-name: ${msg}` }));
    }
    ```
    Affected files (20 hooks, note ensure-dist.js already has this pattern):
    - observe-pre.js (line 43)
    - observe-post.js (line 75)
    - block-no-verify.js (line 26)
    - commit-format-guard.js (line 61)
    - commit-quality.js (line 115)
    - config-protection.js (line 73)
    - no-context-guard.js (line 85)
    - git-push-reminder.js (line 60)
    - mcp-health-check.js (line 29)
    - mcp-health-failure.js (line 21)
    - post-edit-typecheck.js (line 27)
    - post-edit-format.js (line 26)
    - quality-gate.js (line 31)
    - console-log-warn.js (line 47)
    - ts-review-reminder.js (line 71)
    - deps-change-reminder.js (line 43)
    - pr-created.js (line 29)
    - session-start.js (line 415)
    - session-end-all.js (line 409)
    - pre-compact-save.js (line 166)
    Also fix inner catch blocks that use `err.message` directly:
    - session-end-all.js lines 244, 317 (`evalErr.message`, `costErr.message`)
    - session-start.js lines 166, 354 (`orphanErr.message`, `dbErr.message`)
    - pre-compact-save.js lines 59, 104, 116 (`sumErr.message`, `dbErr.message`, `evalErr.message`)
  - Verify: `grep -n "err\.message\|Err\.message" .claude/hooks/scripts/*.js | grep -v "instanceof Error"` returns only the hook-logger.js line (which already has the guard) and ensure-dist.js (which already has it)
  - Depends on: none
  - Risk: Low -- purely defensive, no behavioral change for Error instances. String errors now get stringified instead of showing `undefined`

- [ ] Step 5.3: Change 5 warning hooks from console.log to console.error (S)
  - Files:
    - `.claude/hooks/scripts/git-push-reminder.js` (line 56)
    - `.claude/hooks/scripts/mcp-health-check.js` (lines 24-26)
    - `.claude/hooks/scripts/config-protection.js` (line 71)
    - `.claude/hooks/scripts/post-edit-typecheck.js` (lines 22-23)
    - `.claude/hooks/scripts/quality-gate.js` (line 28)
  - What: Change `console.log(...)` to `console.error(...)` for warning output in these 5 hooks. Claude Code routes stderr to the warning display; stdout goes to the conversation. Warnings should use stderr.
    Note: `console-log-warn.js` (line 41) and `ts-review-reminder.js` (line 64) also use `console.log` for warnings, but these were not in the original 5 findings. Include them in this fix for consistency (7 total).
  - Additional note: Do NOT change `console.log` in session-start.js, session-end-all.js, pre-compact-save.js, or pr-created.js -- those are informational output meant for the conversation, not warnings.
  - Verify: `grep "console\.log" .claude/hooks/scripts/git-push-reminder.js .claude/hooks/scripts/mcp-health-check.js .claude/hooks/scripts/config-protection.js .claude/hooks/scripts/post-edit-typecheck.js .claude/hooks/scripts/quality-gate.js .claude/hooks/scripts/console-log-warn.js .claude/hooks/scripts/ts-review-reminder.js` returns 0 matches
  - Depends on: none
  - Risk: Low -- changes output channel from stdout to stderr. Claude Code may display these differently. MITIGATION: Test one hook first (e.g., config-protection.js skipLibCheck warning) and confirm Claude Code still shows the warning to the user

## Phase 6: Style Consistency (NOTE level)

- [ ] Step 6.1: Convert mcp-health-failure.js from single quotes to double quotes (S)
  - File: `.claude/hooks/scripts/mcp-health-failure.js`
  - What: Convert all single-quoted strings to double quotes. The file is 22 lines. All 27 other hook scripts use double quotes. Lines to change: 4, 5, 6, 7, 14 (import paths and string literals).
  - Verify: `grep "'" .claude/hooks/scripts/mcp-health-failure.js` returns 0 matches (no single quotes remain)
  - Depends on: none
  - Risk: Low -- cosmetic only

## Phase 7: Build Script Fix (BONUS from mekanik)

- [ ] Step 7.1: Fix EBUSY race condition in package.json build script (S)
  - File: `package.json`
  - What: The current build script uses `node -e "require('fs').cpSync(...)"` which can cause EBUSY on Windows when concurrent hooks try to copy `schema.sql`. Fix by using copy-to-tmp then rename (atomic on NTFS):
    Change line 8 from:
    ```json
    "build": "tsc && node -e \"require('fs').cpSync('scripts/lib/schema.sql','dist/scripts/lib/schema.sql')\""
    ```
    to:
    ```json
    "build": "tsc && node -e \"const fs=require('fs'),t='dist/scripts/lib/schema.sql.tmp';fs.cpSync('scripts/lib/schema.sql',t);fs.renameSync(t,'dist/scripts/lib/schema.sql')\""
    ```
  - Verify: Run `npm run build` successfully. Verify `dist/scripts/lib/schema.sql` exists and matches `scripts/lib/schema.sql`. Run `npx vitest run` to confirm all tests pass
  - Depends on: none
  - Risk: Low -- renameSync is atomic on NTFS. The tmp file is in the same directory so rename stays on the same filesystem

## Testing Strategy

- **Hook integration tests**: Run existing tests in `tests/hooks/` after each phase: `npx vitest run tests/hooks/`
- **Full suite**: Run `npx vitest run` after all phases complete
- **Manual smoke test**: Start a new Claude Code session to verify session-start.js loads without errors (covers Phase 2 portability + Phase 3 dedup + Phase 5 error handling)
- **TypeScript compilation**: Run `npx tsc --noEmit` after Phase 7 to confirm package.json change does not break build
- **Grep verification**: Each step includes a grep command to mechanically verify the change was applied

## Risks and Mitigations

- Risk: Phase 2 (portability) auto-memory path encoding does not match Claude's actual directory naming convention -> Mitigation: Before applying to all 3 files, test the encoding function against the real directory `~/.claude/projects/` by listing its contents. If encoding differs, use a directory scan fallback
- Risk: Phase 5.3 (console.error) changes how Claude Code displays warnings to the user -> Mitigation: Apply to one hook first, test in a real session, then apply to the remaining hooks
- Risk: Phase 3.3 (rootDir extraction) removing `fileURLToPath` import breaks other usages in session-start.js -> Mitigation: Check all usages of `fileURLToPath` in each file before removing the import. session-start.js uses `new URL(..., import.meta.url).href` for dynamic imports (not fileURLToPath), so the import can be safely removed there. session-end-all.js is the same pattern. Verify pre-compact-save.js does not import it at all (confirmed: it uses `fileURLToPath` via ensure-dist.js only)
- Risk: Phase 5.2 touches all 20 hook files -- a typo could break a hook -> Mitigation: Use a consistent sed-like pattern. Verify each file parses without syntax errors via `node --check .claude/hooks/scripts/<file>.js`

## Success Criteria

- [ ] `grep -r "C--Command-Center" .claude/hooks/scripts/` returns 0 matches (portability)
- [ ] `grep "scrubSecrets" .claude/hooks/scripts/observe-post.js` shows 7 regex patterns (secret parity)
- [ ] `grep "function gitExec" .claude/hooks/scripts/*.js` returns exactly 1 match in evaluate-patterns-shared.js (dedup)
- [ ] `grep "addedLines\|fileHeaders" .claude/hooks/scripts/commit-quality.js` returns 0 matches (dead code)
- [ ] `grep "err\.message" .claude/hooks/scripts/*.js | grep -v "instanceof Error"` returns 0 matches outside hook-logger.js and ensure-dist.js (error handling)
- [ ] All 344+ existing tests pass: `npx vitest run`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] `npm run build` succeeds without EBUSY errors
