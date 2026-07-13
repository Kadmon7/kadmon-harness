# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

> **2026-07-13 post-compact reset.** All SHIPPED items pruned to git log / CHANGELOG.
> Only OPEN work below. Full shipped history: `git log` + `docs/decisions/` + `docs/plans/`.

## Task list (open)

### Next up
- **AUD-37** — split `scripts/lib/state-store.ts` (~1201 lines > 800 hard limit) into modules
  (extract agent-invocation + research-report concerns). Mechanical → konstruct + feniks.
  **← pick this next.**

### Open AUD (post-AUD-37 cleanup)
- **AUD-25** — /medik graphify integration (roadmap R-13, measurement gate PASSED).
- **AUD-26** — /evolve cadence nudge (/nexus badge or session-end "N unconsumed ClusterReports").
- **AUD-40** — /release cross-process committed-but-untagged recovery (LOW; human-invoked + narrated, missed tag visible pre-publish).
- **AUD-33** — config-protection heuristic → real JS tokenizer / JSON.parse walk (LOW; near won't-fix per threat model).

### Release milestone
- **Cut v1.4.0** via `/release minor` (dogfood the new command) once AUD-37 + AUD-25/26 land.
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

## Landed but unreleased (CHANGELOG [Unreleased] — clears on v1.4.0 cut)
- Everything on main since v1.3.0: AUD-01..39 (minus deferred), ADR-037 (/release), ADR-038
  (working-docs standard), fable-prompt, graphify hook. All pushed, none tagged. `/release minor` clears this.

## Test state on main
- Flaky hook tests (AUD-21) root-caused + FIXED via AUD-34 (vitest serialization of heavy
  sql.js/execFileSync tests). Suite green 1385/1385.

Last updated: 2026-07-13
