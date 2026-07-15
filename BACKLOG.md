# BACKLOG — Kadmon Harness

Operational work queue. One line per item, linked to detail. `docs/roadmap/` keeps the
release narrative; this file is what gets picked up next. On release, done items move to
CHANGELOG and are pruned here.

States: `[ ]` open · `[~]` in progress · `[x]` done · `[-]` dropped · `[d]` deferred.
`AUD-xx` items: detail in [docs/insights/2026-07-12-full-harness-audit.md](docs/insights/2026-07-12-full-harness-audit.md).
`R-xx` items: detail in [docs/roadmap/v1.3.1-performance-and-quality.md](docs/roadmap/v1.3.1-performance-and-quality.md) (item numbers preserved).

## P0 — broken now


## P1 — consistency / quality

- [ ] AUD-33 `config-protection.js` residual heuristic scope: `extractBraceBlockAt` is string-literal-aware (Wave 2) but is NOT a full JS/JSON parser — it does not skip JS comments (`/* } */`) or template literals when brace-counting. A disabled rule hidden behind a comment-embedded brace in an `eslint.config.js` could still slip past. Not realistic for the threat model (the "attacker" is the agent/user editing their own config, not a payload crafter; comments aren't valid in `.eslintrc.json`/`tsconfig.json`) — but if we want a true guarantee, replace the regex/scanner approach with `JSON.parse` + object-walk for the JSON configs and a real (lightweight) JS tokenizer for flat-config. Documented as heuristic in the code. Low priority.
- [ ] Silent-swallow stderr-logging pass across `scripts/lib/release/` git-catch sites (`tag.ts:28`, `orchestrate.ts:85`, `backlog-prune.ts:24`, `status-flips.ts:43`, `upgrade-advisory.ts` defaultRunDiff): all `catch { return ... }` with zero stderr log (violates `common/patterns.md` "never swallow silently — always log"). Add a uniform stderr JSON diagnostic to all 5 in one pass. Surfaced by ts-reviewer + kody on the upgrade-advisory review 2026-07-15 (FOLLOW-UP, not per-file, to avoid a 1-vs-4 inconsistency). Low priority — read-only best-effort paths, none are security controls.

## P2 — features / trims

- [ ] AUD-40 /release cross-process committed-but-untagged recovery: `planRelease` auto-recovery (waive EMPTY_UNRELEASED, tag-only) fires only for a SAME-SESSION retry (ctx.currentVersion still pre-bump). A fresh `/release` after a real crash reads the already-bumped plugin.json → recomputes a higher nextVersion → won't auto-recover the missing tag (needs manual `git tag` or original-version context). Full detection (scan CHANGELOG last-dated-heading vs last tag) is the follow-up. Surfaced by ts-reviewer Wave-3 directed check #1(b). Low priority — human-invoked + narrated + no auto-push, so a missed tag is visible before publish.
- [ ] AUD-41 Per-fork upgrade runbook (Sentinel-harness + Kadmon7Cowork-Harness): both DIVERGED forks (own remotes, full source tree), both v1.3.0 + PRE-`tool_use_id`-migration. `git merge upstream/main` won't apply (unrelated histories, bootstrapped fresh) -> selective cherry-pick per fork. SHARED-DB gotcha: migration changed machine-global `~/.kadmon/kadmon.db` schema (3->4 col index); forks on old code hit `ON CONFLICT` mismatch -> their state-store goes dark. Sentinel = 11 commits (ADR-036 specialized, may not want everything); KadmonCowork = 58 commits (+2 agents, heavily diverged). Author the per-fork port plan when v1.4.0 is cut. Was WORK.md prose only until 2026-07-13.
- [ ] AUD-42 `~/.claude/CLAUDE.md` stale note: "ToratNetz — repo not created yet" is wrong — repo EXISTS (pushed 2026-07-10, confirmed via `gh repo list`). Correct the "Active Projects" line. Cross-project, small.

## v1.3.1 roadmap items (open, priority order per roadmap file)

- [ ] R-15 `"utf-8"` -> `"utf8"` stale-plans.ts (5min) · R-03 ABS_PATH_RE cosmetic (15min)
- [ ] R-09 shared DB-error fallback helper · R-06 param shadow capability-alignment · R-08 double-cast install-diagnostic-reader · R-07 export parseCommandFrontmatter + tests
- [ ] R-01 quadratic backtrack capability-matrix.ts:172 · R-02 batch per-file git log stale-plans.ts
- [ ] R-10 + R-32 backup-rotate EBUSY pair · R-33 git-push-reminder latency outlier (profile first)
- [ ] R-16 pyproject uncapped read · R-17 doks traversal guard prose-only
- [ ] R-21 detectMedikProfile silent fallthrough · R-22 $ARGUMENTS shell-quoting medik.md
- [ ] R-04 bandit probe cache · R-12 plugin-mode path JSDoc · R-31 post-compact auto-reload · R-14 nexus graph-freshness badge · R-20 doks consumer-.claude guard
- [ ] R-18, R-19, R-23..R-30 NOTE-tier batch (stale agent docs, env telemetry, Check #8 guard, test refactor, SQL regex, path.resolve, JSDoc, chekpoint helper, spawn keywords, size cap)

## v1.3.2 + epics

- [ ] v1.3.2 graphify optimizations (3 items — see docs/roadmap/v1.3.2-graphify-optimizations.md)
- [ ] plan-036 Sentinel-harness remaining phases (tracked in WORK.md)
- [ ] Session-start banner silent (Bug 3, plan-010 dogfood — promoted from private memory)
- [ ] Orphan-recovery trigger fails ~20% of sessions (ADR-022 internals OK — promoted from private memory)
- [d] Cost-tracker per-subagent attribution (needs arkitect ADR — v1.4 candidate)
- [ ] v2.0 epics: multi-project, Supabase sync, Skill Tier B-C (see docs/roadmap/v2.0-multi-project.md)
