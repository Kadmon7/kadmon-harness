---
number: 28
title: v1.3 Release — /medik Expansion + Diagnostic Export + Graphify Measurement Gate
date: 2026-04-24
status: completed
needs_tdd: true
route: A
adr: ADR-028-v1.3-medik-expansion-release.md
---

## Plan: v1.3 Release — /medik Expansion + Diagnostic Export + Graphify Measurement Gate [konstruct]

### Overview
Ships v1.3.0 of Kadmon Harness: expand `/medik` from 9 to 13 runtime checks (stale-plans, hook-health-24h, instinct-decay-candidates, skill-creator-probe), add `--ALV` diagnostic export with cross-platform redaction, introduce `_v: 1` schema + typed reader for install-diagnostic entries, fix a Check #6 docstring drift, and resolve the ADR-026 graphify adoption gate with a measurement-only benchmark. Locked architectural decisions live in ADR-028.

### Prerequisites
- `git status` clean on `main`
- `npm run build` green, `npx vitest run` green (baseline ~939 tests)
- Node.js + `npm` + `git` available in `PATH`; Windows Git Bash OR PowerShell
- No outstanding v1.2.3 `/chekpoint` BLOCKs

### Phase 0: Research (read-only — no TaskCreate entry)
- [ ] Read `graphify-out/GRAPH_REPORT.md` for god nodes + community structure (harness rule)
- [ ] Confirm `.claude/hooks/scripts/install-diagnostic.js:57` spreads `report` (target for `{_v: 1, ...}`)
- [ ] Read `scripts/lib/install-health.ts` — confirm `InstallHealthReport` export signature (base for `VersionedInstallReport`)
- [ ] Read `scripts/lib/rotating-jsonl-log.ts` — confirm `readRotatingJsonlLog(path, limit)` signature
- [ ] Read `scripts/lib/state-store.ts` — confirm `getHookEventStats(projectHash, since)` signature; fall back to direct query if `since` not accepted
- [ ] Read `scripts/lib/instinct-manager.ts:142-196` — copy decay SQL pattern (read-only variant)
- [ ] Read `.claude/commands/medik.md` Phases 1-4 — map where category grouping + `--ALV` Phase 0 + #10-13 rows land
- [ ] Read `tests/lib/db-health.test.ts` — copy `openDb(':memory:')` + seed + cleanup pattern for new check tests
- [ ] Read `scripts/lib/install-remediation.ts` — confirm `escapeRegex` / `escapePwshDoubleQuoted` exports (reuse, DO NOT recreate)
- [ ] Read `scripts/lib/utils.ts` — confirm `kadmonDataDir()` export (reuse for `~/.kadmon` resolution)
- [ ] `git log --oneline 1f5e8ab^..e75b050` — confirm the 5 graphify revert SHAs still reachable from `main`

### Phase 1: Item 5 — `/medik` Check #6 `.d.ts` spec fix (S, TDD-exempt per testing.md "config/docs" carve-out)
- [ ] Step 1.1: Update Check #6 row in `medik.md` table + narrative
  - File: `.claude/commands/medik.md` (Check #6 row, line ~28)
  - Change: "Compare `dist/` timestamps vs `scripts/lib/`" → append "(excludes `*.d.ts` — declaration files don't compile)"
  - Verify: `grep -n "excludes .*.d.ts" .claude/commands/medik.md` returns the updated row
  - Acceptance: spec text matches runtime behavior at `ensure-dist.js:43`; no code change
  - Depends on: none
  - Risk: Low
- [ ] Commit: `docs(medik): clarify Check #6 excludes .d.ts declarations` — `Reviewed: skip (docs-only)`

### Phase 2: Item 2 — `_v: 1` schema field (S, TDD required)
- [ ] Step 2.1: RED — add `_v: 1` assertion in `install-diagnostic.test.ts`
  - File: `tests/hooks/install-diagnostic.test.ts`
  - Test name: `writes _v: 1 on every entry post-v1.3`
  - Seed a temp `logDir`, call `logInstallDiagnostic(report, tempDir)`, read back via `readInstallDiagnostics`, assert `entries[0]._v === 1`
  - Verify: `npx vitest run tests/hooks/install-diagnostic.test.ts` — fails on `_v` assertion (RED)
  - Depends on: none
  - Risk: Low
- [ ] Step 2.2: GREEN — spread `{_v: 1, ...report}` at write time
  - File: `.claude/hooks/scripts/install-diagnostic.js:57`
  - Change: `_rotatingLog.writeRotatingJsonlLog(logPath, report)` → `_rotatingLog.writeRotatingJsonlLog(logPath, { _v: 1, ...report })`
  - Verify: `npx vitest run tests/hooks/install-diagnostic.test.ts` passes; `readInstallDiagnostics` still returns legacy entries sans `_v` untouched (append-only log)
  - Depends on: 2.1
  - Risk: Low
- [ ] Commit: `feat(install-diagnostic): add _v: 1 schema field to entries` — `Reviewed: lite (ts-reviewer)`

### Phase 3: Item 3 — `readTypedInstallDiagnostics` typed reader (M, TDD required)
- [ ] Step 3.1: RED — author tests covering valid / corrupt / legacy / mixed fixtures
  - File: `tests/lib/install-diagnostic-reader.test.ts`
  - Fixtures: (a) valid v1.3 entry with `_v: 1`; (b) legacy entry sans `_v`; (c) corrupt entry missing `rootDir`; (d) mixed file
  - Tests: `returns VersionedInstallReport[] with _v preserved`, `casts legacy entries as {_v: 0, ...}`, `drops entries missing rootDir|symlinks|timestamp with stderr warning`, `never throws on individual entry failures`
  - Verify: `npx vitest run tests/lib/install-diagnostic-reader.test.ts` — fails (module not implemented)
  - Depends on: Phase 2 complete
  - Risk: Low
- [ ] Step 3.2: GREEN — create `install-diagnostic-reader.ts`
  - File: `scripts/lib/install-diagnostic-reader.ts` (new)
  - Export `interface VersionedInstallReport extends InstallHealthReport { readonly _v: number }`
  - Export `readTypedInstallDiagnostics(logDir?: string, limit?: number): VersionedInstallReport[]`
  - Dynamic import of compiled `.claude/hooks/scripts/install-diagnostic.js` `readInstallDiagnostics`; per-entry validate `rootDir`, `symlinks`, `timestamp`; legacy entries without `_v` cast as `{_v: 0, ...entry}`; corrupt entries dropped with `process.stderr.write`
  - Verify: `npx vitest run tests/lib/install-diagnostic-reader.test.ts` passes; `npx tsc --noEmit` green
  - Depends on: 3.1
  - Risk: Medium (dynamic import from .js file — ensure Node16 resolution works; may need `.js` extension on import)
- [ ] Step 3.3: REFACTOR — confirm no throws escape; verify stderr warning is visible but does not block
  - Verify: manual `node -e "import('./dist/scripts/lib/install-diagnostic-reader.js').then(m => console.log(m.readTypedInstallDiagnostics()))"` — no crash on empty log
  - Depends on: 3.2
  - Risk: Low
- [ ] Commit: `feat(install-diagnostic): typed reader with forward-compat _v handling` — `Reviewed: lite (ts-reviewer)`

### Phase 4: Item 4 — `/medik` Checks #10-12 (L, TDD required, module-per-check)
Common setup: create `scripts/lib/medik-checks/` + `tests/lib/medik-checks/`. Each check exports `runCheck(ctx: CheckContext): CheckResult` where `CheckResult = { status: 'PASS' | 'NOTE' | 'WARN' | 'FAIL', category: 'core' | 'runtime' | 'code-hygiene' | 'knowledge-hygiene', message: string, details?: unknown }`.

- [ ] Step 4.1: Scaffolding — declare shared `CheckContext` + `CheckResult` types
  - File: `scripts/lib/medik-checks/types.ts` (new)
  - Verify: `npx tsc --noEmit` green after scaffolding
  - Depends on: Phase 3 complete
  - Risk: Low
- [ ] Step 4.2: Check #10 stale-plans — RED
  - File: `tests/lib/medik-checks/stale-plans.test.ts`
  - Fixtures: `docs/plans/` in `tmp_path`; (a) `status: pending` + `date: <7 days ago>` + recent git commit → WARN; (b) `status: pending` + `date: <1 day ago>` → PASS; (c) `status: accepted` → PASS (ignored)
  - Verify: fails RED (module not implemented)
  - Depends on: 4.1
  - Risk: Low
- [ ] Step 4.3: Check #10 stale-plans — GREEN
  - File: `scripts/lib/medik-checks/stale-plans.ts` (new)
  - Glob `docs/plans/*.md`; regex `/^status:\s*(\w+)/m` + `/^date:\s*(\d{4}-\d{2}-\d{2})/m` (NO `gray-matter` dep); for each `pending`: compute `now - date > 3 days` AND `execSync('git log --since="7d" -- <path>')` returns non-empty → WARN
  - Verify: tests pass; `category: 'knowledge-hygiene'`
  - Depends on: 4.2
  - Risk: Medium (git execSync latency + Windows path separators)
- [ ] Step 4.4: Check #11 hook-health-24h — RED
  - File: `tests/lib/medik-checks/hook-health-24h.test.ts`
  - Fixtures: seed `hook_events` with `blocks > 0` in last 24h → WARN; with `avgDurationMs > budget` → WARN; empty → PASS
  - Budgets: `observe-pre`/`observe-post` = 50ms, `no-context-guard` = 100ms, others = 500ms
  - Verify: fails RED
  - Depends on: 4.1
  - Risk: Low
- [ ] Step 4.5: Check #11 hook-health-24h — GREEN
  - File: `scripts/lib/medik-checks/hook-health-24h.ts` (new)
  - Reuse `getHookEventStats(projectHash, since)` if signature supports `since`; else inline `SELECT hook_name, SUM(blocks) AS blocks, AVG(duration_ms) AS avg_ms FROM hook_events WHERE project_hash = ? AND timestamp > ? GROUP BY hook_name LIMIT 100`
  - App-layer filter with budget map; category: `runtime`
  - Verify: tests pass; LIMIT 100 present in query (grep assert)
  - Depends on: 4.4
  - Risk: Medium (state-store `since` parameter may need a tiny additive extension — if so, add without breaking existing callers)
- [ ] Step 4.6: Check #12 instinct-decay-candidates — RED
  - File: `tests/lib/medik-checks/instinct-decay-candidates.test.ts`
  - Fixtures: seed `instincts` with `confidence < 0.3 + last_observed_at > 30d` → NOTE with count; with `last_observed_at IS NULL` → also NOTE (treated as idle); empty → PASS
  - Verify: fails RED
  - Depends on: 4.1
  - Risk: Low
- [ ] Step 4.7: Check #12 instinct-decay-candidates — GREEN
  - File: `scripts/lib/medik-checks/instinct-decay-candidates.ts` (new)
  - SQL: `SELECT id, confidence, last_observed_at FROM instincts WHERE project_hash = ? AND status = 'active' AND confidence < 0.3 AND (last_observed_at IS NULL OR last_observed_at < datetime('now', '-30 days')) ORDER BY confidence ASC, last_observed_at ASC LIMIT 10`
  - Read-only (NOT reusing `decayInstincts` which mutates); message: `"N instincts candidates for archive. Run /forge to review."`
  - Category: `knowledge-hygiene`
  - Verify: tests pass; no writes to `instincts` table (assert row count stable across `runCheck`)
  - Depends on: 4.6
  - Risk: Low
- [ ] Step 4.8: Integrate #10-12 into `.claude/commands/medik.md`
  - File: `.claude/commands/medik.md`
  - Add rows #10, #11, #12 to Phase 1 table with language column = `both`
  - Regroup output narrative into 4 categories: **Core** (#1-3), **Runtime** (#4, 5, 9, 11), **Code hygiene** (#6, 7, 8), **Knowledge hygiene** (#10, 12)
  - Verify: grep for each check number confirms presence; manual review that category headers render
  - Depends on: 4.3, 4.5, 4.7
  - Risk: Low
- [ ] Commit: `feat(medik): add Checks #10-12 (stale-plans, hook-health-24h, instinct-decay)` — `Reviewed: full` (ts-reviewer + orakle + kody — orakle mandatory for new SQL)

### Phase 5: Item 6 — `/medik` Check #13 skill-creator probe (S, TDD required)
- [ ] Step 5.1: RED — tests for 3 candidate paths
  - File: `tests/lib/medik-checks/skill-creator-probe.test.ts`
  - Mock `fs.existsSync` per path; assert: any present → PASS; none present → WARN "skill-creator plugin missing…"
  - Verify: fails RED
  - Depends on: Phase 4 scaffolding (4.1)
  - Risk: Low
- [ ] Step 5.2: GREEN — implement probe
  - File: `scripts/lib/medik-checks/skill-creator-probe.ts` (new)
  - Candidates: `path.join(homedir, '.claude', 'plugins', 'cache', 'skill-creator', 'SKILL.md')`, `path.join(cwd, '.claude', 'skills', 'skill-creator', 'SKILL.md')`, `path.join(homedir, '.claude', 'skills', 'skill-creator', 'SKILL.md')`
  - Category: `runtime`
  - Verify: tests pass
  - Depends on: 5.1
  - Risk: Low
- [ ] Step 5.3: Integrate into `.claude/commands/medik.md`
  - File: `.claude/commands/medik.md`
  - Add Check #13 row (category `runtime`) + update category grouping narrative from Phase 4.8
  - Depends on: 5.2
  - Risk: Low
- [ ] Commit: `feat(medik): add Check #13 skill-creator plugin probe` — `Reviewed: lite (ts-reviewer)`

### Phase 6: Item 1 — `/medik --ALV` diagnostic export (L, TDD required, spektr mandatory)
- [ ] Step 6.1: RED — cross-platform redaction + output structure tests
  - File: `tests/lib/medik-alv.test.ts`
  - Test cases:
    - `redactSensitivePaths` replaces `C:\Users\kadmo\...` → `C:\Users\<user>\...` (Windows)
    - `...` replaces `/Users/kadmo/...` → `/Users/<user>/...` (macOS)
    - `...` replaces `/home/kadmo/...` → `/home/<user>/...` (Linux)
    - `homedir` replaced with `~` before generic prefix patterns
    - `process.cwd()` escaped via `escapeRegex`, replaced with `.`
    - Output NEVER contains `os.userInfo().username`
    - `generateAlvReport('/tmp')` produces parseable UTF-8 string with header + 4 sections
    - File written to `cwd` with mode `0o600` (assert via `fs.statSync(path).mode & 0o777`)
  - Verify: fails RED
  - Depends on: Phase 3 (typed reader) complete
  - Risk: Medium (cross-platform path fixtures)
- [ ] Step 6.2: GREEN — implement `generateAlvReport`
  - File: `scripts/lib/medik-alv.ts` (new)
  - Export `generateAlvReport(cwd: string): string` and `writeAlvReport(cwd: string): string` (returns file path)
  - Sections composed: (a) header (timestamp ISO, `process.platform`, `process.version`, `execSync('git log -1 --format="%H %s"')`, `execSync('git rev-parse --abbrev-ref HEAD')`), (b) last 10 install-diagnostic entries via `readTypedInstallDiagnostics`, (c) last 10 `hook-errors.log` entries via `readRotatingJsonlLog`, (d) fresh `checkInstallHealth(cwd)` output
  - `redactSensitivePaths(text, cwd, homedir)` with ordered replacements: `homedir` (escaped) → `~`, `/C:\\Users\\[^\\\/]+/g` → `C:\\Users\\<user>`, `/\/Users\/[^/]+/g` → `/Users/<user>`, `/\/home\/[^/]+/g` → `/home/<user>`, `cwd` (escaped) → `.`
  - Reuse `escapeRegex` from `scripts/lib/install-remediation.ts` — DO NOT recreate
  - `writeAlvReport`: resolve filename `diagnostic-YYYY-MM-DD-HHmm.txt` in `cwd`, write via `fs.writeFileSync(path, redacted, { mode: 0o600 })`
  - Verify: tests pass; `npx tsc --noEmit` green
  - Depends on: 6.1
  - Risk: High (ReDoS surface, redaction completeness, file mode enforcement on Windows)
- [ ] Step 6.3: Integrate `--ALV` Phase 0 into `/medik`
  - File: `.claude/commands/medik.md`
  - Add a new "Phase 0: Flag detection" before Phase 1: if `$ARGUMENTS` matches `--ALV`, invoke `npx tsx -e "import('./scripts/lib/medik-alv.js').then(m => console.log(m.writeAlvReport(process.cwd())))"` and exit (skip Phases 1-4)
  - Bump `description:` frontmatter from "8 health checks" → "13 health checks + deep agent analysis + repair"
  - Verify: manual smoke `/medik --ALV` writes `diagnostic-*.txt` to `cwd`, no real username leaks (grep for `os.userInfo().username`)
  - Depends on: 6.2
  - Risk: Medium
- [ ] Commit: `feat(medik): add --ALV diagnostic export with cross-platform redaction` — `Reviewed: full` (spektr MANDATORY for redaction + ReDoS audit, ts-reviewer, kody)

### Phase 7: Item 7 — Sprint E graphify measurement gate (M, no code, measurement-only)
- [ ] Step 7.1: Baseline estimation (pre-graphify) for 5 queries
  - Queries (from ADR-028 D5):
    1. "How does Forge Pipeline relate to Evolve Generate?"
    2. "What functions depend on `getDb()`?"
    3. "Where does Install Health Telemetry connect to Database Store?"
    4. "How does a session flow from session-start to SQLite persist?"
    5. "Which skills impact ADR-025?"
  - For each: identify minimum file set Claude would read without the graph (grep + Read), compute `wc -c` total, divide by 3.5 = estimated tokens
  - Record in a local scratchpad (not committed)
  - Depends on: none
  - Risk: Medium (accuracy ±30% per research-007; acceptable outside 2.5×–3.5× band)
- [ ] Step 7.2: Post-graphify estimation
  - For each query: `wc -c` on `graphify-out/GRAPH_REPORT.md` + 1-2 wiki community notes Claude would traverse, divide by 3.5
  - Record in same scratchpad
  - Depends on: 7.1
  - Risk: Low
- [ ] Step 7.3: Compute ratios and decide gate
  - Rule: avg ratio ≥ 3.0× → **PASS**; avg < 3.0× → **FAIL**; borderline 2.5–3.5× → run Opt B (API simulation) on 2 closest queries, re-evaluate
  - Verify: produces 5-row markdown table `| Query | pre_tokens | post_tokens | ratio |`
  - Depends on: 7.2
  - Risk: Medium (FAIL triggers revert path — see Rollback section)
- [ ] Step 7.4: Write results + update ADR-026 status
  - File: `docs/roadmap/v1.3-medik-expansion.md` (replace item 7 unchecked measurement-gate box with `[x]` + results table)
  - File: `docs/decisions/ADR-026-graphify-adoption.md` — if PASS: `status: accepted`; if FAIL: `status: rejected` + Supersedes note
  - Depends on: 7.3
  - Risk: Low
- [ ] Commit: `docs(v1.3): record Sprint E graphify benchmark result (PASS|FAIL + ratio)` — `Reviewed: skip (docs-only)`

### Phase 8: v1.3.0 Release (S, no TDD)
- [ ] Step 8.1: Version bump
  - Files: `package.json` (1.2.3 → 1.3.0), `.claude-plugin/plugin.json` (same)
  - Verify: `node -p "require('./package.json').version"` prints `1.3.0`; `node -p "require('./.claude-plugin/plugin.json').version"` prints `1.3.0`
  - Depends on: Phases 1-7 merged
  - Risk: Low
- [ ] Step 8.2: CHANGELOG
  - File: `CHANGELOG.md`
  - Move `[Unreleased]` → `[1.3.0] — 2026-04-24`
  - Sections: **Added**: `/medik` Checks #10-13, `/medik --ALV` export, `readTypedInstallDiagnostics()`, `_v: 1` schema; **Changed**: `/medik` frontmatter description 8 → 13 + category grouping; **Fixed**: Check #6 `.d.ts` docstring; **Notes**: Sprint E measurement gate result + ratio
  - Depends on: 8.1
  - Risk: Low
- [ ] Step 8.3: CLAUDE.md Status line + reference counts
  - File: `CLAUDE.md` (Status section): bump test count (~939 + ~50 new), check count 9→13
  - File: `docs/onboarding/reference_kadmon_harness.md`: update counts consistently
  - Verify: `grep -n "health checks" CLAUDE.md` shows "13"; counts match package.json version
  - Depends on: 8.2
  - Risk: Low
- [ ] Step 8.4: `/chekpoint` full tier
  - Reviewers: ts-reviewer + spektr + orakle + kody
  - Expect: 0 BLOCKs. Fix any WARN/NOTE that touches shipped surfaces.
  - Depends on: 8.3
  - Risk: Medium (spektr may raise late redaction concerns → must address before tag)
- [ ] Step 8.5: Tag + push
  - `git tag v1.3.0 && git push origin main --tags`
  - Verify: GitHub release draft visible via `gh release list`
  - Depends on: 8.4
  - Risk: Low
- [ ] Commit: `chore(release): v1.3.0` — `Reviewed: full`

### Testing Strategy
- **Unit**:
  - `tests/hooks/install-diagnostic.test.ts` (append `_v: 1` assertions)
  - `tests/lib/install-diagnostic-reader.test.ts` (new; valid/corrupt/legacy/mixed fixtures)
  - `tests/lib/medik-checks/stale-plans.test.ts` (new; filesystem + git fixtures)
  - `tests/lib/medik-checks/hook-health-24h.test.ts` (new; `:memory:` DB seed)
  - `tests/lib/medik-checks/instinct-decay-candidates.test.ts` (new; `:memory:` DB seed, read-only assert)
  - `tests/lib/medik-checks/skill-creator-probe.test.ts` (new; `fs.existsSync` mocks)
  - `tests/lib/medik-alv.test.ts` (new; cross-platform path fixtures + file-mode assert)
- **Integration**:
  - Full `/medik` invocation on harness repo produces 13 rows grouped into 4 categories, no unexpected FAIL
  - `/medik --ALV` writes `diagnostic-*.txt` to cwd, mode `0o600`, contains no real username
- **E2E**:
  - Windows Git Bash smoke of `/medik --ALV` (backslash path separators)
  - PowerShell smoke of `/medik --ALV` (PATH + mode enforcement on NTFS)

### Pre-Release Verification Gate
- [ ] `npm run build && npx vitest run` — all tests green (~989 after additions)
- [ ] `/medik` end-to-end: 13 checks execute, output grouped by category, exit code reflects worst status
- [ ] `/medik --ALV`: file created, grep confirms no `os.userInfo().username` present, `stat -c '%a' diagnostic-*.txt` → `600` on POSIX
- [ ] `/chekpoint` full tier: 0 BLOCKs across ts-reviewer, spektr, orakle, kody
- [ ] Version triple-check: `package.json`, `.claude-plugin/plugin.json`, `CLAUDE.md` Status line all say `1.3.0`

### Rollback
- **Phase 1 (docs fix)**: single-line revert via `git revert`.
- **Phase 2 (`_v: 1`)**: revert `install-diagnostic.js:57` spread. Legacy entries remain readable; typed reader's legacy-cast path remains valid.
- **Phase 3 (typed reader)**: delete `scripts/lib/install-diagnostic-reader.ts` + test. No other consumer yet migrated.
- **Phase 4 (Checks #10-12)**: delete `scripts/lib/medik-checks/{stale-plans,hook-health-24h,instinct-decay-candidates}.ts` + tests; revert medik.md table rows.
- **Phase 5 (Check #13)**: delete `scripts/lib/medik-checks/skill-creator-probe.ts` + test; revert medik.md row.
- **Phase 6 (`--ALV`)**: delete `scripts/lib/medik-alv.ts` + test; revert medik.md Phase 0 block + frontmatter description. No persistent state to clean (`diagnostic-*.txt` lives in user cwd).
- **Phase 7 (graphify FAIL path)**: run `git revert 1f5e8ab 60ab099 28b4bb5 b50f96f e75b050` (verified 2026-04-24 via `git log | grep graphify`); update ADR-026 `status: rejected`; adjust CHANGELOG note accordingly. Commands are pre-identified and single-commit reversible by design.
- **Phase 8 (release)**: `git tag -d v1.3.0 && git push origin :refs/tags/v1.3.0`; revert version-bump commit; re-run `/chekpoint`.

### Risks & Mitigations
- **ReDoS in `--ALV` redaction** → spektr review MANDATORY; literal prefixes only; `escapeRegex` on user-content; fixtures include worst-case adversarial paths.
- **ENOENT on plugin cache during Check #13** → probe 3 candidate paths; fallback WARN with install hint.
- **`hook_events` scan cost on long-lived DBs** → `LIMIT 100`; index `idx_hook_events_timestamp` already exists.
- **Cross-platform redaction completeness** → dedicated Windows/macOS/Linux fixtures; assert absence of `os.userInfo().username`.
- **Commit fatigue across 8 commits** → TDD per phase; each commit independently reviewable; release commit is pure version-bump + CHANGELOG.
- **Graphify FAIL triggers large revert** → revert SHAs pre-identified (`1f5e8ab`, `60ab099`, `28b4bb5`, `b50f96f`, `e75b050` — verified 2026-04-24); ADR-026 designed single-commit reversible.
- **`/medik --ALV` file mode on Windows NTFS** → `fs.writeFileSync(..., { mode: 0o600 })` + post-write `fs.chmodSync` fallback; document that NTFS ACLs may render mode advisory rather than enforcing.

### Out of Scope (enforced guardrails against scope creep)
- Migrating `/medik` Check #9 to `readTypedInstallDiagnostics` (reader exists; callers migrate gradually across future releases)
- Aggressive `--ALV` redaction (hostnames, MAC addresses, internal IPs)
- `--ALV` output compression (logs < 10 KB)
- `/medik report` + `gh gist create` integration
- Promoting graphify to `/medik` Check #14 in v1.3.0 (deferred to v1.3.1 or v1.4)
- Frontmatter-assertion check (runtime count vs docstring) — v1.4 hygiene backlog
- `hook-errors.log` automatic rotation (already delegated to `rotating-jsonl-log.ts`)
- `gray-matter` npm dependency (regex sufficient for plan frontmatter)

### Success Criteria
- [ ] `/medik` runs 13 checks grouped into Core / Runtime / Code hygiene / Knowledge hygiene
- [ ] `/medik --ALV` produces a redacted diagnostic file with mode `0o600` and zero real-username leakage
- [ ] `readTypedInstallDiagnostics()` returns `VersionedInstallReport[]` with `_v: 0` cast for legacy entries
- [ ] All new checks have passing unit tests under `tests/lib/medik-checks/`
- [ ] Sprint E graphify gate resolved (PASS → adoption stays; FAIL → reverts applied + ADR-026 rejected)
- [ ] `package.json` + `.claude-plugin/plugin.json` + CLAUDE.md Status all say `1.3.0`
- [ ] `npx vitest run` green; `npx tsc --noEmit` green; `/chekpoint` full tier reports 0 BLOCKs
- [ ] `v1.3.0` tag pushed to `origin/main`
