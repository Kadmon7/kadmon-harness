---
number: 16
title: Skavenger slim refactor — Route D removal + C→B rename + A expansion
date: 2026-04-19
status: completed
needs_tdd: false
route: A
adr: ADR-016-skavenger-slim-refactor.md
---

# Plan 016: Skavenger slim refactor [konstruct]

## 1. Summary

Execute ADR-016 as a single coordinated refactor: (1) delete Route D (`github-research.ts` + tests + ~55 spec lines), (2) rename Route C → Route B in live files (skip append-only ADRs/plans), (3) widen Route A regex from YouTube-only to yt-dlp multi-site ("Route A — Media"). Deliverable is mostly deletions + renames + one regex widening — no new feature code. Expected delta: ~−820 LOC net (~−949 from deletes, ~+130 from prose/regex/cheat-sheet). Test suite moves 627 → 609 passing / 60 → 59 files. ADR-015's 7 depth modes, archive, escape hatch, and forge loop are untouched.

`needs_tdd: false` — no new production surface. R1 (YouTube non-regression) is guarded by the **existing** Route A tests in `tests/lib/youtube-transcript.test.ts`: they must still pass against the widened regex. R2 (yt-dlp fallback) is exercised by Step 8's smoke test. feniks is SKIP.

## 2. Architectural References

- `docs/decisions/ADR-016-skavenger-slim-refactor.md` — scope, alternatives, risks R1–R5, rollback matrix, non-goals
- `docs/decisions/ADR-015-skavenger-ultimate-researcher.md` — partially superseded (Route D only); everything else stays authoritative
- `docs/plans/plan-015-skavenger-ultimate-researcher.md` — historical template for commit staging
- `.claude/rules/common/development-workflow.md` — `/chekpoint` tier matrix (production `scripts/lib/` change → **full**)
- `.claude/rules/common/agents.md` — skavenger row confirms `tools:` contract (no change required)
- `docs/insights/README.md` — reference style for the new `docs/research/README.md` cheat sheet (semantic-emoji override, ES-MX tono)

## 3. Preconditions

- [ ] Working tree clean (`git status` empty). Any WIP must be stashed first.
- [ ] On `main`, latest pulled.
- [ ] ADR-016 in `docs/decisions/` and accepted (edit status `proposed → accepted` before commit).
- [ ] `npm run build && npx vitest run && npx tsc --noEmit` green at baseline — 627 tests passing, 60 files.
- [ ] `grep -rn "Route C\|Route D\|github-research" .claude/ scripts/ CLAUDE.md` baseline captured for before/after delta.

## 4. Files Affected

| Path | Action | LOC delta |
|---|---|---|
| `scripts/lib/github-research.ts` | **Delete** | −449 |
| `tests/lib/github-research.test.ts` | **Delete** (18 tests) | −455 |
| `.claude/agents/skavenger.md` | Edit: trim Route D block (~60–82), rename C→B (step-1 header, example 1, parallelization exclusion list, diversity note, `--continue` fallback line, MODE header mention), widen Route A regex + rebrand to "Media" | ~−30 net |
| `.claude/commands/skavenger.md` | Edit: rename Route C→B in flag doc (line 21), `untrustedSources` comment (153), Example 1 header (218), Example 4 label (274); remove any Route D text (grep first — the main Route D routing in ADR-016 refers to a dispatch branch that may not exist in this file; confirm at step 4 and trim only what's present) | ~−5 to −20 |
| `.claude/rules/common/development-workflow.md:72` | Edit: rewrite `/skavenger` row to drop "GitHub repos (ADR-015 Route D)" and reflect `{A=Media, B=General}` | ~0 |
| `CLAUDE.md:61, 72, 104, 162, 184–185` | Edit: status paragraph (Route D mention), test counts (627→609, 60→59), ADR-015 Groups A–D → Groups A/B/D (C removed) | ~0 |
| `docs/research/README.md` | **Create** cheat sheet (~80 lines, emoji-semantic) | +80 |
| **`scripts/lib/youtube-transcript.ts`** | **Decision: rename to `scripts/lib/media-transcript.ts` — NO** (see §7 Open Q2). Keep filename; only edit the `YOUTUBE_URL_RE` constant and rename it `MEDIA_URL_RE` internally. Public API (`YouTubeTranscriptResult`, exported functions) unchanged to keep blast radius small. | ~+10 |
| `tests/lib/youtube-transcript.test.ts` | Edit only if regex-literal change produces test-ID drift (spot check after Step 1) | ~0 |

## 5. Resolved Open Questions (from ADR-016)

### Q1 — Route A regex literal

**Proposed**:

```
MEDIA_URL_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?v=[\w-]{11}|youtu\.be\/[\w-]{11}|vimeo\.com\/\d+|soundcloud\.com\/[^\/\s]+\/[^\/\s]+|clips\.twitch\.tv\/[^\/\s]+|twitch\.tv\/videos\/\d+|(?:twitter|x)\.com\/[^\/\s]+\/status\/\d+|tiktok\.com\/@[^\/\s]+\/video\/\d+|archive\.org\/details\/[^\/\s]+|dailymotion\.com\/video\/[^\/\s]+)/i
```

Critique of the task-prompt first-pass:

- Missing `m.` mobile subdomain (YouTube mobile shares land as `m.youtube.com`) → fixed with `(?:www\.|m\.)?`.
- YouTube branch must **preserve the existing 11-char video ID capture** so the helper's `extractVideoId()` keeps working. Resolved by keeping `[\w-]{11}` verbatim inside the YouTube alternatives.
- `twitter|x` grouped with `(?:...)` non-capturing to avoid shifting downstream capture indices.
- Non-capturing groups throughout (`(?:...)`) — the helper only needs the full-URL match result; capture-group count stays at **1** (the video ID, for YouTube only).
- Case-insensitive flag `/i` applied because some extractors accept mixed-case hosts.

**Invariant** (R1): every URL matched by the old `YOUTUBE_URL_RE` must still match the new regex. Step 1's verification is to run `tests/lib/youtube-transcript.test.ts` unchanged — a single test failure means the regex is wrong.

**Deferred**: podcast RSS feeds. ADR-016 noted a content-type check rather than a regex. **Not included** — any URL-only gate for RSS would false-positive on non-audio XML. Handle via WebFetch on the RSS URL (Route B) until a real use case emerges.

### Q2 — Rename `youtube-transcript.ts` → `media-transcript.ts`?

**Recommendation: NO**. Rationale: public API (`YouTubeTranscriptResult`, `YouTubeTranscriptOk/Err`) would need to rename too, which leaks into `.claude/agents/skavenger.md`'s Bash invocation example, test imports, and any skill references. The file name is cosmetic; the regex change and the agent-level rebrand "Route A — Media" carry the semantic shift. Keep filename stable → diff stays in the agent spec where the decision lives. Revisit at the ADR-016 review date (2026-07-19).

### Q3 — Cheat sheet scope

**Recommendation: focused**. `docs/research/README.md` covers: (a) 2-line purpose of the folder, (b) route table (🎙️ A=Media / 🌐 B=General), (c) 7-modes table (bare / --continue / --plan / --verify / --drill / --history / --verify-citations), (d) 3-5 quick patterns ("I want to...", mirroring the insights README's tono). Target ~80 lines. Do NOT duplicate frontmatter schema (lives in plan-015 + ADR-015). Do NOT write archival policy (live-forever is already implicit; one line suffices).

### Q4 — Commit ordering

**Recommendation: single commit**. Rationale: the three parts are one coherent diff; splitting into three commits produces three review windows on the same file set (agent spec edited in each one) which inflates reviewer load without reducing risk. Rollback remains clean via `git revert` of the single SHA — ADR-016's "per-part rollback" language is preserved by documenting the intra-commit hunks, not by enforcing a commit boundary. /chekpoint **full** tier applies regardless.

Exception: if step 8 smoke test fails AND the failure is isolated to one Part, split before commit.

## 6. Step-by-step Plan

All steps assume Git Bash on Windows with Unix syntax. Every step has a verification clause. Steps run sequentially unless marked parallel-safe.

---

### Step 1 — Widen Route A regex in helper (S)

- File: `scripts/lib/youtube-transcript.ts`
- Action: replace `YOUTUBE_URL_RE` constant (lines 27–28) with `MEDIA_URL_RE` literal from §5 Q1. Update the single in-file reference in `extractVideoId()` (line 31). The helper's intent stays "extract an 11-char video ID IF the URL is YouTube; for non-YouTube matches the match succeeds but `extractVideoId()` returns `null`". Export the constant as `MEDIA_URL_RE` for test reuse; if the agent spec currently shows `YOUTUBE_URL_RE`, leave a **deprecated alias export** `export { MEDIA_URL_RE as YOUTUBE_URL_RE }` for one release window (removable at ADR-016 review).
- Verify: `npx vitest run tests/lib/youtube-transcript.test.ts` — all existing YouTube cases pass (R1 non-regression gate). If any fail, the regex is wrong — do not proceed to Step 2.
- Risk: **Medium** (the core R1 risk lives here).
- Depends on: none.

### Step 2 — Rebrand and widen Route A in agent spec (S)

- File: `.claude/agents/skavenger.md`
- Action:
  - Line 38 header: "Route A — YouTube URL" → "Route A — Media URL (yt-dlp)"
  - Line 40: replace embedded regex with a short mention ("matches YouTube, Vimeo, SoundCloud, Twitch, Twitter/X, TikTok, Archive.org, Dailymotion — see `MEDIA_URL_RE` in `scripts/lib/youtube-transcript.ts`")
  - Lines 42–52: update JSON branch narrative from "yt-dlp returned 0 but no VTT was produced (no auto-subs available)" to cover the broader "yt-dlp extractor unsupported OR returned no subtitles" case; the WebFetch fallback text stays identical (R2 contract).
  - Line 132 header: "Route C" → "Route B" + "Example 1: General Query (Route C)" → "Example 1: General Query (Route B)"
  - Line 142 header: "Route A" unchanged (correct), but body example URL can stay (`...watch?v=phuyYL0L7AA`). Consider adding a 1-line `### Example 3: Media URL — Vimeo` if space allows; otherwise skip (reference examples are not load-bearing).
- Verify: `grep -cn "Route C\|Route D" .claude/agents/skavenger.md` returns 0. `grep -c "Route B" .claude/agents/skavenger.md` ≥ 4.
- Risk: Low.
- Depends on: 1.

### Step 3 — Rename Route C → Route B across remaining live files (S)

- Files: `.claude/agents/skavenger.md` (remaining occurrences: 54, 104, 114, 132, 136, 235, 239), `.claude/commands/skavenger.md` (lines 21, 153, 218), `.claude/rules/common/development-workflow.md:72`.
- Action: literal string replace "Route C" → "Route B". Careful with: line 54 header (`**Route C — General Query (default)**`), line 58 ("Route B was consolidated into this preprocessing 2026-04-17" — this is the **original** Route B which was merged into C; rewrite the whole sentence as "PDF/arXiv preprocessing happens inline in this route; the original pre-2026-04-17 Route B was consolidated here.") to avoid two "Route B" meanings colliding.
- Verify: `grep -rn "Route C" .claude/agents .claude/commands .claude/rules CLAUDE.md` returns only append-only-doc mentions (none expected in these paths). `grep -rn "Route C" docs/decisions/ADR-00{9,14,15}*.md docs/plans/plan-015-*.md` unchanged (append-only — must still contain Route C historically).
- Risk: Low.
- Depends on: 2.

### Step 4 — Trim Route D spec from agent and command (S)

- Files: `.claude/agents/skavenger.md` (lines 60–82 block, plus inline mentions: 104 "Route D (github-research.ts handles its own fan-out)" → remove the whole Route D clause from the "Don't parallelize when" list, 114 "Exception: Route D — one `github.com/owner/name` = one domain" → remove the exception), `.claude/commands/skavenger.md` (grep for "Route D", "github-research", "gh:"; remove any surviving mentions — first confirm they exist with Grep before editing).
- Verify: `grep -rn "Route D\|github-research\|gh:" .claude/agents/skavenger.md .claude/commands/skavenger.md` returns 0 matches. `grep -rn "Route D" docs/decisions/ADR-015*.md` unchanged (append-only).
- Risk: Low. Caveat: the Route D removal in the diversity table exception means any future `github.com/*` URL ingested by Route B counts as one domain per standard diversity rules — that is the intended behavior per ADR-016.
- Depends on: 3.

### Step 5 — Delete `github-research.ts` and its tests (M)

- Files: `scripts/lib/github-research.ts` (delete), `tests/lib/github-research.test.ts` (delete).
- Action:
  ```
  rm scripts/lib/github-research.ts
  rm tests/lib/github-research.test.ts
  ```
- Verify:
  - `npm run build` exits 0.
  - `npx tsc --noEmit` exits 0 (no dangling imports anywhere in the tree — grep first: `grep -rn "github-research" scripts/ tests/ .claude/` must return 0).
  - `npx vitest run` — test count drops exactly 18 (from 627 to 609), file count drops exactly 1 (60 → 59). Any other delta is a surprise and blocks the step.
- Risk: Low (deletion is deterministic; only risk is dangling import which grep catches).
- Depends on: 4 (trim spec first, then delete implementation — avoids an intermediate state where the agent spec references a deleted file).
- Rollback: `git restore --source=HEAD --staged --worktree scripts/lib/github-research.ts tests/lib/github-research.test.ts` or `git revert <this-commit-SHA>` post-commit.

### Step 6 — Create `docs/research/README.md` cheat sheet (S)

- File: `docs/research/README.md` (new)
- Action: write ~80-line cheat sheet in the same semantic-emoji + ES-MX tono as `docs/insights/README.md`. Skeleton:

  ```markdown
  # 🔬 docs/research/

  Archivo de reportes `/skavenger` — investigación multi-source con citas, auto-escrita a este folder como artefacto de primera clase (mismo patrón que ADRs y plans).

  ## 🎯 Cuándo usar /skavenger
  [3 bullets: síntesis con citas, cross-source, re-entrable via --continue/--drill]

  ## 🛣️ Rutas (2)

  | Ruta | Emoji | Input | Backing |
  |---|---|---|---|
  | A — Media | 🎙️ | URLs de YouTube/Vimeo/SoundCloud/Twitch/Twitter/X/TikTok/Archive.org/Dailymotion | yt-dlp |
  | B — General | 🌐 | Texto libre, PDFs, arXiv, mezcla | WebSearch + WebFetch |

  ## 🎚️ Modos (7)

  | Modo | Flag | Propósito |
  |---|---|---|
  | Normal | (bare) | Research completo con auto-write |
  | Continue | --continue | Extiende el último reporte de la sesión |
  | Plan | --plan <topic> | Dry-run: propone sub-preguntas, cero fetch |
  | Verify | --verify <hypothesis> | Pro/contra tagging |
  | Drill | --drill <N> | Expande open question N del último reporte |
  | History | --history <query> | Busca en el archivo |
  | Verify-citations | --verify-citations <N> | Re-valida URLs del reporte N |

  ## 🧪 Quick patterns

  [4-5 "quiero hacer X → corre Y" patterns]

  ## 📜 Convenciones

  [Numbering, naming, escape hatch env var, policy]
  ```

- Verify: file exists, renders in VS Code without broken tables, `wc -l docs/research/README.md` ≤ 100.
- Risk: Low (docs-only).
- Depends on: 3 (rename must be done so the cheat sheet uses "B" not "C").

### Step 7 — Update `CLAUDE.md` (S)

- File: `CLAUDE.md`
- Action:
  - Line 104: `--premium` / Groups A-D → Groups A, B, D (Group C removed per ADR-016).
  - Line 184–185 status paragraph: change "ADR-015 shipped 2026-04-17 (skavenger ULTIMATE researcher — ...)" → append "; ADR-016 shipped 2026-04-19 (skavenger slim refactor — Route D removed, Route C→B, Route A widened to multi-site)" and bump test counts: "627 tests passing, 60 test files" → "609 tests passing, 59 test files".
  - Line 162 Memory section: no change (research_reports table still exists, 7 tables unchanged).
  - Line 61 File Structure: no change (`/skavenger` still auto-writes to `docs/research/`).
- Verify: `grep -n "627\|Route D\|Groups A-D" CLAUDE.md` returns 0 matches.
- Risk: Low.
- Depends on: 5 (needs the final test count).

### Step 8 — Update `.claude/rules/common/development-workflow.md` (S)

- File: line 72
- Action: rewrite row to:
  ```
  | /skavenger | Multi-source deep research — web, media transcripts (YouTube/Vimeo/SoundCloud/Twitch/Twitter/X/TikTok/Archive.org/Dailymotion via yt-dlp), PDFs. Two routes: A=Media, B=General. Auto-writes to `docs/research/` unless `KADMON_RESEARCH_AUTOWRITE=off`. Flags (one at a time): `--continue`, `--plan <topic>`, `--verify <hypothesis>`, `--drill <N>`, `--history <query>`, `--verify-citations <N>`. Skavenger spawns sub-agents via `Task` for ≥3 sub-questions (F9); enforces source diversity (F10). `--premium` deferred per ADR-009 Fase 2. | skavenger |
  ```
- Verify: `grep -cn "Route D\|GitHub repos" .claude/rules/common/development-workflow.md` returns 0.
- Risk: Low.
- Depends on: 3.

### Step 9 — Verification loop (M)

- Action: run the full verify pipeline.
  ```
  npm run build
  npx tsc --noEmit
  npx vitest run
  npx tsx scripts/lint-agent-frontmatter.ts
  ```
- Verify: all four exit 0. vitest reports 609 passing / 59 files. Frontmatter linter 16/16.
- Risk: Medium — any failure here reverts the current state to pre-step-1 via `git restore .` and the regex needs revisiting. Do NOT advance to smoke test until green.
- Depends on: 1–8.

### Step 10 — Smoke test: real /skavenger invocation (M)

- Action: in a clean session, run one light topic that should route to the new Route B (to confirm B label appears) AND one light topic with a YouTube URL (to confirm Route A / Media label + existing behavior preserved). Example pair:
  - Route B: `/skavenger minimal useful example of TypeScript decorators 2026` (bare topic, free-text)
  - Route A (YouTube): `/skavenger https://www.youtube.com/watch?v=phuyYL0L7AA` (same URL used in agent spec example 2)
  - **Optional** Route A (non-YouTube, R2 gate): `/skavenger https://vimeo.com/76979871` — exercises the WebFetch fallback path if yt-dlp's Vimeo extractor fails; a matched-but-unsupported URL must degrade to metadata, not a hard error. Skip if cost budget is tight.
- Verify:
  - Reports written to `docs/research/research-00{N,N+1}.md`.
  - Route label in frontmatter/body says "Route B" (not C) and "Route A — Media" (or equivalent) — grep the written files.
  - `grep -rn "Route D\|github-research\|Route C" docs/research/research-00{N,N+1}*.md` returns 0.
  - No crash, no `no_context` surprises, no agent-level error about missing helper.
- Budget: ~$0.30 for 2 invocations; +$0.15 if Vimeo smoke runs. Announce budget to user before running; user may negotiate scope per `feedback_smoke_test_before_merge.md` (do NOT skip existence).
- Risk: Medium — this is the end-to-end R1 + R2 gate. Failure here blocks commit.
- Depends on: 9.

### Step 11 — `/chekpoint full` and commit (M)

- Tier: **full** per `.claude/rules/common/development-workflow.md` (production `scripts/lib/` deleted, multi-file refactor 7+ files, widened regex has security surface). Reviewers: ts-reviewer + spektr + orakle + kody.
- Action:
  - `/chekpoint full`.
  - Consolidate findings. BLOCK findings must be fixed before commit. spektr will inspect the new regex for ReDoS risk (alternation with `[^\/\s]+` is bounded by `/` separator, no nested quantifiers — should pass). orakle should be a NOOP (no SQL). ts-reviewer inspects the deprecated alias export and the agent-spec edits.
  - Commit message:
    ```
    refactor(skavenger): remove Route D, rename C→B, widen A to multi-site

    - Delete scripts/lib/github-research.ts + tests (-904 LOC, -18 tests)
    - Rename Route C → Route B in .claude/agents/skavenger.md, .claude/commands/skavenger.md,
      .claude/rules/common/development-workflow.md (append-only docs untouched)
    - Widen Route A regex from YouTube-only to yt-dlp multi-site (YouTube, Vimeo,
      SoundCloud, Twitch, Twitter/X, TikTok, Archive.org, Dailymotion)
    - Add docs/research/README.md cheat sheet
    - CLAUDE.md: test counts 627→609, files 60→59

    ADR: ADR-016
    Plan: plan-016
    Tests: 609 passing / 59 files
    Reviewed: full
    ```
  - Push.
- Verify: `gh run list -L 1` shows green CI (if CI is wired for this branch). Commit SHA recorded for rollback reference.
- Risk: Medium — full tier gate can surface unexpected BLOCK findings.
- Depends on: 10.

---

## 7. Testing Strategy

| Layer | Coverage |
|---|---|
| Unit (existing) | `tests/lib/youtube-transcript.test.ts` — R1 non-regression gate; every existing YouTube fixture still matches the widened regex |
| Unit (deleted) | `tests/lib/github-research.test.ts` — removed (18 tests, 455 LOC). No replacement — Route D is gone. |
| Integration | Test suite post-refactor: 609 passing / 59 files. Build + typecheck + frontmatter linter all green. |
| E2E / smoke | Step 10 — two live `/skavenger` invocations (Route A + Route B), optional third for R2 Vimeo fallback. Budget ~$0.30–$0.45. Pre-merge gate per `feedback_smoke_test_before_merge.md`. |
| Regression on append-only docs | `grep -c "Route C" docs/decisions/ADR-00{9,14,15}*.md docs/plans/plan-015*.md` must be **unchanged** before and after. Append-only invariant. |

No new unit tests written — ADR-016's scope is "no new feature code". If the Step 10 smoke test surfaces a Route A widening bug, add one targeted regression test at that point (not before).

## 8. Risks & Mitigations

| ID | Risk | Mitigation | Gate step |
|---|---|---|---|
| R1 | Widened Route A regex narrower than old for YouTube | Keep `[\w-]{11}` video ID verbatim in YouTube branch; existing `youtube-transcript.test.ts` is the non-regression gate | Step 1 |
| R2 | yt-dlp fails on a new Route A site (DRM, region, rate-limit) | WebFetch fallback preserved verbatim in agent spec; matched-but-unsupported URLs degrade to metadata, never hard-error | Step 2, Step 10 (Vimeo smoke) |
| R3 | Stale "Route C" / "Route D" / `github-research` strings surface in comments or prose | Pre-commit grep sweep across `.claude/`, `scripts/`, `CLAUDE.md`, `docs/research/` (excluding append-only `docs/decisions/ADR-00{9,14,15}` and `docs/plans/plan-015`) | Steps 3, 4, pre-commit |
| R4 | Deprecated `YOUTUBE_URL_RE` alias export forgotten in cleanup | Note in ADR-016 review checklist (2026-07-19); alias removable with a one-line edit | §6 Step 1 note |
| R5 | Agent `tools:` frontmatter out of sync with actual tool set (Bash stays for yt-dlp, Task for F9 parallelization) | ADR-016 R4: no `tools:` edit required; `lint-agent-frontmatter.ts` (Step 9) validates | Step 9 |
| R6 (new) | Regex has ReDoS via unbounded alternation | Alternation branches all terminate at `/` or `\s` or fixed length; no nested quantifiers; spektr to confirm | Step 11 |
| R7 (new) | Smoke test report writes pollute `docs/research/` with throwaway research | Pre-smoke: note the existing highest report number; post-smoke: verify only 2 (or 3) new reports appeared; keep them as live-forever per policy (reports are first-class artifacts) — or delete specific files if topic was pure noise, but only with user sign-off | Step 10 |

## 9. Rollback Strategy

Per-step:

| Step | Rollback |
|---|---|
| 1 (regex widen) | `git checkout HEAD -- scripts/lib/youtube-transcript.ts` |
| 2–4 (spec edits) | `git checkout HEAD -- .claude/agents/skavenger.md .claude/commands/skavenger.md` |
| 5 (file deletion) | `git show HEAD:scripts/lib/github-research.ts > scripts/lib/github-research.ts && git show HEAD:tests/lib/github-research.test.ts > tests/lib/github-research.test.ts` |
| 6 (cheat sheet) | `rm docs/research/README.md` |
| 7–8 (CLAUDE.md, workflow rule) | `git checkout HEAD -- CLAUDE.md .claude/rules/common/development-workflow.md` |
| 11 (commit) | `git revert <commit-SHA>` — restores all parts atomically since single commit |

Full rollback: `git revert <plan-016-commit-SHA>` returns tree to pre-refactor state. No DB changes, no data migration, no external side effects. `research-001-pgvector-...md` remains untouched throughout (ADR-016 non-goal).

Recovery for `github-research.ts` after merge: `git log --oneline --all -- scripts/lib/github-research.ts` surfaces every SHA where the file existed; `git show <sha>:scripts/lib/github-research.ts > scripts/lib/github-research.ts` restores it. The 18 tests reconstructable the same way.

## 10. Out of Scope

From ADR-016 non-goals (verbatim) and plan-level additions:

- Reintroducing a dedicated PDF/arXiv Route B (stays inline in Route B aka former C).
- Lighter `gh` wrapper replacement for Route D.
- Changes to the 7 depth modes (`--continue`, `--plan`, `--verify`, `--drill`, `--history`, `--verify-citations`, bare).
- Editing `docs/research/research-001-...md`.
- DB schema migration (`research_reports` table unchanged).
- Updating append-only docs (ADR-009, ADR-014, ADR-015, plan-015).
- Podcast RSS detection in Route A regex (deferred — use Route B WebFetch).
- Rename `scripts/lib/youtube-transcript.ts` → `media-transcript.ts` (§5 Q2: NO).
- New unit tests for each widened Route A site (ADR-016 "konstruct's call" — defer to Step 10 smoke + one Vimeo URL; add targeted tests only if a bug surfaces).
- Cross-linking ADR-016 in ADR-015's prose (append-only; doks catches at next `/doks` pass).

## 11. Success Criteria

- [ ] `scripts/lib/github-research.ts` does not exist (Step 5).
- [ ] `tests/lib/github-research.test.ts` does not exist (Step 5).
- [ ] `grep -rn "Route D\|github-research\|gh:" .claude/ scripts/ CLAUDE.md` returns 0 (Step 4).
- [ ] `grep -rn "Route C" .claude/ CLAUDE.md` returns 0; `docs/decisions/ADR-00{9,14,15}*.md` and `docs/plans/plan-015*.md` still contain "Route C" (append-only preserved).
- [ ] `MEDIA_URL_RE` in `scripts/lib/youtube-transcript.ts` matches every URL `YOUTUBE_URL_RE` matched (R1 invariant, Step 1).
- [ ] `docs/research/README.md` exists, ≤100 lines, matches semantic-emoji style (Step 6).
- [ ] `npm run build && npx tsc --noEmit && npx vitest run && npx tsx scripts/lint-agent-frontmatter.ts` all green (Step 9).
- [ ] Test suite: 609 passing / 59 files (Step 9).
- [ ] Step 10 smoke test: 2 reports written, correct Route labels, no crashes.
- [ ] `/chekpoint full` passes — no BLOCK findings (Step 11).
- [ ] Commit lands on `main` with `Reviewed: full` footer and ADR-016 / plan-016 references (Step 11).
- [ ] CLAUDE.md reflects new state (test counts, ADR-016 in status line).
- [ ] ADR-016 status flipped `proposed → accepted` before the refactor commit (or in the same commit).

## 12. Post-merge follow-ups (tracked, not in scope)

- [ ] 2026-07-19 review (ADR-016 review date): remove deprecated `YOUTUBE_URL_RE` alias, revisit `youtube-transcript.ts` rename, check zero-usage of Route D → `gh api` direct pattern still holds.
- [ ] Next `/doks` pass: cross-link ADR-016 in the ADR index; confirm no docs drift against the refactored state.
- [ ] If Step 10 Vimeo smoke skipped for budget, add a Vimeo URL to the next exploratory `/skavenger` run opportunistically and confirm R2 fallback.
