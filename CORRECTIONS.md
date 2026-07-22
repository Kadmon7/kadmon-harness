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

## C-005 — 2026-07-13 — Heuristic guard hooks: fix realistic cases, document scope, stop the bypass arms race

**Incident:** `config-protection.js` (a defense-in-depth hook that blocks weakening linter/
compiler configs) needed 3 successive feniks rounds during one /chekpoint — each kody gate
found a new structural-scanning bypass (first-block-only, then nested-brace, then
string-literal `}`). Regex/char-scanning fundamentally cannot robustly parse nested configs
with string literals; a determined search always finds one more edge (comments, template
literals, ...).
**Rule:** for a heuristic guard whose threat model is the agent/user editing their OWN
files (not an adversary crafting evasion payloads), close the REALISTIC bypasses with
regression tests, document the residual scope in the code + backlog, and stop — do not chase
adversarial edge cases that no honest edit produces. If a true guarantee is ever needed,
switch approach entirely (real parser: `JSON.parse` + object-walk / a tokenizer), don't keep
patching the scanner.
**Apply:** name the threat model explicitly before the 3rd patch round; if the remaining
bypasses require hostile intent the model doesn't include, ship with a documented scope note
+ a deferred backlog item (here: AUD-33), not another regex tweak.

## C-006 — 2026-07-16 — Every written claim about state is stale until re-derived. C-004 was scoped too narrowly.

**Incident:** one session hit the same failure class five times, from five different kinds of
artifact, each of which had been treated as fact:
1. `docs/insights/2026-07-12-full-harness-audit.md` dated the ToratNetz repo "pushed 2026-07-10".
   Real first commit: 2025-12-11 — the audit was off by five months, and the note it was
   correcting ("repo not created yet") had been wrong for most of the project's life.
2. `WORK.md` said "suite green 1452 (1451 passed / 1 skipped)". Real: 1450 passed, **1 FAILED**,
   1 skipped. main had been RED since `4dae117` and nobody re-ran the suite. Found by `/doks`,
   not by anyone reading the claim.
3. `ADR-026`'s follow-up checkboxes said two items were "deferred to v1.4". One had shipped
   months earlier as `/medik` Check #16 (`0adb544`); the other had been retracked as R-14.
4. `graphify-out/GRAPH_REPORT.md` listed `log` (`scripts/lib/utils.ts`) among its god nodes.
   Reality: `log` had **zero callers repo-wide**. The graph was 2.5 months stale — and
   `CLAUDE.md` carries a standing rule to consult it BEFORE grepping. It was cited as evidence
   to a sub-agent that reusing `log` "followed the established convention". It did not.
5. A `/chekpoint` specialist wrote that a known anti-pattern was "backlog-bound". kody grepped
   `BACKLOG.md` and found no line. Two agents had said it; nobody had written it.

**Rule:** C-004 ("validate documented bugs before building the fix") named only *memories*. The
class is far wider: **audits, working docs, ADR checkboxes, generated graphs, and sub-agent
reports are all point-in-time claims that decay.** Before acting on any of them — especially
before citing one as evidence to a sub-agent or writing it into a commit message — re-derive it
from the source of truth. The cost is one command; today it was five commands against five hours
of compounding wrong.

**Apply:**
- A count, a date, a status, or a "green" in ANY document is a hypothesis. Re-derive: `ls | wc -l`,
  `git log --reverse`, run the suite, `grep` the actual symbol.
- **A recommendation is not a fact.** "Backlog-bound", "tracked separately", "will fix later" in
  prose means nothing until a line exists in `BACKLOG.md`. Write it in the same turn you say it.
- **Never cite a generated artifact as evidence without checking its freshness.** `graphify-out/`
  has a mtime; `/medik` Check #16 exists to flag exactly this. A stale graph is worse than no
  graph: it answers confidently and wrongly, and the rule tells you to trust it first.
- Sub-agent reports are evidence, not verdicts. kody re-ran spektr's experiments by hand and
  re-verified all three of ts-reviewer's "closed" WARNs in the staged diff. That is the standard —
  the Phase 3 dual gate exists because consolidation can silently drop things.
- Corollary for authors: when you write a claim into `WORK.md` / `BACKLOG.md` / an ADR, write how
  it was derived, so the next reader can cheaply re-check instead of inheriting it as fact.

## C-001 Amendment — 2026-07-20 — the count-propagation target list, derived empirically

**Why:** C-001's **Apply** clause names three grep targets (CLAUDE.md, README, the contract tests).
That list is incomplete, which is the mechanical reason the count drift keeps recurring despite the
rule existing — a compliant sweep still left four surfaces stale. The 2026-07-16 `/doks` pass found
`docs/onboarding/reference_kadmon_harness.md` at 52 skills / 11 shared modules; the 2026-07-20 sweep
found the same file plus three memory surfaces still carrying `1493` after the real total moved to
1519. Both were C-001-compliant commits.

**Full target list** (walked by hand 2026-07-20 — this is the measured set, not a guess):

| # | Surface | What it carries |
|---|---|---|
| 1 | `CLAUDE.md` § Status | every component count + test total |
| 2 | `README.md` | **three** places: the shields.io badge, the stats table, the footer stat line |
| 3 | `tests/plugin/manifest-schema.test.ts` | `expectedCounts` — the only MECHANICAL guard; it covers symlinked component dirs, NOT the test total |
| 4 | `docs/onboarding/reference_kadmon_harness.md` | CONSUMER-FACING — re-dropped into other repos |
| 5 | `.claude/{agents,hooks,commands}/CATALOG.md` | per-type counts live in the **frontmatter `description:`**, not the body — verified 2026-07-20: agents "16-row Agent table", hooks "23 registered hooks + 12 shared modules", commands "12 commands grouped by 8 phases" (ADR-035) |
| 6 | `WORK.md` § Test state | current-state line only — the trail lines above it are HISTORY, never rewrite them |
| 7 | memory `project_v1_production.md` | frontmatter `description:` AND the body counts — two spots, one file |
| 8 | memory `reference_kadmon_harness.md` | CONSUMER-FACING catalog |
| 9 | memory `MEMORY.md` index | the one-line hook repeats the counts |

**Rule:** a commit that changes a component count or the test total sweeps all nine, not the three
C-001 originally named. Surfaces 4 and 8 are consumer-facing — a wrong count there propagates to
Kadmon-Sports and ToratNetz on the next re-drop, so they are the expensive ones to miss.

**Apply:**
- Cite the **collected** total, never a passed-count. The passed/skipped split is environment-
  dependent — `tests/build/cold-clone.test.ts` skips its 2 tests when the npm registry is
  unreachable, which alone moved the skip count 1 → 3 with no test added or removed. A doc reading
  "1521 passing" becomes false on the first offline run; "1522 collected" stays true.
- A failing suite **undercounts**: tests in a suite that dies in `beforeAll` drop out of the total
  entirely. Never derive a count from a run with a red suite — fix it first, then measure.
- Reconcile before propagating. `1493 + 26 = 1519` matched the independent figure already recorded
  in `BACKLOG.md`, and `1519 + 3 = 1522` matched the test count added by the cold-clone fix. Two
  agreeing derivations per number is the bar for writing one into nine files.
- **Sweep LAST in a batch, never mid-session.** Learned live on 2026-07-20: the nine surfaces were
  propagated at 1519, then a cold-clone fixture fix landed in the SAME session, added 3 tests, and
  invalidated all nine — a full second pass for one avoidable ordering mistake. If any test change
  is still in flight (a running sub-agent, an unmerged branch, a known-red suite), the count is not
  yet a fact. Finish the code, get the suite green, THEN sweep.
- **A sub-agent's count is evidence, not a verdict** (C-006). feniks reported 1521 passed / 1 skip;
  that was re-derived here with an independent `npx vitest run` before any doc was touched. It
  matched — but the matching is the point, not the trusting.
- This list is the specification for the `memory-audit` skill (BACKLOG P1). Mechanizing it is the
  real fix — nine hand-walked surfaces is a checklist that will be skipped again.

## C-007 — 2026-07-22 — AutoDream: the claim was false, and so was part of the refutation

**Incident:** `CLAUDE.md` and `docs/onboarding/CLAUDE.template.md` claimed "AutoDream:
consolidates memory every 24h/5+ sessions". The 2026-07-19 audit ruled it "does not exist —
zero implementation" (root cause of ~3 months of unaudited memory rot: sessions assumed a
mechanism was maintaining typed memories). Verification 2026-07-22 refined BOTH sides: the
live settings schema DOES define `autoDreamEnabled` ("Enable background memory consolidation
(auto-dream). When set, overrides the server-side default") — so a prior cleanup that removed
that key from global settings as "invented" was itself wrong — but official docs
(code.claude.com/docs/en/memory.md, checked via claude-code-guide) document NO auto-dream
feature, NO background consolidation, and NO cadence. The "24h/5+ sessions" trigger has no
source anywhere.
**Rule:** a claim about an external mechanism has two failure modes — the mechanism may not
exist, and the refutation may overreach. Verify at the product layer (settings schema + official
docs), not only by grepping this repo: "no implementation here" cannot distinguish
native-feature from fiction, and surfaces OUTSIDE the repo (global settings) carry the same
claim.
**Apply:** memory upkeep is MANUAL until a documented mechanism exists — the claim is deleted
from both files and replaced with a manual-upkeep line. `autoDreamEnabled` stays UNSET in
global settings (falls back to the server-side default): undocumented and never observed to
run, so re-enable it deliberately, never by default. The honest replacement is the
`memory-audit` skill (BACKLOG P1).
