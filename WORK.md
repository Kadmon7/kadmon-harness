# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

> **2026-07-13 post-compact reset.** All SHIPPED items pruned to git log / CHANGELOG.
> Only OPEN work below. Full shipped history: `git log` + `docs/decisions/` + `docs/plans/`.

## Task list (open)

### Shipped recently (2026-07-14 → 07-16, on main)
- **Silent-swallow stderr pass** (2026-07-16) — the 5 bare `catch { return ... }` sites in
  `scripts/lib/release/` (`tag.ts` tagExists, `orchestrate.ts` isVersionAlreadyBumped,
  `backlog-prune.ts` readChangelogText, `status-flips.ts` readFileSafe, `upgrade-advisory.ts`
  defaultRunDiff) now emit a uniform stderr JSON warn via the existing `log()` (`scripts/lib/utils.ts`).
  Behavior byte-identical — the swallow is deliberate design at each site; silence was the only
  defect. TDD feniks. Full-tier /chekpoint 0 BLOCK: ts-reviewer 3 WARN (all closed in an
  amendment round — status-flips message lacked `filePath` + consequence phrase; test (f) hardcoded
  the live repo path; the retrofit made 2 pre-existing tests leak stderr) + spektr FORCE-INVOKED
  (DiffScope said skip — correct mechanically, but the change opens a new output channel for
  previously-discarded error content, which keyword gating cannot see) returning LOW / 0C-0H-0M.
  Suite 1452 -> 1457.
  - **spektr falsified the credential-leak hypothesis by experiment**: `execFileSync` DOES concat
    child stderr into `e.message` (Node v24, verified), but `git tag -l` / `git diff --name-only`
    are local-only AND git anonymizes userinfo out of transport errors (tested with a fake token).
    The diff logs `e.message`, NOT `e.stdout` — which for `git tag -l` holds the tag list. Do not
    "improve" this to log the whole error object. One real exception: `orchestrate.ts` wraps
    `JSON.parse`, and V8 echoes ~14 chars of input into the SyntaxError — harmless only because
    `plugin.json` is a public committed manifest.
  - **`log()` had ZERO callers repo-wide before this pass** — these 5 are the first, and unlike
    `observe-*` it has no `scrubSecrets()` layer. This pass ESTABLISHES the convention rather than
    following one. The durable risk is the sixth caller: gate future `log()` callers on whether the
    payload can carry credentials or file content. (GRAPH_REPORT calls `log` a god node — that graph
    is 2.5 months stale and was wrong; see BACKLOG graphify-rebuild.)
- **AUD-42** (`0099483`) — global CLAUDE.md ToratNetz note; see the cross-project section below.
- **3 orphan pendientes closed** (`67f0c9c`) — ADR-026 amendment (both v1.4 deferrals resolved),
  /medik Check #10 dropped as confirmed-intentional (v1.3 roadmap now at 0 open boxes), ECC
  validation experiment added to BACKLOG. Found by a sweep of docs/roadmap + docs/plans +
  docs/insights + CORRECTIONS + the private memory index; those 3 were the only items BACKLOG
  did not index.
- **Contract test RED on main, fixed** (`04ff1df`) — `4dae117` (hebrew-native-copy, skills 52->53)
  synced CLAUDE.md + README but missed `expectedCounts` in `tests/plugin/manifest-schema.test.ts`.
  main was red from 2026-07-15 until 2026-07-16 and WORK.md's own "suite green 1452 (1451 passed)"
  claim below was FALSE (real: 1450 passed / 1 failed / 1 skipped). Straight C-001 recurrence — the
  rule names that exact file as the third grep target. Caught by /doks, not by anyone re-running the
  suite. typescript-reviewer argued the hardcoded literal must STAY (deriving it from the same
  filesystem the test reads makes the assertion tautological and destroys the only thing that forces
  a human to notice a component changed); the RED was correct behavior, not a false positive.

### Shipped earlier (2026-07-14 → 07-15, on main)
- **/release upgrade-advisory phase** (`3123ec5`, ADR-037 D7) — /release now auto-emits the consumer upgrade path (plugin update / install re-run / re-drop catalog) by classifying `git diff v<prev>..HEAD` into ADR-010 territories. New module `upgrade-advisory.ts` (subsystem 7→8), 39 tests, TDD feniks. Full-tier /chekpoint 0 BLOCK (spektr GO + ts-reviewer 2 WARN + kody GO); 3 FIX-NOW applied, 2 deferred to BACKLOG (5-file silent-swallow pass + CLAUDE.md count refresh). Closes the README "update the plugin" gap. Suite 1452.
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
- **AUD-42 — ToratNetz CLAUDE.md stale — SHIPPED 2026-07-16.** `~/.claude/CLAUDE.md` said "repo not
  created yet"; the repo has been live since 2025-12-11 (~7 months, daily commits). Fix surfaced a
  second, unlogged error in the same line: it named Supabase as the persistence layer, but ToratNetz
  runs self-hosted PostgreSQL + pgvector HNSW via docker compose — Supabase is only an MCP there.
  Line rewritten with the verified stack. Fix lands outside this repo (user-global config) → no
  CHANGELOG entry. (BACKLOG AUD-42 flipped `[x]`.)
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
  sql.js/execFileSync tests). Suite green 1452 (1451 passed / 1 skipped).
- Release-subsystem live-repo coupling (manifest Test 2b + orchestrate.e2e pinned to
  version/date) decoupled to structural invariants during the v1.4.0 cut (`b3650db`). 3rd
  occurrence of the live-repo assertion-fragility class — memory `project_release_e2e_live_state_gotcha`.

Last updated: 2026-07-15
