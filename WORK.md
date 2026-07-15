# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

> **2026-07-13 post-compact reset.** All SHIPPED items pruned to git log / CHANGELOG.
> Only OPEN work below. Full shipped history: `git log` + `docs/decisions/` + `docs/plans/`.

## Task list (open)

### Shipped recently (2026-07-14 → 07-15, on main)
- **v1.4.0 CUT** (`aa03c7a` + tag `v1.4.0`, 2026-07-15) — `/release minor` dogfood end-to-end: bump 1.3.0→1.4.0, CHANGELOG `[Unreleased]`→`[1.4.0]` (51 lines), BACKLOG prune 40 items, `/doks` Layer-1 sync (5 count/version fixes) + `Commands 11→12` (+/release row in CLAUDE.md + README), pushed with `--follow-tags`. Phase-7 re-verify caught 2 live-repo-coupled tests (manifest + orchestrate.e2e pinned to version/date) → decoupled to structural invariants (`b3650db`, ts-reviewer APPROVE 0 BLOCK). Suite 1413 green.
- **AUD-37** (`3e3ec3b`) — split `state-store.ts` (1201 lines) → 21-line barrel facade + 8 modules
  under `scripts/lib/state-store/` (max 286 lines). Byte-for-byte move + 1 edit (schema.sql `../`).
  Full-tier /chekpoint 4/4 GO (spektr + orakle + ts-reviewer + kody, 0 BLOCK); suite 1385/1385.
- e2e hardening (`55c7b6d`) — `orchestrate.e2e.test.ts` now asserts a structural invariant, not
  live tree state (2nd occurrence of the live-repo coupling class; 1st was `8fcd129`).
- **AUD-25** (`0adb544`) — /medik Check #16 graphify-health: graphify-out/ presence + freshness vs
  HEAD (missing→NOTE, no-json→WARN, stale→advisory NOTE, fresh→PASS), discriminated-union input so
  the false-"fresh" state is unrepresentable, git spawned only when graph.json exists. Full-tier
  /chekpoint (ts-reviewer + spektr --force + kody, 0 BLOCK; 2 WARN closed via union refactor); suite 1385 → 1398.
- **AUD-26** — /evolve cadence nudge: `summarizePendingClusterReports` helper (fresh-in-window count) on
  TWO surfaces — `/nexus` dashboard badge + `session-end-all` Phase 6 note — sharing a new
  `KADMON_FORGE_REPORTS_DIR` env seam (single choke point `forgeReportsBaseDir` w/ `assertSafeBaseDir`).
  Full-tier /chekpoint: ts-reviewer 0 BLOCK/5 NOTE + spektr 0C/0H/1M/3L + kody 0 BLOCK/1 WARN → WARN
  (read/write validation asymmetry) fixed via choke point, NOTE5 pluralization unified, both TDD via feniks.
  Suite 1411 passed (lone `orchestrate.e2e` flaky under parallel load, passes isolated). CLAUDE.md env-var
  + skill count 50→52 drift → following /doks. Also `cf9a13c` reconciled manifest skill count 49→52.

### Next up
- **Follow-up full `/doks` pass** — close the 2 README gaps doks flagged out of Phase-6 count-sync scope during the cut: `<summary>48 Skills</summary>` enumerates only ~32 of 52 (~20 rows missing); `latest:` narrative (README L651) still describes v1.3.0 ADRs 031-035, not the v1.4.0 headline (/release + /medik consumer-safety + audit Wave 2/3).
- **Deep research Check Point** via `/skavenger` (pitch the cowork feature, with Eden) — business-sensitive, keep findings private. See memory `project_harness_repos_map`.

### Open AUD (post-AUD-26 cleanup)
- **AUD-40** — /release cross-process committed-but-untagged recovery (LOW; human-invoked + narrated, missed tag visible pre-publish).
- **AUD-33** — config-protection heuristic → real JS tokenizer / JSON.parse walk (LOW; near won't-fix per threat model).

### Release milestone
- **Cut v1.4.0** via `/release minor` (dogfood the new command) once AUD-26 lands (AUD-37 + AUD-25 shipped).
  Prunes done AUD-xx from BACKLOG → CHANGELOG.

### Cross-project / forks (captured 2026-07-13 — were chat/prose only)
- **AUD-41 — per-fork upgrade runbook** (Sentinel-harness + Kadmon7Cowork-Harness). Both DIVERGED
  forks (own remotes, full source), both v1.3.0 + PRE-`tool_use_id`-migration. `git merge upstream/main`
  won't apply (unrelated histories) → selective cherry-pick per fork. SHARED-DB gotcha: migration
  changed machine-global `~/.kadmon/kadmon.db` schema (3→4 col index); forks on old code hit
  `ON CONFLICT` mismatch → state-store goes dark. Sentinel = 11 commits (ADR-036 specialized);
  KadmonCowork = 58 commits (+2 agents). Author when v1.4.0 is cut. (BACKLOG AUD-41.)
- **AUD-42 — ToratNetz CLAUDE.md stale.** `~/.claude/CLAUDE.md` says "repo not created yet"; the repo
  EXISTS (pushed 2026-07-10, confirmed via `gh repo list`). Correct the note. (BACKLOG AUD-42.)
- **Watch 7am cloud routine PR** — `trig_01SDuKbeBpB5JuGmm2bE3KaE` (opus) fires 7am Jerusalem →
  opens PR for R-05/R-08 on harness, scoped AWAY from plan-038 files. Review + merge in the morning.

### Roadmap batch (v1.3.1+, lower priority — all in BACKLOG)
- R-15..R-33 NOTE/perf batch · v1.3.2 graphify optimizations · v2.0 epics.
- Promoted-from-memory: session-start banner silent (Bug 3) · orphan-recovery trigger fails ~20%.

## In flight elsewhere
- **plan-036 Sentinel-harness fork** — sibling repo `C:\Command-Center\Sentinel-harness` (11 commits,
  Phases 0-1+ done). Kadmon-side status flip DONE (ADR-036 `accepted` / plan-036 `in_progress`, fixed
  in AUD-08 + AUD-28). Sentinel keeps its own decisions dir per ADR-036 §5. Remaining phases pending.

## Landed but unreleased
- (empty — v1.4.0 cut 2026-07-15 consolidated CHANGELOG `[Unreleased]` into `[1.4.0]` and tagged `v1.4.0`. The next `[Unreleased]` accrues from here.)

## Test state on main
- Flaky hook tests (AUD-21) root-caused + FIXED via AUD-34 (vitest serialization of heavy
  sql.js/execFileSync tests). Suite green 1413 (1412 passed / 1 skipped).
- Release-subsystem live-repo coupling (manifest Test 2b + orchestrate.e2e pinned to
  version/date) decoupled to structural invariants during the v1.4.0 cut (`b3650db`). 3rd
  occurrence of the live-repo assertion-fragility class — memory `project_release_e2e_live_state_gotcha`.

Last updated: 2026-07-15
