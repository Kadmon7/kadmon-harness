# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

> **2026-07-13 post-compact reset.** All SHIPPED items pruned to git log / CHANGELOG.
> Only OPEN work below. Full shipped history: `git log` + `docs/decisions/` + `docs/plans/`.

## Task list (open)

### Shipped 2026-07-17 (on main, pushed)
- **Kadmon OS web dashboard** (`300d0c4` feat + `df32771` Brand v0.2 + `d395936` review fixes) —
  plan-039 built by feniks (Sonnet) in an isolated worktree, Fable polish pass, full-tier
  `/chekpoint` at merge (ts-reviewer 3 WARN + spektr 1 MEDIUM all closed in the amendment;
  kody 0 BLOCK). `npm run dashboard:web` → http://127.0.0.1:4321.
  - **The server is a foreground local process — it does NOT survive a reboot.** A "run as
    service" registration was offered and deliberately not taken; if it ever is, that is a new task.
  - Review follow-ups already in BACKLOG: v2 hardening NOTEs (Host allowlist, rate limit,
    `index.html` split) + the pre-commit dist-restage filter gap on top-level `scripts/*.ts`.
- **`/forge` + `/kompact` blind fix** (`09ea842`) — the P1 registered the day before. Phase 5 wiped
  `observations.jsonl` on every Stop past message 20; now archives to `observations.archive.jsonl`
  with retain-on-failure, and every reader sees archive+live. ECC `f720885c` pattern = Wave 0 of the
  v2.0 roadmap, so the roadmap now has one shipped wave as ratification evidence. Suite 1457 → 1462.
- **Vitest worktree exclude** (`59bdf9a`) — an active agent worktree triplicated the suite
  (331 files / 79 phantom fails). `.claude/worktrees/**` excluded + gitignored.
- **FUSE semaphore + claim conventions** (`d4ae94a`) — ported into the `/sprint`
  `WORK_COORDINATION.template.md`; also landed in Sentinel-harness as `5760de0`.
- **Docs sync post-merge** (`fdb2dc4` plan approved → `4da37a2` plan-039 flipped completed) —
  CLAUDE.md Status now 111 files + the dashboard line (its test count said 1490; the real
  collected total is 1493 — corrected 2026-07-19, see Test state below).

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
- **Cut v1.5.0** — see the Release milestone section below. IN FLIGHT as of 2026-07-19.
- **Ratify the v2.0 ECC-delta roadmap** via arkitect — reviews `docs/roadmap/v2.0-ecc-delta-ports.md`
  Waves 1-4, with Wave 0 (`09ea842`) already shipped as evidence. Unblocks the whole v2.0 track.
- **Rebuild the graphify graph** — ~2.5 months stale AND missing every 07-17 shipment, so it returns
  wrong answers (it called `log()` a god node when the function had zero callers). Pre-read the
  memories `reference_graphify_update_gotcha` (the update CLI stomps reports) and
  `reference_graphify_scope_limit` (code only, no markdown) before running it.
- **Deep research Check Point** via `/skavenger` (pitch the cowork feature, with Eden) — business-sensitive, keep findings private. Output goes to Sentinel/private, NEVER to this repo's public `docs/research/`. See memory `project_harness_repos_map`.
- **Evaluate the ECC validation experiment** (OVERDUE, lives in Kadmon-Sports) — 8 YAML seed instincts
  gate the `/instinct-import` port decision; the observation window closed ~2026-05-15.

> Closed from this section: the follow-up full `/doks` pass shipped as `816d0b1` (README skills
> collapsible 48→53 with set-equality verification, `latest:` narrative moved to v1.4.0, plus five
> untracked drifts).

### Open AUD (post-AUD-26 cleanup)
- **AUD-40** — /release cross-process committed-but-untagged recovery (LOW; human-invoked + narrated, missed tag visible pre-publish).
- **AUD-33** — config-protection heuristic → real JS tokenizer / JSON.parse walk (LOW; near won't-fix per threat model).

### Release milestone
- **v1.5.0 SHIPPED + PUSHED 2026-07-19** — `ce4628d` (release commit) + annotated tag `v1.5.0`,
  pushed with `--follow-tags`. Sequence ran: docs prep `b16e2e6` → `/release minor` writes
  (bump + CHANGELOG consolidation + BACKLOG prune ×4) → doks Layer-1 sync (found README
  `+17 indexes` stale, real 19; onboarding catalog 2 versions behind → own commit `05cb075`
  inside the tag) → re-verify (one flaky RED at 12:50, 2 consecutive greens after; authoritative
  `VITEST_EXIT:0`, 1492 passed / 1 skipped) → commit + tag → push (no ask, per the 2026-07-16
  gate-placement rule, clarified same day to cover release pushes).
  - **MINOR, not PATCH**: three narrative features (ADR-025). **MINOR, not MAJOR, despite the
    breaking `kryo` → `kontinuum` rename**: v2.0.0 stays reserved for the ECC-delta roadmap;
    the break ships as an explicit `### Breaking` CHANGELOG section + upgrade advisory.
  - **Parallel-session commit inside the tag**: `a38671c` (kontinuum sha-anchor + thaw re-sync)
    landed at 12:42 between this session's commits, pushed first. Narrated into `[1.5.0]`
    post-tag — the CHANGELOG must describe what the tag actually contains.
  - **AUD-40 hit live TWICE during this cut** (see BACKLOG entry for details).

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
22 commits since the `v1.4.0` tag, all on main and pushed, all written into CHANGELOG
`[Unreleased]` on 2026-07-19. Consolidates into `[1.5.0]` at the cut.
- **Breaking**: `kryo` → `kontinuum` (`985eadd`).
- **Added**: Kadmon OS web dashboard (`300d0c4`/`df32771`/`d395936`), `/release` upgrade-advisory
  (`3123ec5`), `hebrew-native-copy` skill (`4dae117`), `/sprint` semaphore conventions (`d4ae94a`),
  v2.0 ECC-delta roadmap (`1aac06f`).
- **Fixed**: observations archive / forge+kompact blind (`09ea842`), 5 silent-swallow sites
  (`dd2ad52`), skills-count contract test red on main (`04ff1df`).
- **Changed**: vitest worktree exclude (`59bdf9a`), docs Layer 1-3 sync (`816d0b1`), working-docs
  absorption + CORRECTIONS C-006 (`53490c1`, `d657b13`, `67f0c9c`, `0099483`, `fdb2dc4`, `4da37a2`).

## Test state on main
- **Suite green: 111 files / 1522 collected (1521 passed / 1 skipped)** — re-derived from a real
  run 2026-07-20, not copied from any doc and not taken from the sub-agent that reported it.
  Trail this cycle: 1452 → 1457 (silent-swallow) → 1462 (observations archive) → 1493 →
  1519 (dashboard +26) → 1522 (cold-clone fixture-fidelity tests +3).
  - `1493 + 26 = 1519` reconciles exactly against the independent figure recorded in BACKLOG P2
    (`ee35c72`); `1519 + 3 = 1522` reconciles against the feniks cold-clone fix below. Two
    agreeing derivations per number is the bar before writing one into nine surfaces.
  - Cite the COLLECTED total, never a passed-count — the passed/skipped split is
    environment-dependent (`cold-clone.test.ts` skips its 2 tests when the npm registry is
    unreachable). A red suite also UNDERCOUNTS: tests in a suite that dies in `beforeAll` drop
    out of the total entirely, which is how the pre-fix run read 1519 with cold-clone failing.
  - **Sequencing lesson, learned the hard way this session**: the count sweep ran mid-session at
    1519, then the cold-clone fix in the SAME session moved it to 1522 and invalidated all nine
    surfaces that had just been updated. The sweep is the LAST step of a batch, after every test
    change has landed. Written into the C-001 Amendment.
  - Propagated 2026-07-20 to all nine surfaces per the C-001 Amendment in CORRECTIONS.md.
- **`cold-clone.test.ts` fixture rebuilt on `git ls-files`** (feniks, 2026-07-20). It was timing out
  in full-suite runs: `beforeAll`'s `cpSync` used a hand-maintained exclusion blocklist that could
  not know about `graphify-out/{cache,obsidian}` — 3567 gitignored files added by the 2026-07-19
  graphify rebuild (`7be1108`) — pushing setup past vitest's default 10s hookTimeout. The copy set
  is now derived from `git ls-files`, which is both the faithful definition of a fresh clone and
  self-maintaining against the NEXT generated-output directory. `dist/` stays excluded on purpose
  (ADR-010: the fixture exists to prove `postinstall` regenerates it). Setup 4818ms/4418 files →
  959ms/710 files. No hookTimeout override was added — that would have hidden the cause.
  - `4da37a2` wrote **1490** into CLAUDE.md Status and this file; the real collected total was 1493.
    Corrected on 2026-07-19. Another C-001 recurrence and a live instance of C-006 — a count in a
    working doc is a point-in-time claim, so re-derive it from a real run before citing it.
- Flaky hook tests (AUD-21) root-caused + FIXED via AUD-34 (vitest serialization of heavy
  sql.js/execFileSync tests).
- A main-tree run with an active agent worktree used to report **331 files / 79 failures** — that
  was the worktree sweep, not a real regression, and it is fixed in `59bdf9a`. If those numbers
  ever reappear, check `.claude/worktrees/` before debugging anything else.
- Release-subsystem live-repo coupling (manifest Test 2b + orchestrate.e2e pinned to
  version/date) decoupled to structural invariants during the v1.4.0 cut (`b3650db`). 3rd
  occurrence of the live-repo assertion-fragility class — memory `project_release_e2e_live_state_gotcha`.
  Test (d) in `upgrade-advisory.test.ts` is the last living instance, tracked in BACKLOG.

Last updated: 2026-07-19
