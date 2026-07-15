---
name: sprint
description: "Track lifecycle for multi-developer parallel work coordinated through WORK_COORDINATION.md. Two modes — /sprint claims a track + branches from main against the Next planned table; /sprint close runs the verification gate, opens a PR with a structured body, auto-merges when eligible, then post-merge syncs WORK_COORDINATION and flips the plan-NNN frontmatter status. Use this skill whenever someone says start plan, claim track, open track, ship plan, close plan, ready for PR, post-merge sync, flip track done, sprint close, or partial ship — even when they do not name the skill. First use in a project: instantiate WORK_COORDINATION.template.md (same directory) at the repo root."
requires_tools:
  - Bash
---

# /sprint — Track lifecycle for parallel multi-developer work

Two-mode skill that wraps the recurring parallel-tracks workflow coordinated through a repo-root
`WORK_COORDINATION.md` (file-level channel). Multiple developers — each running their own Claude Code
instance — work the same repo without collisions: every session claims a track before touching files,
and releases it on merge.

Origin: battle-tested pattern (13+ tracks shipped by 4-person teams without file collisions).
This is the portable, project-agnostic port.

| Invocation | When | What it does |
|---|---|---|
| `/sprint` | Session start, before any work on a new plan | State check + branch from main + claim track |
| `/sprint close` | Plan boundaries shipped, ready to merge | PR open + verification gate + post-merge sync + flip Track DONE |

## First use in a project

If the repo has no `WORK_COORDINATION.md` at its root, copy `WORK_COORDINATION.template.md` (shipped
next to this skill) to the repo root, fill in the roster and the initial Next planned table, and commit
it before the first `/sprint` invocation. The skill STOPs when the file is missing.

## Status tokens (literal — the skill greps for them)

| Token | Meaning |
|---|---|
| `UNLOCKED` | Track row claimable now |
| `IN PROGRESS` | Track claimed, work ongoing |
| `DONE` | Track merged and synced |
| `LOCKED` / `After plan-MMM` | Blocked on predecessor |

Projects MAY prefix tokens with the status emoji set used in their coordination doc; the skill matches
on the word, not the emoji.

## /sprint (default) — start a plan

Run at session start before opening `/abra-kdabra` or starting any new plan work.

### Steps

1. **State check** — run in parallel:
   ```bash
   git fetch --all --prune
   git status --short
   gh pr list --state open --json number,title,author,headRefName,mergeable
   ```
   Print: current branch + any uncommitted changes + table of open PRs (own + other collaborators).

2. **Pending merge check** — if there are merged-but-not-synced PRs (someone else merged to main since
   the last pull), or if any of our own PRs are still OPEN, STOP and report. Resolve before opening a
   new branch.

3. **Ask user which plan + check status** — if not obvious from conversation context, ask which plan to
   start (e.g. plan-009). Then validate against the `WORK_COORDINATION.md` **Next planned** table:
   - Plan-NNN row must exist
   - Trigger column must be `UNLOCKED`, or `After plan-MMM` with all predecessors DONE — never
     already `DONE` (shipped) or LOCKED with pending predecessors
   - If row missing, STOP. The user adds the row to Next planned first (manual edit; out of skill scope).

   The plan file (`docs/plans/plan-NNN-*.md`) is OPTIONAL at this step — it may be authored before
   (plan-first docs-only PR pattern) or as the B1 commit boundary inside the feature branch
   (branch-first). If the file exists, pull a one-line scope from its first heading or `description:`
   frontmatter for Step 6. If missing, set scope to the Phase/scope column text and flag for
   `/abra-kdabra` follow-up.

4. **Predecessor check** — resolve every `plan-MMM` reference in the row's Trigger column against the
   Done log. If any predecessor is not DONE, STOP and list what blocks.

5. **Compute slug + sync main + create branch**:
   - Slug auto-derive (preferred): take the Phase/scope column, strip parentheticals, lowercase,
     kebab-case (e.g. `LLM provider migration` becomes `llm-provider-migration`).
   - Fallback: if the column is empty or ambiguous, ask the user for the slug.
   - Branch name: `feat/plan-NNN-<slug>` (the `plan-NNN` token is load-bearing — the close-phase
     frontmatter flip globs on it).

   ```bash
   git checkout main
   git pull --ff-only origin main          # STOP if not fast-forward
   git checkout -b feat/plan-NNN-<slug>
   ```

6. **Update WORK_COORDINATION.md — file-level channel only** — three mutations, all in one edit:
   - `Last updated:` line — `YYYY-MM-DD by <owner> (Track <X> OPENED — plan-NNN claimed)`
   - **Active tracks** table — append row:
     `| <X> | <owner> | feat/plan-NNN-<slug> | plan-NNN | IN PROGRESS YYYY-MM-DD — <one-line scope> | YYYY-MM-DD | <eta> |`.
     `<X>` = next free letter from column 1.
   - **Conflict zones** table — two modes:
     - Plan file EXISTS: append rows for files declared in the plan's `## Files I touch` /
       `## Scope guard` section. Owner column: `<owner> (Track <X> plan-NNN) — <one-line purpose>`.
     - Plan file MISSING: SKIP the conflict-zones append and output a note: conflict zones are added
       when `/abra-kdabra` authors plan-NNN, or manually as boundaries land.
   - Never touch other coordination channels (contract-level, security-review) — track-claim is
     file-level only.

7. **Show diff + ask confirm** — `git diff --color WORK_COORDINATION.md`, then `[y/N]`. On no, revert
   via `git checkout -- WORK_COORDINATION.md` and exit.

8. **Commit + push** (single confirm covers both):
   ```bash
   git add WORK_COORDINATION.md
   git commit -m "docs(coord): WORK_COORDINATION Track <X> OPEN — plan-NNN <slug>

Reviewed: skip (docs-only coordination claim)
"
   git push -u origin feat/plan-NNN-<slug>
   ```

9. **Output** — branch name + commit hash + next-step hint:
   - Plan file exists: ready to start plan-NNN boundaries (TDD + `/chekpoint` per boundary).
   - Plan file missing: branch ready; run `/abra-kdabra` now to author plan-NNN (+ ADR if
     architectural). The plan file ships as the B1 commit boundary; conflict zones backfill on the
     same commit.

### Failure modes

| Mode | Recovery |
|---|---|
| Untracked WIP on main | STOP. List files. Operator stashes/commits before retry. |
| Open PR pending merge | STOP. Operator merges or closes pending PRs first. |
| Predecessor not closed | STOP. List blocking plans. |
| Plan-NNN row missing from Next planned | STOP. Operator adds the row manually first. |
| Plan-NNN already DONE in Next planned | STOP. Already shipped. Pick a different plan. |
| Slug auto-derive ambiguous | Ask operator interactively. |
| `main` not fast-forward | STOP. Never auto-rebase main. Operator investigates upstream. |
| `WORK_COORDINATION.md` missing at repo root | STOP. Instantiate the template first (see First use). |

## /sprint close — ship a plan

Run when all boundary commits for the current plan are pushed and ready to merge.

### Flags

- `--manual-merge` — force manual merge in the browser (override auto-merge eligibility). For
  11th-hour visual confirmation, e.g. high-stakes production deploys.
- `--partial "<state-description>"` — the PHASE B plan-frontmatter mutation flips to `in_progress` +
  sets `partial_state: "<state-description>"` instead of the default `completed` flip. Use when the
  plan shipped some boundaries but defers runtime steps to a future operator action. Ignored when the
  branch does not match `feat/plan-NNN-*` (chore branches have no plan to flip).

### Steps

1. **Detect PR state**:
   ```bash
   gh pr list --head feat/plan-NNN-<slug> --state all --json state,number,mergeCommit
   ```
   - Not found / OPEN — run PHASE A (create or refresh the PR).
   - MERGED — run PHASE B (post-merge sync).
   - CLOSED without merge — STOP. Manual investigation needed.

### PHASE A — open the PR

1. **Boundary footer audit** — `git log main..HEAD --pretty=format:'%h %s%n%b%n---'`. Every commit
   must contain a `Reviewed: <full|lite|skip>` footer. If any is missing, STOP, list the offending
   hashes, and tell the operator to retroactively `/chekpoint` them.

2. **Verification gate** — invoke the harness `verification-loop` skill (the project standard for the
   per-PR gate); it resolves to the project's build + typecheck + test + lint stack (TypeScript:
   `npm run build` + `npx vitest run` + lint; Python: `pytest` + `mypy` diff-scoped + `ruff`). STOP at
   the first failure. This skill does NOT call `/chekpoint` — that is the per-commit gate, already run
   during boundaries.

3. **Parallel-PR conflict check**:
   ```bash
   gh pr list --state open --json number,headRefName,author
   ```
   For each PR by another author, `gh pr view <num> --json files` and compute file overlap with
   `git diff main..HEAD --name-only`. If overlap > 0: print the recommended merge order (smaller diff
   first if docs-only, else older PR first), open the parallel PR via `gh pr view <num> --web`, and
   STOP. Operator merges the parallel PR first, then re-runs `/sprint close`.

4. **Assemble PR body** — heredoc-inlined skeleton:
   ```markdown
   ## Summary
   <scope + branch + commit count + test delta + Next-planned reference>

   ADRs/plans: <grep ADR-NNN, plan-NNN from commit messages>

   ## Boundaries
   <for each commit (git log main..HEAD --reverse): boundary letter + short hash + scope + first paragraph + Reviewed tier>

   ## /chekpoint discipline
   Footers: <N> full + <N> lite + <N> skip across <total> boundaries.

   ## Test plan
   - [x] verification-loop green (build + typecheck + tests + lint)
   - [x] All boundaries ship with an explicit Reviewed: footer
   - [ ] WORK_COORDINATION Track <X> flips to DONE on merge
   ```
   Compute the test delta from the runner's collected count on main vs HEAD (cache the main count to
   avoid re-running).

5. **Show preview + confirm `[y/N]`**.

6. **Create PR** — `gh pr create --title "<conventional-commit-style title>" --body "$(cat <<'EOF' ... EOF)"`.

7. **Auto-merge eligibility check** — gate-driven decision tree.

   AUTO-MERGE (default) when ALL conditions hold:
   - `--manual-merge` flag NOT set (operator opt-out)
   - All boundary commits carry an explicit `Reviewed: <tier>` footer (Step 1 already verified)
   - For each boundary with `Reviewed: skip`, the skip rationale contains `docs-only`, `config`,
     `coordination`, or explicit deferral language. A plain `Reviewed: skip` on production code
     without deferral text makes the PR ineligible.
   - Verification gate (Step 2) passed.
   - Parallel-PR conflict check (Step 3) found no overlap.
   - Branch-protection probe: `gh repo view --json branchProtectionRules` — if main requires approving
     reviews or has pending required status checks, fall back to `gh pr merge --auto` (waits for CI)
     instead of immediate merge.

   MANUAL-MERGE (fallback) when ANY condition fails. Output the PR URL + instruction to merge in the
   browser, then re-run `/sprint close` for PHASE B sync.

   Auto-merge command (when eligible):
   ```bash
   gh pr merge <num> --squash --delete-branch
   ```
   Wait for merge confirmation — poll `gh pr view <num> --json state,mergeCommit` until
   `state=MERGED` and `mergeCommit.oid` is non-null. Timeout 60s; fall back to manual if exceeded.

8. **Output** — auto-merge path: confirmation + merge commit hash + transition to PHASE B inline.
   Manual path: PR URL + re-run instruction.

### PHASE B — post-merge sync

Triggered automatically inline after a PHASE A auto-merge, or on re-invocation when state-detect shows
MERGED (manual-merge path).

1. **Verify merge** — `gh pr view <num> --json state,mergeCommit` must show MERGED + non-null
   `mergeCommit.oid`. Else STOP.

2. **Sync main + cleanup branch**:
   ```bash
   git checkout main
   git pull --ff-only origin main
   git branch -d feat/plan-NNN-<slug>     # -d not -D (refuses unmerged, safety net)
   git remote prune origin
   ```

3. **Update WORK_COORDINATION.md — file-level channel only** — five mutations:
   - `Last updated:` — `YYYY-MM-DD by <owner> (Track <X> DONE — plan-NNN merged via PR #<num>)`
   - **Active tracks** row for `<X>` — flip Status to
     `DONE YYYY-MM-DD — <commit-count> commits, tests <prev>-><new>, PR #<num>`. Branch column to `(closed)`.
   - **Done log** — prepend:
     `- YYYY-MM-DD DONE **plan-NNN <slug>** — <1-2 sentence summary>. (<owner>, branch feat/plan-NNN-<slug>, PR #<num> -> <merge-hash-short>). Tests <prev>-><new> (+<delta>).`
   - **Next planned** row for plan-NNN — flip Trigger to `DONE YYYY-MM-DD`. For each successor whose
     trigger contained `After plan-NNN`, change to `UNLOCKED` (preserve other conditions).
   - **Conflict zones** rows owned by us — set Owner to `(closed) — was <owner> Track <X> plan-NNN`.
     Keep the rows for retro audit.

4. **Update plan frontmatter** — fires only when the branch matches `feat/plan-NNN-*`. Chore branches
   (`chore/*`) skip this step with a stdout note.

   Locate the plan file at `docs/plans/plan-NNN-*.md` via shell glob. Zero or multiple matches fall to
   the Failure modes table — the operator owns the disambiguation.

   Apply ONE mutation, on YAML frontmatter only — never the plan body:
   - Default (no `--partial`): replace the `status:` value with `completed`; insert
     `completed_at: YYYY-MM-DD` below it when not already present. Already `completed` +
     `completed_at` present = idempotent no-op with a stdout note.
   - With `--partial "<text>"`: replace `status:` with `in_progress`; set
     `partial_state: "<text>"` (replace an existing line or insert). The text comes verbatim from the
     flag — the skill never composes it.

   Never overwrite a manually edited `completed_at:` value.

5. **Show diff + confirm `[y/N]`** — single confirm covers ALL staged files. On no, revert every
   staged path via `git checkout --` and exit.

6. **Commit + push to main** — the only place the skill writes to main directly (post-upstream-merge
   bookkeeping; the PR already passed the PHASE A eligibility gate).

   ```bash
   git add WORK_COORDINATION.md docs/plans/plan-NNN-<slug>.md   # plan file omitted when Step 4 skipped
   git commit -m "docs(coord): WORK_COORDINATION Track <X> DONE — plan-NNN merged + frontmatter status flip

Reviewed: skip (docs-only post-merge close + plan frontmatter status sync)
"
   git push origin main
   ```
   When Step 4 was skipped, drop the frontmatter clauses from the subject and footer.

7. **Output** — confirmation, merge commit hash, list of plans now UNLOCKED in Next planned, and a
   one-line summary of the plan frontmatter delta.

### Failure modes

| Mode | Recovery |
|---|---|
| Boundary footer missing | STOP. Operator runs retroactive `/chekpoint` on offending commits. |
| Verification gate fails | STOP. Operator fixes the failure first. |
| Push rejected during sync | STOP. `git fetch && git rebase origin/main`, then retry with `--force-with-lease` only. |
| PR exists but CLOSED without merge | STOP. Manual investigation. |
| Successor unlock parse error | WARN. Show the diff anyway. Operator hand-edits + re-runs. |
| Step 4 plan glob = 0 matches | WARN + skip the mutation; the rest continues on a WORK_COORDINATION-only diff. |
| Step 4 plan glob = 2+ matches | STOP. Print every matching path; operator disambiguates. |
| Step 4 frontmatter malformed | STOP. Print the frontmatter as found; the operator hand-fixes. The skill never invents a `status:` line. |
| `--partial` without text | STOP. Partial-ship reasons are operator domain knowledge. |

## Anti-patterns the skill must NEVER do

1. Never auto-commit without an operator `[y/N]`. One confirm per write phase covers commit + push.
2. Never `git push --force`. Only `--force-with-lease`.
3. Never push to main directly EXCEPT the PHASE B post-merge close commit.
4. Never edit `WORK_COORDINATION.md` without an atomic commit + push.
5. Never invent a plan slug or branch name silently. The Next planned row MUST exist (no_context rule).
6. Never auto-merge a PR unless ALL PHASE A eligibility conditions hold. The operator can opt out per
   invocation with `--manual-merge`.
7. Never bypass the `Reviewed:` footer audit.
8. Never rebase main itself.
9. Never edit the project's `BACKLOG.md` from this skill — that file is operator-curated. The skill
   stays in its lane: track lifecycle + plan frontmatter.
10. Never claim a track that already shows another owner — re-read Active tracks after `git pull`,
    STOP on conflict.
11. Never overwrite a manually edited `completed_at:` value in plan frontmatter.
12. Never compose a `partial_state:` description automatically.

## Reused harness primitives

- **`verification-loop`** skill — the PHASE A pre-PR gate; resolves the per-project verify stack.
- **`Reviewed: <tier>` footer convention** — `.claude/rules/common/development-workflow.md` +
  `git-workflow.md`. Audited at the boundary footer check.
- **Plan frontmatter `status:` + `completed_at:` + `partial_state:` contract** — PHASE B Step 4
  mutates only these three fields.
- **`gh pr create` heredoc pattern** — preserves markdown formatting.

## See also

- `WORK_COORDINATION.template.md` (same directory) — instantiate at repo root on first use.
- `/abra-kdabra` — authors plan files + ADRs. Both orders work: plan-first (docs-only PR, then
  `/sprint` claims) or branch-first (`/sprint` claims, then `/abra-kdabra` authors as B1).
- `/chekpoint` — the per-commit gate. The Reviewed-footer audit confirms each boundary ran it.
