---
name: kryo
description: >-
  Freeze the task list and project state to disk when a session ends, and thaw it back
  when the next one starts — the cryo-mirror of /kompact. /kompact compacts the context
  window *within* one session (you stay, its summary lives on in-thread); kryo crosses a
  hard session boundary — a /exit into a brand-new session in a fresh process, where the
  conversation thread breaks and an on-disk note is the only channel that survives. One
  trigger, two modes auto-detected by whether SESSION-HANDOFF.md exists at the repo root:
  FREEZE / SAVE (write the note on the way out) or THAW / RESTORE (re-pin the tasks, print
  the summary, delete the note). Use this skill whenever the user is about to /exit and
  start a new session, or says "kryo", "freeze the session", "congela la sesion antes de
  salir", "handoff", "puente de sesion", "guarda la tasklist antes de salir", "re-pin the
  task list", "thaw", "descongela / restaura el handoff", "deja nota pa la proxima sesion",
  or otherwise asks to carry the task list and project state across a session boundary. Do
  NOT use it for /kompact — that is intra-session context compaction whose summary survives
  in-thread and needs no file.
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

# kryo

Freeze the task list and project state on the way out of a session, thaw it on the way in.
kryo is the cryo-mirror of `/kompact`: where `/kompact` compacts the context window *within*
one session — you stay, and its summary lives on in the same thread — kryo crosses a hard
boundary. A `/exit` into a fresh session severs the thread entirely; the only state that
survives is what you froze to disk. kryo writes that frozen note on exit and thaws it on the
next start.

## Why a file, not the session-start hook

The harness `session-start` hook already carries a *heuristic* summary forward from SQLite.
kryo is the *explicit, curated* channel: the exact task list in the user's current order,
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
3. Write `SESSION-HANDOFF.md` at the repo root with three sections:
   - **Task list** — every task in current order, with status. Keep completed tasks too; they
     tell the next session what already shipped.
   - **Project summary** — branch, working-tree state, test count, component counts, next
     milestone / blocker, unreleased state, forks. Enough that the next session is oriented
     without opening five files.
   - **Restore steps** — the literal steps THAW mode will follow, so the note is
     self-describing even if this skill later changes.
4. Tell the user the state is frozen and they can `/exit` now.

Do not commit the note. It is a single-use frozen block — untracked, gitignored, deleted on
thaw. Committing it would leave stale task state in git history.

## THAW mode (read-on-start)

1. Read `SESSION-HANDOFF.md`.
2. Re-create every task via `TaskCreate` in the same order. For tasks marked completed, create
   them then set status completed with `TaskUpdate` — completed ones are context, not work to
   redo.
3. Re-establish any blocked-by dependencies noted in the file (e.g. "task #5 blocked by #4")
   with `TaskUpdate addBlockedBy`.
4. Print the project summary from the note to the user, so the new session opens with the same
   orientation the last one closed with.
5. Delete `SESSION-HANDOFF.md` (`Bash rm`, or `git rm` if somehow tracked). It has thawed;
   leaving it would make the next FREEZE believe frozen state already exists.

## Guardrails

- The note filename is exactly `SESSION-HANDOFF.md` at the repo root. Do not scatter variants
  — mode detection depends on that one path.
- If the user is compacting *within* the session (staying in the same thread), this is the
  wrong tool — point them at `/kompact`. The tell: they are not exiting the process.
- If THAW finds the task list already populated (a session that never fully cleared), reconcile
  rather than blindly duplicate — surface the overlap and ask.
