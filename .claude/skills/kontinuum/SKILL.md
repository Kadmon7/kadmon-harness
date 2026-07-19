---
name: kontinuum
description: >-
  Freeze the task list and project state to disk when a session ends, and thaw it back
  when the next one starts — the cryo-mirror of /kompact. /kompact compacts the context
  window *within* one session (you stay, its summary lives on in-thread); kontinuum crosses a
  hard session boundary — a /exit into a brand-new session in a fresh process, where the
  conversation thread breaks and an on-disk note is the only channel that survives. One
  trigger, two modes auto-detected by whether SESSION-HANDOFF.md exists at the repo root:
  FREEZE / SAVE (write the note on the way out, anchored to the exact commit sha) or
  THAW / RESTORE (git pull --ff-only FIRST, print a drift report of what landed while the
  session was frozen, reconcile WORK_COORDINATION.md claims when the repo has one, re-pin
  the OPEN tasks, print the summary, delete the note only once the restore succeeded).
  Use this skill whenever the user is about
  to /exit and start a new session, or says "kontinuum", "freeze the session", "congela la
  sesion antes de salir", "handoff", "puente de sesion", "guarda la tasklist antes de
  salir", "re-pin the task list", "thaw", "descongela / restaura el handoff", "deja nota pa
  la proxima sesion", or otherwise asks to carry the task list and project state across a
  session boundary. Do NOT use it for /kompact — that is intra-session context compaction
  whose summary survives in-thread and needs no file.
requires_tools:
  - TaskList
  - TaskGet
  - TaskCreate
  - TaskUpdate
  - Read
  - Write
  - Bash
  - Glob
---

# kontinuum

Freeze the task list and project state on the way out of a session, thaw it on the way in.
kontinuum is the cryo-mirror of `/kompact`: where `/kompact` compacts the context window *within*
one session — you stay, and its summary lives on in the same thread — kontinuum crosses a hard
boundary. A `/exit` into a fresh session severs the thread entirely; the only state that
survives is what you froze to disk. kontinuum writes that frozen note on exit and thaws it on the
next start.

Time passes while the note sits on disk. Teammates merge, main moves, live processes die. So the
note is anchored to the exact commit sha at freeze, and THAW's first act is to re-sync with
origin and compute a **drift report** — what happened to the repo while the session slept. A
thaw that skips this is thawing into the past.

## Why a file, not the session-start hook

The harness `session-start` hook already carries a *heuristic* summary forward from SQLite.
kontinuum is the *explicit, curated* channel: the exact task list in the user's current order,
with status, plus a hand-written project summary. It exists because "what I was in the middle
of" is worth stating deliberately, not re-deriving from observations.

## One trigger, two modes

Detect the mode by whether `SESSION-HANDOFF.md` exists at the repo root (Glob for it, or a
Bash `test -f`). Presence of the frozen note means a previous session left state to thaw.

- **No `SESSION-HANDOFF.md`** → FREEZE / SAVE (you are on the way out).
- **`SESSION-HANDOFF.md` exists** → THAW / RESTORE (you are on the way in).

State which mode you detected before acting, so the user can course-correct.

## FREEZE mode (write-on-exit)

1. Read the live task list with `TaskList` (and `TaskGet` for any task whose detail is not
   obvious from the subject).
2. Read `WORK.md` for in-flight context the Task system does not capture (unreleased state,
   forks, blockers, "next up").
3. Anchor the freeze to git state:

   ```bash
   git rev-parse --abbrev-ref HEAD && git rev-parse HEAD && git status --porcelain
   ```

   Record branch + full sha in the Project summary (`Frozen at: main @ <sha>`). The sha is the
   drift anchor THAW diffs against — without it the next session cannot tell what changed while
   frozen. If the working tree is dirty, list every dirty file in the note: uncommitted changes
   survive on disk but not in anyone's context, and an unexplained diff at thaw reads as a
   parallel-session artifact.
4. Write `SESSION-HANDOFF.md` at the repo root with three sections:
   - **Task list** — every task in current order, with status. Keep the completed ones too, but
     mark the section so the next session knows they are CONTEXT ("shipped last session"), not
     work to re-pin — THAW re-creates only the open ones.
   - **Project summary** — the `Frozen at:` anchor, working-tree state, test count, component
     counts, next milestone / blocker, unreleased state, forks. Enough that the next session is
     oriented without opening five files. Label every claim about a live process (a dev server,
     a tunnel, a deployed site, a watcher) as **volatile — re-verify at thaw**: those claims
     describe a moment, and the moment ends when the laptop sleeps.
   - **Restore steps** — the literal steps THAW mode will follow (including the pull + drift
     report), so the note is self-describing even if this skill later changes.
5. Ensure the note stays out of git without touching the shared `.gitignore`:

   ```bash
   git check-ignore -q SESSION-HANDOFF.md || echo "SESSION-HANDOFF.md" >> .git/info/exclude
   ```

   `.git/info/exclude` is repo-local and never committed, so the guardrail costs nothing.
6. Tell the user the state is frozen and they can `/exit` now.

Do not commit the note. It is a single-use frozen block — untracked, ignored, deleted on
thaw. Committing it would leave stale task state in git history.

## THAW mode (read-on-start)

1. Read `SESSION-HANDOFF.md`.
2. Re-sync with origin BEFORE trusting anything in the note:

   ```bash
   git pull --ff-only
   ```

   - Fast-forward or already up to date → continue.
   - Refuses (divergence) → STOP and surface it: local commits or a history rewrite need the
     human before tasks are re-pinned against the wrong base.
   - No upstream / offline → say so and continue; the note is still valid, just unverifiable
     against origin.
3. Compute the drift report — the frozen sha vs post-pull HEAD:

   ```bash
   git log --oneline <frozen-sha>..HEAD
   ```

   Zero commits → say "main did not move while frozen" and move on. N commits → print them and
   name which summary claims they may invalidate (test counts, merged PRs, contract shapes).
   The note describes the repo as it WAS; the drift report is what happened since.
4. Reconcile coordination state (when the repo has a `WORK_COORDINATION.md`): re-read the
   Active tracks and Next planned tables AFTER the pull and report anything newer than the
   freeze date — a teammate claiming a track or merging one while the session slept is exactly
   what this catches. Report only; claiming tracks is `/sprint`'s lane, not kontinuum's.
5. Re-create the OPEN tasks via `TaskCreate` in the same order — pending and in-progress only.
   Do **not** re-create the completed ones as tasks; report them in the summary as "shipped last
   session" instead. Completed rows exist to tell you what already landed, and a task list that
   reopens sixteen finished items every thaw buries the live work under its own history. The
   permanent record of what shipped lives in `git log`, the changelog, and the project's status
   docs — not in the task list, whose job is what is still moving.
6. Re-establish any blocked-by dependencies noted in the file (e.g. "task #5 blocked by #4")
   with `TaskUpdate addBlockedBy`. The note's numbering is its own; map it onto the new task IDs
   rather than assuming they match.
7. Print the project summary from the note together with the drift report, so the new session
   opens with the last session's orientation AND what changed underneath it. Claims the note
   labeled volatile are UNVERIFIED at thaw — re-check them (run the project's status tooling if
   the note names one) before repeating any of them as current fact.
8. Delete `SESSION-HANDOFF.md` — but only once the restore actually succeeded. The note is the
   sole surviving copy of that task list, so deleting it is the last step, not a cleanup you
   perform in parallel:

   - Tasks re-pinned and the summary printed → `rm SESSION-HANDOFF.md` (or `git rm` if somehow
     tracked). Leaving it would make the next FREEZE believe frozen state already exists.
   - Restore was PARTIAL or failed (Task tools unavailable, an error mid-way, anything you could
     not finish) → **keep the note**, say plainly that it was kept and why, and hand the user the
     unrestored items. Deleting an unrestored handoff destroys the only record of the work.
   - The deletion is DENIED (a permission gate, a classifier, a hook) → stop and tell the user the
     note is still on disk and needs their go. A denial is a missing precondition, not an obstacle
     to route around: reaching for `git clean`, a different shell, or any second path to the same
     deletion turns a safety gate into a speed bump. Ask; the note is harmless where it sits.

## Guardrails

- The note filename is exactly `SESSION-HANDOFF.md` at the repo root. Do not scatter variants
  — mode detection depends on that one path.
- If the user is compacting *within* the session (staying in the same thread), this is the
  wrong tool — point them at `/kompact`. The tell: they are not exiting the process.
- If THAW finds the task list already populated (a session that never fully cleared), reconcile
  rather than blindly duplicate — surface the overlap and ask.
- Never skip the pull + drift report because "it was only a day". The cost is one command; the
  failure mode is a session confidently working against a main that no longer exists.
- The frozen sha is load-bearing. An old note without a `Frozen at:` anchor means drift is
  unknowable — say so, and treat every summary claim as unverified rather than pretending the
  drift report ran.
- The note outranks convenience at every step. Keep it when the restore is partial, keep it when
  a deletion is denied, and never reach for a second tool to delete what the first one refused.
