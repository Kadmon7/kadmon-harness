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
