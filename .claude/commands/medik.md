---
description: "Full harness diagnostic — 14 health checks + deep agent analysis + repair. Alias: /MediK"
agent: mekanik, kurator
skills: [systematic-debugging, coding-standards]
---

## Arguments

- `harness | consumer` — explicit profile override (highest precedence). Optional. Diagnostic banner only — does NOT skip any check (ADR-033).
- `KADMON_MEDIK_PROFILE=harness|consumer` — env var fallback (banner-level).
- `KADMON_PROJECT_PROFILE=harness|web|cli` — umbrella env var (lower precedence; `web|cli` collapsed → `consumer`).
- Without args: profile auto-detected from filesystem markers via `detectMedikProfile()`.

## Purpose
Full harness health diagnostic. Runs 14 mechanical checks grouped into 4 categories, invokes mekanik and kurator for deep analysis, presents all findings in conversation, and repairs what the user approves. No file artifacts — results are displayed directly.

Always runs the full pipeline. If you're running /medik, you want the complete picture.

## Steps

### Phase 0: Runtime root resolution + detection banner + flag detection

**Runtime root resolution** (run FIRST, once — reuse `$RUNTIME_ROOT` and `$CONSUMER_CWD` in every mechanical snippet below):

All mechanical invocations live in the harness install (repo checkout or plugin cache), NOT in the consumer project. In a consumer repo, cwd-relative paths like `./scripts/lib/...` do not exist — they die with `ERR_MODULE_NOT_FOUND` (AUD-04). Resolve where the harness CODE lives first; the consumer project's cwd is only ever passed as DATA (`--cwd`).

```bash
CONSUMER_CWD="$(pwd)"
# Precedence: KADMON_RUNTIME_ROOT (installer/env, ADR-010) → CLAUDE_PLUGIN_ROOT
# (plugin mode) → walk-up from cwd looking for the harness marker
# (package.json name "kadmon-harness") → cwd as last resort (harness-repo dev).
RUNTIME_ROOT="${KADMON_RUNTIME_ROOT:-${CLAUDE_PLUGIN_ROOT:-}}"
if [ -z "$RUNTIME_ROOT" ]; then
  _dir="$CONSUMER_CWD"
  while :; do
    if [ -f "$_dir/package.json" ] && grep -q '"name": *"kadmon-harness"' "$_dir/package.json" 2>/dev/null; then
      RUNTIME_ROOT="$_dir"
      break
    fi
    _parent="$(dirname "$_dir")"
    [ "$_parent" = "$_dir" ] && break
    _dir="$_parent"
  done
fi
RUNTIME_ROOT="${RUNTIME_ROOT:-$CONSUMER_CWD}"
echo "RUNTIME_ROOT=$RUNTIME_ROOT (harness code) | CONSUMER_CWD=$CONSUMER_CWD (project under diagnosis)"
```

> **Portability rule (AUD-04):** every mechanical snippet in this file MUST reference harness code via `$RUNTIME_ROOT` and pass the consumer project only as data (`--cwd "$CONSUMER_CWD"`). Keep `npx tsx -e` scripts on a SINGLE line — multi-line `tsx -e` scripts exit silently with code 0 on Windows Git Bash (tsx 4.x), which reads as a false PASS. With `tsx -e`, trailing args start at `process.argv[1]`.

> **Smoke-test note (AUD-30):** every embedded inline-JS `tsx -e` / `node -e` one-liner in this file is smoke-tested for syntax drift by `tests/commands/medik-snippets.test.ts`, which extracts each snippet body and runs `node --check` against it (parse-only, no execution — the snippets read positional argv wired up by the surrounding Bash and cannot be dry-run standalone). A syntax error introduced while editing this file fails that test instead of only surfacing when someone runs `/medik`. When adding a new inline snippet here, keep it double-quoted with single-quoted JS internals (no escaped double quotes) so the extraction regex keeps matching it.

Then emit the diagnostic banner and inspect `$ARGUMENTS`.

**Profile detection** (ADR-033 — informational only, all 14 checks run regardless):

```bash
npx tsx -e "const u=require('node:url'),p=require('node:path');import(u.pathToFileURL(p.join(process.argv[1],'scripts/lib/detect-project-language.ts')).href).then(m=>{const profile=m.detectMedikProfile(process.argv[2],process.argv[3]||undefined);const source=process.argv[3]?'arg':(process.env.KADMON_MEDIK_PROFILE?'env':'markers');console.log('Detected: '+profile+' (source: '+source+')');}).catch(e=>{console.error('banner failed: '+e.message);process.exit(1);});" "$RUNTIME_ROOT" "$CONSUMER_CWD" "$ARGUMENTS"
```

The banner is INFORMATIONAL ONLY. All 14 checks run regardless of profile (ADR-033). Per-check NOTE responses (e.g. "no consumer-local agents — nothing to lint") come from the checks themselves via cwd-existence guards, not from this banner.

**`--ALV` flag** (Attach-Log-Verify):
If `$ARGUMENTS` matches `--ALV`, generate a redacted diagnostic report and exit — skip Phases 1-4 entirely.

```bash
npx tsx -e "const u=require('node:url'),p=require('node:path');import(u.pathToFileURL(p.join(process.argv[1],'scripts/lib/medik-alv.ts')).href).then(m=>{console.log('ALV report written to: '+m.writeAlvReport(process.argv[2]));}).catch(e=>{console.error('ALV failed: '+e.message);process.exit(1);});" "$RUNTIME_ROOT" "$CONSUMER_CWD"
```

The report (`diagnostic-YYYY-MM-DDTHHmm.txt`) contains:
- Header: timestamp, platform, Node version, git branch/HEAD
- `=== INSTALL-DIAGNOSTIC ===` — last 10 install-diagnostic log entries
- `=== HOOK-ERRORS ===` — last 10 hook-error log entries (or `(no recent hook errors)`)
- `=== FRESH-HEALTH ===` — live `checkInstallHealth()` result

All paths are redacted (homedir → `~`, cwd → `.`, user segments masked). File mode is `0o600`.

If `$ARGUMENTS` is empty or does not match a known flag, continue to Phase 1.

### Phase 1: Health Checks (direct — no agent)

Run all 14 checks directly. Checks 1-3, 6, 7 are **language-aware** per ADR-020: resolve the project toolchain via `detectProjectLanguage()` (from `$RUNTIME_ROOT/scripts/lib/detect-project-language.ts`, imported the same way as the Phase 0 banner) and run the detected commands. If the toolchain returns `null` for a step (e.g. `build` for Python), mark it as `(skipped: no X step for <language>)` — not a failure.

**Language + test-command resolution** (compute once, before running checks 1-3, 6, 7):

```bash
LANGUAGE=$(npx tsx -e "const u=require('node:url'),p=require('node:path');import(u.pathToFileURL(p.join(process.argv[1],'scripts/lib/detect-project-language.ts')).href).then(m=>{console.log(m.detectProjectLanguage(process.argv[2]));}).catch(e=>{console.error('language detect failed: '+e.message);process.exit(1);});" "$RUNTIME_ROOT" "$CONSUMER_CWD" 2>/dev/null)
TEST_CMD="npx vitest run"
if [ "$LANGUAGE" = "typescript" ] || [ "$LANGUAGE" = "mixed" ]; then
  TEST_CMD=$(npx tsx -e "const u=require('node:url'),p=require('node:path');import(u.pathToFileURL(p.join(process.argv[1],'scripts/lib/medik-checks/test-runner-detect.ts')).href).then(m=>{console.log(m.detectTestCommand(process.argv[2]).command);}).catch(e=>{console.error('test-runner-detect failed: '+e.message);process.exit(1);});" "$RUNTIME_ROOT" "$CONSUMER_CWD" 2>/dev/null)
elif [ "$LANGUAGE" = "python" ]; then
  TEST_CMD="pytest"
fi
echo "Detected language: $LANGUAGE | test command: $TEST_CMD"
```

- If `$LANGUAGE` is `unknown`: skip checks 1 (Build), 2 (Typecheck), 3 (Tests), 6 (dist/ sync), 7 (Dependencies) entirely — report each as `NOTE: language not detected, toolchain checks skipped` instead of running any toolchain command. `getToolchain()`'s TS fallback for `unknown`/`mixed` exists for /chekpoint's conservative-default behavior (never silently skip a needed gate on a diff) — that invariant does NOT transfer to /medik diagnostics. /chekpoint's own conservative default is unaffected by this rule; this is scoped to /medik's Phase 1 checks only. An undetected repo genuinely has no toolchain command to run, so forcing `npm run build` / `npx tsc --noEmit` / `$TEST_CMD` / `npm audit` against it manufactures false FAILs and burns Phase 2 agent analysis on nonexistent problems.
- If `$LANGUAGE` is `typescript` or `mixed`: Check 3 (Tests) uses `$TEST_CMD`, auto-detected as `npx jest` or `npx vitest run` from `package.json` signals (scripts.test content, then dependencies) — see `scripts/lib/medik-checks/test-runner-detect.ts`. Default (no signal found) stays `npx vitest run`, the existing harness convention.
- If `$LANGUAGE` is `python`: Check 3 uses `pytest`; checks 1 and 6 are skipped by design (no build step, no `dist/` in Python projects).

| # | Check | Language | Command / Method | What to look for |
|---|-------|----------|-----------------|------------------|
| **Core** |
| 1 | Build | TS | `npm run build` | Compilation errors, EBUSY locks, missing files |
|   |       | Python | (skipped — pyproject.toml builds happen via `pip install -e .` on demand, not every health check) | — |
|   |       | unknown | (skipped — language not detected, toolchain checks skipped) | — |
| 2 | Typecheck | TS | `npx tsc --noEmit` | Type errors (TS2xxx codes) |
|   |           | Python | `mypy .` (fallback `pyright`) | Type errors; warn if tool missing |
|   |           | unknown | (skipped — language not detected, toolchain checks skipped) | — |
| 3 | Tests | TS | `$TEST_CMD` (auto-detected: `npx jest` or `npx vitest run` — see language resolution above) | Test failures, timeout errors |
|   |       | Python | `pytest` | Test failures; warn if pytest missing |
|   |       | unknown | (skipped — language not detected, toolchain checks skipped) | — |
| **Runtime** |
| 4 | Hook errors | both | Read `~/.kadmon/hook-errors.log` | Recent errors, crash patterns |
| 5 | DB health | both | Read `~/.kadmon/kadmon.db` | File exists, 7 tables present (sessions, instincts, cost_events, hook_events, agent_invocations, sync_queue, research_reports), no corruption |
| 9 | Install health | both | `npx tsx -e "const u=require('node:url'),p=require('node:path');import(u.pathToFileURL(p.join(process.argv[1],'scripts/lib/install-health.ts')).href).then(m=>{const r=m.checkInstallHealth(process.argv[1]);console.log(JSON.stringify(r,null,2));process.exit(r.ok?0:1);}).catch(e=>{console.error('install-health failed: '+e.message);process.exit(1);});" "$RUNTIME_ROOT"` | Canonical root symlinks (ADR-019) intact, `dist/` present and fresh, no anomalies. Report includes tri-state symlink detection (symlink_ok/junction_ok/broken_target/text_file/regular_dir/missing) + inPluginCache flag + runtimeRootEnv capture (ADR-024) |
| 11 | Hook health 24h | both | checks runner `--checks 11` (see Checks 10-14 note) | Blocking hooks in last 24h; avg duration exceeding budget (observe-pre/post: 50ms, no-context-guard: 100ms, others: 500ms) |
| 13 | Skill-creator probe | both | checks runner `--checks 13` (see Checks 10-14 note) | skill-creator plugin present in plugin cache, project skills, or global skills |
| **Code hygiene** |
| 6 | dist/ sync | TS | Compare `$CONSUMER_CWD/dist/` timestamps vs `$CONSUMER_CWD/scripts/lib/` (excludes `*.d.ts` — declaration files don't compile). **Guarded**: if `$CONSUMER_CWD/scripts/lib/` does not exist, skip with `NOTE: no scripts/lib/ directory — dist/ sync check is harness-specific, skipped` instead of forcing a meaningless comparison (this check assumes the harness's own `scripts/lib/` -> `dist/` layout; a generic TS repo with its own bundler output has nothing comparable) | Stale compiled output, missing files |
|   |            | Python | (skipped — no dist/ in Python projects) | — |
|   |            | unknown | (skipped — language not detected, toolchain checks skipped) | — |
| 7 | Dependencies | TS | `npm audit` | Vulnerable packages, outdated deps |
|   |              | Python | `pip-audit` (warn if not installed) | Vulnerable packages |
|   |              | unknown | (skipped — language not detected, toolchain checks skipped) | — |
| 8 | Agent frontmatter | both | `node -e "if (!require('fs').existsSync(require('path').join(process.argv[1], '.claude/agents'))) { console.log(JSON.stringify({ status: 'NOTE', category: 'code-hygiene', message: 'no consumer-local agents in this project — nothing to lint' })); process.exit(0); }" "$CONSUMER_CWD"` then `npx tsx "$RUNTIME_ROOT/scripts/lint-agent-frontmatter.ts" --agents-dir "$CONSUMER_CWD/.claude/agents" --skills-dir "$CONSUMER_CWD/.claude/skills"` if guard passed | `skills:` field parses as YAML list (per ADR-012), every declared skill resolves to `.claude/skills/<name>/SKILL.md` (per ADR-013 — flat `<name>.md` files are invisible to the loader) |
| **Knowledge hygiene** |
| 10 | Stale plans | both | checks runner `--checks 10` (see Checks 10-14 note) | `status: pending` plans older than 3 days with recent git activity (WARN); accepted/completed plans ignored |
| 12 | Instinct decay | both | checks runner `--checks 12` (see Checks 10-14 note) | Active instincts with confidence < 0.3 and last_observed_at > 30 days ago (or NULL) — advisory NOTE, not blocking |
| 14 | Capability alignment | both | checks runner `--checks 14` (see Checks 10-14 note) | Skill/agent/command metadata drift: capability-mismatch (FAIL), path-drift (FAIL), command-skill-drift (FAIL), ownership-drift (WARN), heuristic-tool-mismatch (WARN), orphan-skill (NOTE). Opt-in `requires_tools:` skill frontmatter + heuristic body-scan fallback. See plan-029 + ADR-029. |

> **Note:** Check 8 stays TS-only by design. The harness's own agents ARE TypeScript, so the frontmatter linter is always run from the harness repo regardless of the consumer project's language. Check 8 is wrapped in a cwd-existence guard — if `.claude/agents/` is absent in cwd, emit NOTE and skip the linter invocation ("no consumer-local agents in this project — nothing to lint").
>
> **Note:** Check 9 exit code is 0 when `report.ok === true`, 1 otherwise. `checkInstallHealth()` always validates `$RUNTIME_ROOT` (the harness's own install location — the canonical `agents`/`skills`/`commands` symlinks and `dist/` live there per ADR-019), never `$CONSUMER_CWD`. Passing the consumer project's cwd would guarantee a false FAIL in every consumer repo — those symlinks only ever exist at the harness install root, not in an arbitrary project being diagnosed. mekanik reads the JSON output in Phase 2 and suggests the matching remediation (PowerShell for plugin-cache, git checkout for dev-clone paths — see `scripts/lib/install-remediation.ts`). Historical diagnostics live in `~/.kadmon/install-diagnostic.log` (ADR-024).
>
> **Note (Check 3):** the test command is resolved once during the language + test-command resolution step above and reused verbatim in Phase 3's regression gate — never re-hardcode `npx vitest run` at either call site. See `scripts/lib/medik-checks/test-runner-detect.ts` for the jest-vs-vitest detection logic (script content wins over dependency signals; default is vitest).
>
> **Note (Checks 10-14):** implemented as `runCheck(ctx: CheckContext): CheckResult` modules under `$RUNTIME_ROOT/scripts/lib/medik-checks/`, executed via the single CLI runner:
>
> ```bash
> npx tsx "$RUNTIME_ROOT/scripts/lib/medik-checks-cli.ts" --cwd "$CONSUMER_CWD"
> ```
>
> One invocation runs all five (default `--checks 10,11,12,13,14`) and prints ONE JSON array — prefer it over five separate spawns; use `--checks N[,M]` only to re-run individual checks (e.g. Phase 4 verify). The runner computes the real `projectHash` from `--cwd` via `detectProject()` (sha256 of the git remote url — the exact recipe the hooks persist with), so the DB-filtered checks #11/#12 query the correct rows. NEVER hand-build a `CheckContext` with a placeholder hash ("cli") — it matches zero rows and yields silent false PASS (AUD-05). Per-check crashes are captured as NOTE entries inside the array (the runner never dies whole); exit code is 1 only when at least one check reports FAIL, 2 on usage errors.
>
> Each module exports a standard interface (`status: PASS|NOTE|WARN|FAIL`, `category`, `message`, `details?`). Checks 11-12 are read-only and never mutate the database. Check 14 reads `.claude/` metadata only — no DB, no mutation. All 14 checks run in any cwd (ADR-033). Checks #8 and #14 emit a NOTE when their target directories (`.claude/agents/`, `.claude/skills/`) are absent — informational, not a defect. Checks #11 and #12 are already SQLite-filtered by `project_hash` derived from cwd.

### Phase 2: Deep Analysis (agents — always runs)

Invoke both agents in parallel, regardless of Phase 1 results:

1. **mekanik** (sonnet) — Diagnoses any FAIL or WARN from Phase 1. Analyzes root cause, not just symptoms. If all checks pass, analyzes hook-errors.log patterns and build edge cases.
2. **kurator** (sonnet) — Full code health scan of the codebase area relevant to the /medik scope (hooks, scripts, core lib). Looks for: dead code, duplication, unused imports, security pattern gaps, style inconsistencies, structural issues.

Both agents report findings but do NOT modify any files yet.

### GATE: User Approval

**MANDATORY STOP.** Present all findings directly in conversation:
- Phase 1 results table
- mekanik findings with severity
- kurator findings with severity
- Prioritized fix list with owner (mekanik/kurator)

Ask: **"Found N problems. Fix them?"**

Wait for explicit approval. User may approve all, some, or none.

**Escalation rule:** If any finding requires architectural changes (new subsystems, schema changes, multi-component redesign), flag it as "too big for /medik — recommend /abra-kdabra" and exclude from the fix list.

### Phase 3: Repair (agents fix what was approved)

Each agent fixes its own findings:
- **mekanik** fixes: build errors, race conditions, compilation issues, FAIL-level problems
- **kurator** fixes: dead code, duplication, unused imports, style, pattern gaps

Workflow:
1. mekanik repairs first (build must work before cleanup)
2. kurator repairs second (cleanup assumes green build)
3. After each agent's batch: re-run `$TEST_CMD` (the language/runner-resolved command from Phase 1's language + test-command resolution step — `npx jest`/`npx vitest run` for TS/mixed, `pytest` for Python) to verify no regressions. If `$LANGUAGE` is `unknown`, there is no test command to re-run — skip this verification step for that repo.

### Phase 4: Verify

Re-run all 14 health checks to confirm everything is green. Report final status in conversation grouped by category (Core / Runtime / Code hygiene / Knowledge hygiene).

## Output
Health check table + agent findings + fix results + verification — all in conversation, no file artifacts.

## Example
```
Phase 1 — Health Checks:
  1. Build:               PASS
  2. Typecheck:           PASS
  3. Tests:               PASS (411 passing)
  4. Hook errors:         WARN (54 ensure-dist EBUSY errors)
  5. DB health:           PASS
  6. dist/ sync:          PASS
  7. Dependencies:        WARN (7 vulnerabilities, all dev/transitive)
  8. Agent frontmatter:   PASS

Phase 2 — Deep Analysis:
  mekanik: 1 finding (EBUSY race condition — root cause: concurrent cpSync)
  kurator: 12 findings (2 security gaps, 1 portability, 5 duplication, 2 dead code, 2 style)

GATE: "Found 13 problems. Fix them?"

Phase 3 — Repair:
  mekanik: Fixed EBUSY — atomic rename in build script
  kurator: Fixed 11 items — security guards, dedup, dead code, style

Phase 4 — Verify:
  All 14 checks: PASS
```
