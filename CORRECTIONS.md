# CORRECTIONS — append-only project-behavior log

Rules learned from incidents in THIS repo. Project-scope behavior only — personal style
preferences stay in the architect's private memory. Newest entries at the bottom; never
edit or delete an existing entry (append an amendment instead).

Format per entry: ID — date — rule / incident / how to apply.

---

## C-001 — 2026-07-12 — Off-cadence commits still run the full discipline

**Incident:** the 2026-06-24 -> 2026-07-06 commit window (Sentinel bootstrap, fable-prompt
skill, graphify hook) bypassed /chekpoint tiers, /doks, and CHANGELOG. Result: a red
contract test on main, 15 doc-drift items, and an uncataloged live hook — all concentrated
in ~3 commits, against an otherwise meticulously synced history.
**Rule:** every commit — especially a quick one after a long idle window — runs its
/chekpoint tier, adds a CHANGELOG [Unreleased] entry, and triggers /doks when
agents/skills/commands/hooks change.
**Apply:** if the diff adds or removes a component, grep its count in CLAUDE.md, README,
and the contract tests (`tests/plugin/manifest-schema.test.ts`) before committing.

## C-002 — 2026-04-19 / 2026-04-24 — Never revert unrecognized working-tree changes

**Incident:** parallel Claude Code sessions produced diffs the active session did not
recognize; reverting them destroyed hours of work (abra-kdabra incident + plan-028/029
duplication).
**Rule:** on seeing an unrecognized working-tree change, STOP and ask — never assume hook
artifact or accident. Prevent with `git worktree add` per session at kickoff, and note the
session's touched surface in WORK.md.
**Apply:** cost of asking is 5 seconds; cost of a destructive revert is hours.

## C-003 — 2026-04-24 — /medik Phase 2 always runs

**Incident:** Phase 2 (mekanik + kurator) was skipped because Phase 1 returned 0 FAIL;
the spec says Phase 2 "always runs regardless".
**Rule:** never gate Phase 2 on Phase 1 results — it catches heuristic drift, duplicated
boilerplate, and integration subtleties mechanical checks cannot see.
**Apply:** treat "Phase 1 clean" as zero evidence about Phase 2 scope.

## C-004 — 2026-04-24 — Validate before build, smoke before merge

**Incident class:** fixes designed against remembered bugs that no longer reproduced, and
plans merged without their mandated E2E smoke.
**Rule:** when a memory documents a bug with a deferred fix, first run the cheapest test
that could falsify the bug still reproducing. When a plan mandates a smoke test, negotiate
scope (one invocation), never existence.
**Apply:** fresh evidence beats historical assumption; a 2-minute repro attempt precedes
any fix design.
