# WORK_COORDINATION — <project name>

> Live coordination doc for a multi-developer team where each developer runs their own Claude Code
> instance against the same repo. **Every session MUST read this file on session-start and update it
> on handoff.** Consumed and mutated by the `/sprint` skill (claim on start, sync on merge).
>
> Copy this template to the repo root as `WORK_COORDINATION.md`, fill the roster and the initial
> Next planned table, delete the channels you do not need, and commit before the first `/sprint`.
>
> Coordination channels (keep only what the team shape requires):
> - **File-level** (core, always keep) — branches, PRs, conflict zones inside this repo.
> - **Contract-level** (optional) — a collaborator who builds against a schema/contract doc instead of
>   repo files (e.g. an external frontend consuming an API contract).
> - **Security-review** (optional) — a security gate engaged at hardening checkpoints, not a generic
>   supervisor.

> **Last updated:** YYYY-MM-DD by <owner> (<event>)

## Roster

| Person | Role | Channel |
|--------|------|---------|
| <name> | Architect / final decision-maker | — (decides) |
| <name> | Implementer (Claude Code instance) | file-level |
| <name> | Collaborator (own machine + subscription, parallelizes via `/sprint`) | file-level |
| <name> | Contract consumer (optional) | contract-level |
| <name> | Security reviewer (optional) | security-review |

### Repo access

| Person | Git host login | Permission | State |
|--------|----------------|------------|-------|
| <name> | <login> | admin | owner |
| <name> | <login> | write | active collaborator |

---

## Channel A — File-level (core)

### Active tracks

| Track | Owner | Branch | Plan/ADR | Status | Started | ETA |
|-------|-------|--------|----------|--------|---------|-----|
| A | <owner> | feat/plan-001-<slug> | plan-001 | IN PROGRESS YYYY-MM-DD — <one-line scope> | YYYY-MM-DD | <eta> |

### Next planned (roadmap — `/sprint` consumes this)

> Rows are **pointers** (title + intent + dependency), NOT specs — each track's ADR + plan is authored
> via `/abra-kdabra` WHEN claimed, never pre-written. Owner-candidates are tentative: any collaborator
> can claim an `UNLOCKED` row. Goal = readiness, not pre-assignment.

| Plan | Phase / scope | Trigger | Owner-candidate (tentative) |
|------|---------------|---------|------------------------------|
| plan-001 | <title + one-line intent> | UNLOCKED | <name> |
| plan-002 | <title + one-line intent> | After plan-001 | <name> |

> Number caveat: plan-NNN above is tentative — ADRs and plans share one counter; the real number is
> assigned at `/abra-kdabra` time. Renumber the row if a standalone ADR drifts the counter.

### Locked rules

1. **Read this file on session-start, update on handoff.** Every session, every collaborator.
2. **No concurrent edits to the same file** — coordinate here (or on the team channel) before opening
   a conflicting branch.
3. **`WORK_COORDINATION.md` edits follow merge-to-main discipline** — do not let two sessions diverge it.
4. **Secrets:** never commit `.env`; rotation (not deletion) is what neutralizes a leaked key.

### Conflict zones (file-ownership)

| File / area | Owner this cycle | Notes |
|-------------|------------------|-------|
| <path or glob> | <owner> (Track A plan-001) — <one-line purpose> | |
| `docs/decisions/`, `docs/plans/` | append-only | new ADR/plan = new file; never rewrite history |

---

## Channel B — Contract-level (optional — delete if unused)

A contract-level collaborator does NOT appear in Channel A conflict zones — their coordination surface
is a versioned contract document, not repo files.

| Contract | Version | Source of truth | Consumed by | Status |
|----------|---------|-----------------|-------------|--------|
| <schema name> | v1 | `docs/contracts/<name>.md` | <consumer> | |

- **Handoff mechanism:** a change to the contract doc IS the handoff. The producing side owns the
  schema; the consuming side derives/validates against it.
- Record contract DIFFs here as dated bullets so the consumer catches up asynchronously.

---

## Channel C — Security-review (optional — delete if unused)

The security reviewer is a **gate**, not a generic supervisor — engaged at hardening checkpoints and
any secrets/auth boundary.

| Review item | Trigger | Status |
|-------------|---------|--------|
| <surface to review> | <phase / event> | not started |

- Sign-off is recorded here when given (date + scope).

---

## Done log (reverse-chronological)

- YYYY-MM-DD DONE **plan-NNN <slug>** — <1-2 sentence summary>. (<owner>, branch
  feat/plan-NNN-<slug>, PR #<num> -> <merge-hash>). Tests <prev>-><new> (+<delta>).

---

## Next session — start here

**Where we are:** <2-4 sentence state-of-the-repo summary: what is merged, what is live, key metrics.>

**How to start a feature track:** claim an `UNLOCKED` row from the **Next planned** table via
`/sprint` (branches from main) — then `/abra-kdabra` authors that track's ADR + plan — TDD +
`/chekpoint` per boundary — `/sprint close` opens the PR + syncs this file.

**Next gates:** <numbered list of the 1-3 things blocking the next milestone.>
