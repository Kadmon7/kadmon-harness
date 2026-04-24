---
description: "Full harness diagnostic — 8 health checks + deep agent analysis + repair. Alias: /MediK"
agent: mekanik, kurator
skills: [systematic-debugging, coding-standards]
---

## Purpose
Full harness health diagnostic. Runs 13 mechanical checks grouped into 4 categories, invokes mekanik and kurator for deep analysis, presents all findings in conversation, and repairs what the user approves. No file artifacts — results are displayed directly.

Always runs the full pipeline. If you're running /medik, you want the complete picture.

## Steps

### Phase 1: Health Checks (direct — no agent)

Run all 13 checks directly. Checks 1-3, 6, 7 are **language-aware** per ADR-020: resolve the project toolchain via `detectProjectLanguage()` (from `scripts/lib/detect-project-language.ts`) and run the detected commands. If the toolchain returns `null` for a step (e.g. `build` for Python), mark it as `(skipped: no X step for <language>)` — not a failure.

| # | Check | Language | Command / Method | What to look for |
|---|-------|----------|-----------------|------------------|
| **Core** |
| 1 | Build | TS | `npm run build` | Compilation errors, EBUSY locks, missing files |
|   |       | Python | (skipped — pyproject.toml builds happen via `pip install -e .` on demand, not every health check) | — |
| 2 | Typecheck | TS | `npx tsc --noEmit` | Type errors (TS2xxx codes) |
|   |           | Python | `mypy .` (fallback `pyright`) | Type errors; warn if tool missing |
| 3 | Tests | TS | `npx vitest run` | Test failures, timeout errors |
|   |       | Python | `pytest` | Test failures; warn if pytest missing |
| **Runtime** |
| 4 | Hook errors | both | Read `~/.kadmon/hook-errors.log` | Recent errors, crash patterns |
| 5 | DB health | both | Read `~/.kadmon/kadmon.db` | File exists, 7 tables present (sessions, instincts, cost_events, hook_events, agent_invocations, sync_queue, research_reports), no corruption |
| 9 | Install health | both | `npx tsx -e "import('./scripts/lib/install-health.ts').then(m => { const r = m.checkInstallHealth(process.cwd()); console.log(JSON.stringify(r, null, 2)); process.exit(r.ok ? 0 : 1); })"` | Canonical root symlinks (ADR-019) intact, `dist/` present and fresh, no anomalies. Report includes tri-state symlink detection (symlink_ok/junction_ok/broken_target/text_file/regular_dir/missing) + inPluginCache flag + runtimeRootEnv capture (ADR-024) |
| 11 | Hook health 24h | both | `scripts/lib/medik-checks/hook-health-24h.ts` | Blocking hooks in last 24h; avg duration exceeding budget (observe-pre/post: 50ms, no-context-guard: 100ms, others: 500ms) |
| 13 | Skill-creator probe | both | `scripts/lib/medik-checks/skill-creator-probe.ts` | skill-creator plugin present in plugin cache, project skills, or global skills |
| **Code hygiene** |
| 6 | dist/ sync | TS | Compare `dist/` timestamps vs `scripts/lib/` (excludes `*.d.ts` — declaration files don't compile) | Stale compiled output, missing files |
|   |            | Python | (skipped — no dist/ in Python projects) | — |
| 7 | Dependencies | TS | `npm audit` | Vulnerable packages, outdated deps |
|   |              | Python | `pip-audit` (warn if not installed) | Vulnerable packages |
| 8 | Agent frontmatter | both | `npx tsx scripts/lint-agent-frontmatter.ts` | `skills:` field parses as YAML list (per ADR-012), every declared skill resolves to `.claude/skills/<name>/SKILL.md` (per ADR-013 — flat `<name>.md` files are invisible to the loader) |
| **Knowledge hygiene** |
| 10 | Stale plans | both | `scripts/lib/medik-checks/stale-plans.ts` | `status: pending` plans older than 3 days with recent git activity (WARN); accepted/completed plans ignored |
| 12 | Instinct decay | both | `scripts/lib/medik-checks/instinct-decay-candidates.ts` | Active instincts with confidence < 0.3 and last_observed_at > 30 days ago (or NULL) — advisory NOTE, not blocking |

> **Note:** Check 8 stays TS-only by design. The harness's own agents ARE TypeScript, so the frontmatter linter is always run from the harness repo regardless of the consumer project's language.
>
> **Note:** Check 9 exit code is 0 when `report.ok === true`, 1 otherwise. mekanik reads the JSON output in Phase 2 and suggests the matching remediation (PowerShell for plugin-cache, git checkout for dev-clone paths — see `scripts/lib/install-remediation.ts`). Historical diagnostics live in `~/.kadmon/install-diagnostic.log` (ADR-024).
>
> **Note:** Checks 10-13 are implemented as `runCheck(ctx: CheckContext): CheckResult` modules under `scripts/lib/medik-checks/`. Each exports a standard interface (`status: PASS|NOTE|WARN|FAIL`, `category`, `message`, `details?`). Checks 11-12 are read-only and never mutate the database.

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
3. After each agent's batch: run `npx vitest run` to verify no regressions

### Phase 4: Verify

Re-run all 13 health checks to confirm everything is green. Report final status in conversation grouped by category (Core / Runtime / Code hygiene / Knowledge hygiene).

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
  All 8 checks: PASS
```
