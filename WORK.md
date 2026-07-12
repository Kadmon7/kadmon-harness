# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

## Active

- **2026-07-13 — Wave 2 (P1, AUD-09..23) LANDED + hardened.** 5 parallel file-disjoint clusters + 1 sequential (session_id centralization) + wrap-up (npm audit → 0 vulns). Full /chekpoint tier: typescript-reviewer (0 BLOCK/4 WARN/5 NOTE) + spektr (1 HIGH/2 MED/4 LOW) + kody gate. ALL reviewer findings fixed via feniks TDD: config-protection.js went through 3 rounds (brace-balanced scan → multi-block matchAll → string-literal awareness) after kody caught two successive structural-scan bypasses; no-context-guard Windows-path normalize; parse-stdin null-guard + proto filter; session-start orphan.id safeSessionDir. config-protection residual scope (comments/template-literals) documented + deferred as AUD-33 (heuristic guard, not adversarial threat model). Suite 1226 tests / 92 files (1 known AUD-21/34 flake, passes isolated). Committed + pushed. Next: Wave 3 (AUD-24..34) pending user go.

- **2026-07-12 — Full harness audit (6 parallel agents) + Wave 1 (P0) LANDED.** Report: `docs/insights/2026-07-12-full-harness-audit.md` (local-only, docs/insights/ is gitignored). Findings in `BACKLOG.md` (AUD-01..AUD-30). Wave 1 shipped AUD-01..08 through the full /chekpoint tier: 3 Phase 2a reviewers (spektr APPROVE — original MEDIUM closed; typescript-reviewer APPROVE-with-notes; orakle APPROVE) + all reviewer WARNs applied (dirty-flag disk writes, anomalous-pairing logging, scrub-order + free-text scrub) + kody GO. Suite 1158 tests / 90 files green.
- **2026-07-12 — Wave 2 (P1) IN PROGRESS.** 5 parallel agents, file-disjoint clusters (no shared-file collisions):
  - Cluster 1 (code, full-tier): `config-protection.js`, `no-context-guard.js`, `block-no-verify.js`, `commit-quality.js` — AUD-11 (Python exemptions) + AUD-12 (fail-closed) + AUD-19 (regex narrowing)
  - Cluster 2 (code, full-tier): `git-push-reminder.js` — AUD-10 (getDiffScope adoption + python-reviewer allowlist)
  - Cluster 3 (code, full-tier): `mcp-health-failure.js` — AUD-14 (JSONL append-only race fix)
  - Cluster 4 (code+docs): `medik.md`, `scripts/lib/medik-checks/*.ts`, `medik-checks-cli.ts`, `mekanik.md`, `kurator.md` — AUD-09 (/medik false-FAIL kills) + AUD-18 (agent hygiene)
  - Cluster 5 (docs, skip-tier): `kompact.md` frontmatter, `agents.md`/`agent-authoring` skill, CLAUDE.md/README/docs/README.md/CHANGELOG doc-drift D7-D14, `CATALOG.md` /medik row, `evolve.md`, `fable-prompt` rationale table, requires_tools frontmatter (skill-stocktake, rules-distill), `hooks.md` latency exception paragraph — AUD-16, AUD-17, AUD-20, AUD-22, AUD-13(doc part)
  - **Sequential AFTER parallel merge** (single writer, touches files across all clusters): AUD-15 session_id centralization (`safeSessionDir()` helper) + parse-stdin `__proto__` filter
  - **After tree is quiet**: AUD-21 flaky test triage (concurrency during parallel work would muddy the signal), AUD-23 npm audit
  - AUD-13 real optimization (direct `.bin`, incremental tsc, consolidate 3 spawns) logged as new backlog item, not silently dropped — doc carve-out ships now, perf rewrite deferred
  - Agents implement + test only. Main session verifies each diff and commits (Wave 1 lesson: agent final-message summaries lose detail; sub-agents must never commit — pre-commit hook rebuild risk).

## In flight elsewhere

- **plan-036 Sentinel-harness fork** — executing in sibling repo `C:\Command-Center\Sentinel-harness` (11 commits, 2026-06-24 through 2026-07-03; Phases 0-1+ done). Kadmon-side status flip pending (BACKLOG AUD-08). Sentinel keeps its own decisions dir per ADR-036 §5.

## Landed but unreleased (CHANGELOG [Unreleased] pending — AUD-17)

- `f912181` feat(skills): fable-prompt (also broke the skill-count contract test — AUD-01)
- `29d24f3` fix(medik): skill-creator probe via installed_plugins.json (closes roadmap R-11)
- `4415674` graphify UserPromptSubmit reminder hook in `.claude/settings.json` (uncataloged — AUD-17)

## Known-red state on main

- Deterministic failure (`manifest-schema.test.ts:341`) FIXED in Wave 1 (AUD-01). Remaining: 4 flaky hook tests (AUD-21 — pre-compact-save x2, session-end-all x2), pass in isolation.

Last updated: 2026-07-12
