---
number: 040
title: Release the v2.0.0 Reservation — ECC-Delta Waves Ship as MINORs
date: 2026-07-19
status: accepted
route: A
references: [ADR-025, ADR-010, ADR-021, ADR-035, ADR-037]
---

# ADR-040: Release the v2.0.0 Reservation — ECC-Delta Waves Ship as MINORs

**Deciders**: Ych-Kadmon (architect), arkitect (ratifier)

## Context

`docs/roadmap/v2.0-ecc-delta-ports.md` (2026-07-17) framed the ECC v1.8.0..v2.0.0 delta port track
as the content of a future **v2.0.0**. That framing was never tested against a policy — it was an
informal reservation carried in the roadmap's title and repeated in `WORK.md`. Separately,
`docs/roadmap/v2.0-multi-project.md` holds a second, older set of v2.0 epics (multi-project,
Supabase sync, Skill Tier B-C). Two unrelated tracks were pointed at the same version number.

[ADR-025](ADR-025-versioning-policy.md) defines what a MAJOR actually is. It is not "the next big
thing" — it is an enumerated list of contract breaks:

1. `.claude-plugin/plugin.json` manifest schema change,
2. `install.sh` / `install.ps1` CLI flags removed or semantics changed,
3. environment variable contract broken (removed, renamed, repurposed),
4. removal or renaming of a harness-exposed agent, command, skill, or hook,
5. upward bump of the Node engine floor (`engines.node`).

On 2026-07-19 the roadmap was ratified in an append-only amendment at the end of that file
(`# Ratification — 2026-07-19 (arkitect)`). That amendment is the evidence base for this ADR and is
not re-derived here. Its relevant products: item-level verdicts (RATIFY / DEFER / DOWNSCOPE /
REJECT), a trust discount on the roadmap's Kadmon-side current-state claims, a revised sequencing
table, and the section **"Does v2.0.0 still make sense as the vehicle? — NO. Release the
reservation."** which tested every surviving item against the five criteria above and found **zero**
qualifying.

The reservation is not free. Holding it already produced one policy violation — see Consequences
§ "The violation this reservation already caused". This ADR closes the question so items 1-4 of the
revised sequencing table can be scheduled against real version numbers.

## Decision

**Release the v2.0.0 reservation on the ECC-delta track.** The surviving waves ship as a sequence of
**MINORs** under ADR-025's existing criteria — `v1.6.0` through `v1.9.x` — one narrative per release.

**Re-reserve v2.0.0 for the multi-project + Supabase-sync track** (`docs/roadmap/v2.0-multi-project.md`).
That track changes where harness state lives, which is a contract break under ADR-025 criterion 3
(env-var surface) and plausibly criterion 1 (manifest schema); `CLAUDE.md` already carries the marker
`Persistence: SQLite at ~/.kadmon/kadmon.db (v1) — Supabase planned for v2`. **This ADR does not
design that track** — it only names it as the intended occupant of the number. If a different genuine
break arrives first, that break takes v2.0.0 and multi-project follows.

This ADR **applies** ADR-025; it does not amend it. ADR-025's text is unchanged and remains
authoritative. A recommended amendment to ADR-025 is stated in Consequences (not applied here, per
append-only ADR discipline).

### Wave-to-version slotting

The constraint doing the work is **ADR-025 MINOR criterion 1 — "one narrative scope"**: if the
CHANGELOG entry would need two unrelated "Added" sections, it should have been two MINORs. That is
why Wave 1 and Wave 4 split, and why the sequence is longer than the wave count.

| # | Item (ratification ref) | Target | Gate |
|---|---|---|---|
| 1 | Wave 1a — operator ergonomics: `/aside` + kontinuum "WHAT NOT TO RETRY" | **v1.6.0** | none |
| 2 | Versioned JSON contracts + schemas (promoted out of Wave 4, A11) | **v1.6.0 / v1.7.0** | none |
| 3 | Wave 1b — review quality: reviewer lenses + `runtimeConfidence` (A2, A3) | **v1.7.0** | `log()` scrubber contract closed |
| 4 | `/medik` Check #17 — mechanized `security-scan` subset (Wave 3a reframed, A5) | **v1.7.0** | none |
| 5 | Security baseline drift persistence (Wave 3b) | **v1.8.0** | Check #17 shipped + stable output; conditional ADR |
| 6 | `/chekpoint` Phase 2 evidence-keyed dedup (Wave 4b, A9) | **v1.8.0** | ADR |
| 7 | Sanitizer skill only (Wave 3c, A6 — forker + packager rejected) | on demand | AUD-41 or a fork release |
| 8 | CI-runnable `/medik` + install-state record (Wave 4c downscoped, A10) | **v1.9.0** | none |
| 9 | hookify loop (Wave 4a, A8) | **v1.9.0+** | >= 4 weeks post-Wave-0 `/forge` data **and** ECC validation experiment closed; ADR |
| 10 | Wave 2 consumer packs | **deferred** | a consumer asks by name **and** the rule-scope routing model is decided |
| 11 | GateGuard destructive-command gate (Wave 3d, A7) | **deferred** | AUD-33 closed or won't-fixed **and** a real incident |

Notes on the splits, each traceable to criterion 1:

- **Wave 1 splits across two MINORs.** `/aside` + kontinuum is *operator ergonomics*; reviewer lenses
  + `runtimeConfidence` is *review quality*. Two headlines, two releases. The second half is
  additionally blocked (A2) on the open `log()` scrubber contract — shipping a lens that instructs
  reviewers to add `log()` calls before that contract is decided manufactures the "sixth caller" risk
  spektr flagged.
- **Wave 3 lands post-60%-cut.** Only the mechanized check and the drift record are scheduled; the
  sanitizer is on-demand and GateGuard is deferred. `forker` and `packager` were rejected outright
  (duplicate `gh` and `/release`).
- **Wave 4 splits four ways**, with hookify gated on learning-layer data quality. Its inputs are not
  trustworthy yet: `/forge` was systematically blind on long sessions until Wave 0 shipped, `/evolve`
  is starving, and the ECC validation experiment is overdue and never run.
- **Wave 2 is deferred with an explicit trigger**, not cancelled. Absent a named consumer ask it is
  speculative inventory, and its real question (optional pack vs core) is an ADR question, not a
  per-skill one.
- **Rejected items keep their rejection**: `skill-scout` (A4), manifest-driven selective installer
  (A10 — ADR-010 + ADR-021 already settled it), reviewers-read-only (A12 — already true on disk).

Each row above is a MINOR candidate, not a commitment: ADR-025's other three criteria (an ADR or plan
exists, collaborators can notice it, tests + `/chekpoint` pass) still gate each individual bump.

## Alternatives Considered

### Alternative 1: Hold the v2.0.0 reservation and ship the ECC-delta track as v2.0.0

- **Pros**: preserves the roadmap's existing framing; one visible "big release" moment for
  collaborators; requires no re-slotting of the sequencing table.
- **Cons**: ships a MAJOR whose entire content is additive, which drains the signal out of the number
  — a collaborator who sees `v2.0.0` and reads "no migration steps" learns that Kadmon MAJORs mean
  nothing. Worse, it keeps the number occupied while genuine breaks arrive, which is precisely the
  mechanism that produced the v1.5.0 violation. It also leaves two unrelated tracks
  (`v2.0-ecc-delta-ports.md`, `v2.0-multi-project.md`) pointed at one number.
- **Why not**: fails ADR-025 on its own terms. The MAJOR criteria are a five-item enumeration, not a
  size heuristic, and the ratification's per-item table records zero matches.

### Alternative 2: Amend ADR-025 to add a "large additive milestone" MAJOR trigger

- **Pros**: would legitimize the reservation retroactively; gives the project a way to mark
  significant-but-non-breaking milestones at the MAJOR level.
- **Cons**: destroys the property that makes MAJOR useful — "MAJOR means you must do something before
  upgrading". SemVer's contract is about compatibility, not importance. Under this amendment
  `v1.5.0`'s `kryo` rename would *still* have been mis-slotted, because the amendment addresses
  magnitude and the violation was about breakage. It solves the wrong problem.
- **Why not**: it would be an amendment written to justify a decision already made informally, which
  is the inverse of how ADR-025 came to exist (it was written to *stop* an unwritten cadence from
  governing).

### Alternative 3: Release the reservation and leave v2.0.0 unassigned

- **Pros**: maximum honesty — no number is held for anything; the next real break simply takes it.
- **Cons**: `CLAUDE.md` already publishes "Supabase planned for v2" to every reader and every
  consumer repo that copied the onboarding catalog. Leaving the number unassigned while that string
  ships creates a second, quieter reservation that is not written down anywhere reviewable.
- **Why not**: near-miss. Adopted in substance — the re-reservation is deliberately *named but not
  designed*, and this ADR states explicitly that an earlier genuine break may claim the number
  instead. That preserves Alternative 3's honesty while keeping the existing published expectation
  documented rather than implicit.

## Consequences

### The violation this reservation already caused

**State it plainly: v1.5.0 shipped a MAJOR-triggering change as a MINOR, and the reservation is why.**

`v1.5.0` (cut 2026-07-19, commit `ce4628d`, annotated tag pushed with `--follow-tags`) shipped the
`kryo` → `kontinuum` skill rename (`985eadd`). Under ADR-025 that is criterion 4 verbatim —
*"removal or renaming of a harness-exposed agent, command, skill, or hook"*. It is not a borderline
case: the plugin loader resolves skills by directory, so the `kryo` name resolves to nothing, silently,
for any consumer, prompt, doc, or memory that referenced it. `CHANGELOG.md` `[1.5.0]` says so in its
own `### Breaking` section.

The reasoning at the time is on the record in `WORK.md`: *"MINOR, not MAJOR, despite the breaking
`kryo` → `kontinuum` rename: v2.0.0 stays reserved for the ECC-delta roadmap; the break ships as an
explicit `### Breaking` CHANGELOG section + upgrade advisory."* The mitigations were real and
correctly applied — a dedicated `### Breaking` section plus the ADR-037 D7 upgrade-advisory phase —
but they are mitigations for a mis-slotted version, not a substitute for the right one. The decision
was caused by the reservation, not by the rename. **This ADR is where that is acknowledged rather
than left buried in a working doc.**

**(a) Do we retroactively re-tag `v1.5.0` as `v2.0.0`? — No.**

ADR-025 already answered this exact question on this exact reasoning. Its Context records that the
retroactive-rename path was evaluated and rejected for the v1.2.x cadence problem: *"git tags are
history, and collaborators ... had already pinned those tags or installed the plugin under them.
Rewriting SHAs breaks trust without fixing the underlying cadence problem."* Its Consequences make it
policy: *"Past tags ... are unchanged and remain valid install targets ... This ADR is forward-looking;
it does not rewrite."* Every element holds here and more strongly: `v1.5.0` is pushed, the annotated
tag is on the remote, two diverged forks (Sentinel-harness, Kadmon7Cowork-Harness, AUD-41) track this
repo, and the CHANGELOG's `### Breaking` section plus the upgrade advisory already give consumers the
one action they need (update the `kryo` slug). Re-tagging would rewrite published history to improve a
label while delivering zero additional information to any consumer. The record of the error lives here
instead.

**(b) What prevents the next occurrence?**

Three things, in order of strength:

1. **Removing the cause.** The violation happened because a MAJOR-triggering change arrived while
   `v2.0.0` was occupied by additive work, forcing a choice between "block the release" and "ship it
   as MINOR". Releasing the reservation means the next criterion-4 event has an unoccupied number to
   take. This is the actual fix; the other two are backstops.
2. **A pre-tag criteria pass, not a vibe check.** ADR-025 § Enforcement item 1 asks *"can I describe
   this release in one sentence?"* — a MINOR-scope question that structurally cannot catch a MAJOR
   trigger. **Recommendation (not applied here, per append-only discipline): ADR-025 should be
   amended to add a second pre-tag question — "does this diff hit any of the five MAJOR criteria?" —
   walked explicitly against the enumerated list.** `/release` (ADR-037) is the natural host: it is
   explicit-bump-only by design and already classifies `git diff --name-only v<prev>..HEAD` into
   ADR-010 distribution territories for the upgrade advisory. The same diff would support a
   MAJOR-criteria prompt at the bump step. That amendment and that `/release` change are follow-up
   work, deliberately out of this ADR's scope.
3. **The written record.** A `### Breaking` section in a MINOR's CHANGELOG entry is now a documented
   smell — it is the artifact that proves the criteria pass was skipped or overridden. Reviewers
   should treat it as such.

### Positive

- Items 1-4 of the revised sequencing table become schedulable. They were blocked on this ADR: a
  version number could not be assigned to a wave while the reservation was open.
- `v2.0.0` regains its meaning. When it ships, it will carry migration steps, per ADR-025's rule that
  MAJOR bumps require a migration note pointing at concrete steps.
- The two v2.0 roadmap documents stop competing for one number. `v2.0-multi-project.md` is the
  intended MAJOR; `v2.0-ecc-delta-ports.md` becomes a v1.6+ MINOR sequence.
- Release cadence stays inside the policy already in force. No new versioning vocabulary is
  introduced, no existing tag is touched, and every consumer's install path is unchanged.

### Negative

- Ten-plus MINORs where one MAJOR was imagined. `v1.9.x` will exist and the harness will look
  "stuck in v1" for months. This is the honest reading: the work genuinely is additive, and a version
  number is a compatibility statement, not a progress bar.
- The re-reservation of `v2.0.0` is itself a reservation, and this ADR argues reservations cost
  something. Mitigated by scope: it is named and not designed, it is documented rather than implicit,
  and this ADR states explicitly that an earlier genuine break may take the number instead — the
  precise property the ECC-delta reservation lacked.

### Risks

- **Risk: current-state drift invalidates a scheduled item.** The ratification found **four of the
  roadmap's Kadmon-side current-state claims were false or stale when checked against the live tree**:
  (1) "auditing the `.claude/` tree is the one layer Kadmon does not cover" — false, `security-scan`
  already covers all five AgentShield categories and is already in spektr's `skills:` frontmatter;
  (2) "Kadmon's reviewers carry Write/Edit" — false, all five carry exactly `Read, Grep, Glob, Bash`;
  (3) "/medik unreachable in consumers (9/14 checks)" — stale, closed by the 2026-07-12 audit waves;
  (4) `skill-scout`'s function — already covered by `search-first` + `skill-stocktake`.
  **Mitigation, now a standing rule: re-verify every remaining item against the live tree at
  scheduling time, not at planning time.** A ratified verdict is a point-in-time claim (`CORRECTIONS.md`
  C-006), and a version slot is not a commitment to build. **`graphify-out/` is ~2.5 months stale
  (BACKLOG) and is NOT a valid verification source** — verification means reading the live files.
- **Risk: the "one narrative" splits get collapsed under schedule pressure**, and v1.6.0 absorbs both
  Wave 1 halves. Mitigation: the split is criterion-1 driven and recorded in the slotting table above;
  a merged entry would need two unrelated "Added" sections, which is the visible tell.
- **Risk: a MAJOR-triggering change lands mid-sequence** (e.g. an item 1-9 implementation renames an
  existing component rather than adding one). Mitigation: it takes `v2.0.0`, ahead of multi-project,
  per the Decision. That is the point of releasing the reservation.
- **Risk: the enforcement gap that caused the violation survives this ADR**, because the recommended
  ADR-025 amendment and the `/release` criteria prompt are follow-ups, not deliverables here. Honest
  statement of the residual: until one of them lands, prevention rests on cause-removal (1) plus human
  review. Evidence that this is insufficient: a second `### Breaking` section appearing under a MINOR.

### Follow-ups this ADR unblocks (not written here)

The ratification calls for three further ADRs. This ADR is a precondition for scheduling them; it does
not write them.

1. **hookify** — correction → declarative rule file → generic rule-interpreter hook. Must cover the
   rule-file schema, the block-vs-warn severity model, precedence against `pattern-definitions.json`
   (ADR-006), the < 100ms guard-tier latency budget, and the A8 data-quality gate.
2. **`/chekpoint` Phase 2 dedup + dissent verifier** — must state the evidence key and restate the A9
   consolidator boundary as a hard invariant with a mechanical check: the verifier may only append a
   dissent NOTE, never suppress or downgrade an upstream finding.
3. *(conditional)* **Security baseline drift persistence** — 8th DB table vs file artifact. Only once
   `/medik` Check #17 exists and produces stable output.
4. *(conditional)* **Consumer-pack distribution strategy** — only if Wave 2 is revived. Covers the
   pack-vs-core question, not the individual skills.

Separately recommended, outside the ratification's list and outside this ADR: an **ADR-025 amendment**
adding the MAJOR-criteria pre-tag pass described in (b)(2) above.

No ADR is needed for `/aside`, kontinuum, the reviewer lenses, `runtimeConfidence`, Check #17
(inherits ADR-028/029 patterns), the versioned JSON contracts, or the sanitizer skill.

## Review

- **Next review**: at the `v2.0.0` cut, or **2026-10-23** (co-scheduled with ADR-025's own 6-month
  review), whichever comes first. Evidence to evaluate: did the waves ship as one-narrative MINORs?
  Did any release carry a `### Breaking` section under a MINOR again? Is `v2.0.0` still held by
  multi-project + Supabase sync, or did an earlier genuine break claim it?
- **Superseding conditions**: a change in what MAJOR means for this repo (i.e. an ADR-025 amendment or
  successor), or the multi-project/Supabase track being cancelled or descoped to something additive —
  in which case `v2.0.0` returns to unassigned and this ADR's re-reservation is superseded.
