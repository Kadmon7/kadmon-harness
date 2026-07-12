# BACKLOG — Kadmon Harness

Operational work queue. One line per item, linked to detail. `docs/roadmap/` keeps the
release narrative; this file is what gets picked up next. On release, done items move to
CHANGELOG and are pruned here.

States: `[ ]` open · `[~]` in progress · `[x]` done · `[-]` dropped · `[d]` deferred.
`AUD-xx` items: detail in [docs/insights/2026-07-12-full-harness-audit.md](docs/insights/2026-07-12-full-harness-audit.md).
`R-xx` items: detail in [docs/roadmap/v1.3.1-performance-and-quality.md](docs/roadmap/v1.3.1-performance-and-quality.md) (item numbers preserved).

## P0 — broken now

- [x] AUD-01 Red test on main: skill count 48 -> 49 in `tests/plugin/manifest-schema.test.ts:341` + CLAUDE.md + README (4 spots) + `docs/onboarding/reference_kadmon_harness.md` (frontmatter + heading)
- [x] AUD-02 `observe-pre.js` logs Bash commands without `scrubSecrets()` — secrets land in plaintext in observations.jsonl (security MEDIUM; observe-post already scrubs)
- [x] AUD-03 `kartograf.md:3` unquoted description with embedded colon — strict YAML parse fails
- [x] AUD-04 /medik consumer reachability: RUNTIME_ROOT resolution in medik.md + single compiled medik-checks CLI (`--cwd`, computes projectHash) — 9/14 checks currently ERR_MODULE_NOT_FOUND outside the harness repo
- [x] AUD-05 `lint-agent-frontmatter.ts` CLI: add `--agents-dir`/`--skills-dir` flags (Check #8 false FAIL in consumers with local `.claude/agents/`)
- [x] AUD-06 `session-end-all.js:104` LIFO agent pairing misattributes parallel agent invocations in agent_invocations table
- [x] AUD-07 `evaluate-patterns-shared.js:106` wrap instinct writes in `db.transaction()` — N instincts = N full sql.js DB file rewrites
- [x] AUD-08 Status flips: plan-036 `pending` -> `in-progress` (Sentinel repo has 11 commits), ADR-036 `proposed` -> `accepted`

## P1 — consistency / quality

- [ ] AUD-09 /medik false-FAIL kills: Check #9 -> harness install root (not consumer cwd); Check #6 layout guard; `unknown` language -> skip-with-NOTE (not TS fallback); TS test-runner detection (Jest vs Vitest); `medik.md:129` -> `toolchain.test`
- [ ] AUD-10 `git-push-reminder.js` adopt `getDiffScope()` (currently zero consumers of the "runtime authority") + add python-reviewer to allowlist
- [ ] AUD-11 `no-context-guard.js:10` Python exemptions (`test_*.py`, `pyproject.toml`) — plan-020 Phase B parity gap
- [ ] AUD-12 Blocking hooks fail-closed: config-protection / no-context-guard / block-no-verify / commit-quality exit 2 (not 0) on parseStdin throw
- [ ] AUD-13 Latency budget: post-edit-typecheck (15s tsc) + quality-gate (10s eslint) + post-edit-format (prettier) vs documented <500ms — optimize (direct .bin, incremental) or document exception in hooks.md; consider consolidating the 3 spawns
- [ ] AUD-14 `mcp-health-failure.js` race: JSON read-modify-write -> append-only JSONL
- [ ] AUD-15 Centralize `session_id` regex validation (7 hooks unvalidated, 3 validated) + `__proto__` filter in parse-stdin.js (defense-in-depth)
- [ ] AUD-16 /kompact skill drift: 3 files disagree (rules + agent-authoring say `strategic-compact`, frontmatter loads `context-budget`, nothing loads strategic-compact) — pick one, fix the other two
- [ ] AUD-17 Doc drift batch: ghost ADR-022 (stub or annotate), docs/README.md counts, CHANGELOG [Unreleased] 3 entries + broken 029 links, hooks CATALOG + count for UserPromptSubmit graphify hook, v1.3/v1.1 roadmap checkbox closes, research-005 dedupe, hooks.md logHookEvent count 9 -> 11
- [ ] AUD-18 `mekanik.md:51-65` delete stale "8 checks" section (14 now; violates no-artifacts contract); `kurator.md` add Python branch (ruff/vulture) + gate knip/ts-prune on package.json + fix "/medik clean" description
- [ ] AUD-19 `config-protection.js:19` narrow DANGEROUS regex (false-positive on any `key: 0`)
- [ ] AUD-20 CATALOG.md /medik row: "8 health checks" -> 14, remove advertised subcommands; evolve.md declare skill-creator plugin dependency; document `fable-prompt` in command-level skills rationale table
- [ ] AUD-21 Triage 4 flaky hook tests (pre-compact-save x2, session-end-all x2 — intermittent across runs)
- [ ] AUD-22 requires_tools WARNs: skill-stocktake (WebSearch vs alchemik/doks grants), rules-distill (Task vs doks grant)
- [ ] AUD-23 `npm audit --audit-level=high` routine pass (not run during audit)
- [ ] AUD-29 orakle Wave-1 NOTEs: session-end-all Phase 1c lacks empty-commit guard (unconditional disk write every session end); `agent_invocations` natural key lacks `tool_use_id` (parallel same-type same-ms row silently dropped by ON CONFLICT DO NOTHING); `KADMON_TEST_DB || undefined` consistency nit
- [ ] AUD-30 ts-reviewer Wave-1 NOTEs: scrubSecrets runs over full untruncated string (latency vs <50ms budget on pathological commands); smoke-test harness for medik.md embedded snippets; friendly NaN message on `--checks`; test for anomalous-pairing logHookError branch

## P2 — features / trims

- [ ] AUD-24 /release command: bump + CHANGELOG consolidation + status flips + CLAUDE.md refresh + tag + /doks (evidence: 6+ manual hygiene commits after v1.3.0 alone; needs short plan)
- [ ] AUD-25 /medik graphify integration (roadmap R-13 — measurement gate PASSED, deferral condition satisfied)
- [ ] AUD-26 /evolve cadence nudge: /nexus badge or session-end note "N unconsumed ClusterReports" (2-3 invocations ever; reports expire unused)
- [ ] AUD-27 /skavenger trim 371 -> ~200 lines; /skanner cut Phase 2 agent-eval to /evolve pointer; move kompact.md Bug-3 postmortem to memory
- [ ] AUD-28 Working-docs standard follow-ups: unify status enum (plans/ADRs/roadmap), document ADR/plan numbering gaps in docs/README.md, wire BACKLOG/WORK upkeep into /chekpoint + /medik Check #10

## v1.3.1 roadmap items (open, priority order per roadmap file)

- [ ] R-15 `"utf-8"` -> `"utf8"` stale-plans.ts (5min) · R-03 ABS_PATH_RE cosmetic (15min)
- [ ] R-09 shared DB-error fallback helper · R-05 noisy console.error post-edit-security · R-06 param shadow capability-alignment · R-08 double-cast install-diagnostic-reader · R-07 export parseCommandFrontmatter + tests
- [ ] R-01 quadratic backtrack capability-matrix.ts:172 · R-02 batch per-file git log stale-plans.ts
- [ ] R-10 + R-32 backup-rotate EBUSY pair · R-33 git-push-reminder latency outlier (profile first)
- [ ] R-16 pyproject uncapped read · R-17 doks traversal guard prose-only
- [ ] R-21 detectMedikProfile silent fallthrough · R-22 $ARGUMENTS shell-quoting medik.md
- [ ] R-04 bandit probe cache · R-12 plugin-mode path JSDoc · R-31 post-compact auto-reload · R-14 nexus graph-freshness badge · R-20 doks consumer-.claude guard
- [ ] R-18, R-19, R-23..R-30 NOTE-tier batch (stale agent docs, env telemetry, Check #8 guard, test refactor, SQL regex, path.resolve, JSDoc, chekpoint helper, spawn keywords, size cap)
- [x] R-11 skill-creator probe heuristic — fixed `29d24f3` 2026-04-27 (registry mechanism)

## v1.3.2 + epics

- [ ] v1.3.2 graphify optimizations (3 items — see docs/roadmap/v1.3.2-graphify-optimizations.md)
- [ ] plan-036 Sentinel-harness remaining phases (tracked in WORK.md)
- [ ] Session-start banner silent (Bug 3, plan-010 dogfood — promoted from private memory)
- [ ] Orphan-recovery trigger fails ~20% of sessions (ADR-022 internals OK — promoted from private memory)
- [d] Cost-tracker per-subagent attribution (needs arkitect ADR — v1.4 candidate)
- [ ] v2.0 epics: multi-project, Supabase sync, Skill Tier B-C (see docs/roadmap/v2.0-multi-project.md)
