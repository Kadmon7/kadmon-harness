---
number: 16
title: Skavenger slim refactor — Route D removal + C→B rename + A expansion
date: 2026-04-19
status: accepted
route: A
plan: plan-016-skavenger-slim-refactor.md
supersedes_partial: ADR-015-skavenger-ultimate-researcher.md
---

# ADR-016: Skavenger slim refactor — Route D removal + C→B rename + A expansion

> **Deciders**: Ych-Kadmon (architect), arkitect (agent).
> **Implementation Status**: Proposed 2026-04-19. Partial supersede of ADR-015 (Route D only). Konstruct drafts plan-016 next.

## Status

Proposed — 2026-04-19. **Partial supersede of ADR-015 (Route D section only).** ADR-009 (original deep-research capability), ADR-014 (agent rename), and ADR-015 Groups A, B, and D (docs, depth, archive, forge loop) remain authoritative. ADR-015's 7 depth modes (`--continue`, `--plan`, `--verify`, `--drill`, `--history`, `--verify-citations`, bare) are preserved verbatim. ADR-015 stays in the tree; this ADR replaces only the "Route D — GitHub" decision and renames the surviving routes.

## Context

ADR-015 shipped skavenger ULTIMATE on 2026-04-17 with three routes (A=YouTube, C=General, D=GitHub) and 12 features across documentation, depth, breadth, and integration. Two days later, the empirical state tells a different story than the build:

- **Invocations to date**: exactly one. `docs/research/research-001-pgvector-hnsw-vs-ivfflat-2026-q2.md` is the sole artifact in the archive. That one invocation went through Route C.
- **Route D usage**: zero. The user confirmed `gh` CLI covers ad-hoc GitHub research directly (`gh api repos/owner/repo/issues` is a one-liner) and Route D's structured wrapper adds no observed value.
- **Code weight**: `scripts/lib/github-research.ts` carries 449 LOC of production code plus `tests/lib/github-research.test.ts` at 455 LOC (18 test cases) against zero real invocations. `.claude/agents/skavenger.md:60-82` dedicates ~23 lines of prompt surface to Route D; `.claude/commands/skavenger.md` carries ~20 lines of Route D routing and quota guidance.
- **Naming smell**: removing D leaves the route set as `{A, C}`. The `B` gap was created deliberately on 2026-04-17 when Route B (PDF/arXiv) was consolidated into Route C preprocessing (ADR-015 line 58). With D gone, the gap is no longer semantically meaningful — it is just confusing.
- **Underused capability**: Route A matches YouTube only, yet `yt-dlp` (the backing tool) supports 1000+ sites out of the box including Vimeo, SoundCloud, Twitch VODs, Twitter/X videos, TikTok, Archive.org, Dailymotion, and podcast RSS feeds. Route A's regex gate throws away almost the entire tool surface.

Three coupled signals: dead code in D, a naming gap A→C, an under-leveraged tool in A. Committing them separately fragments a single narrative into three tiny ADRs, each with its own plan round, each reviewing a sliver of the same surface. This ADR bundles them.

### Current state anchored to files

- `.claude/agents/skavenger.md` — 351 lines. Route A spec at `:38-52`, Route C at `:54-58`, Route D at `:60-82`. Tools surface: `Task, Read, Grep, Glob, Bash, WebSearch, WebFetch`.
- `.claude/commands/skavenger.md` — dispatches to skavenger with 6 flags wired; Route D routing logic embedded in the command's Phase 2 dispatch.
- `scripts/lib/github-research.ts` — 449 LOC. Wraps `gh api` with injectable `GhRunner`, rate-limit reporting, auth detection, 5 content kinds.
- `tests/lib/github-research.test.ts` — 455 LOC, 18 test cases. Part of the 60-file Vitest suite (627 tests passing).
- `scripts/lib/youtube-transcript.ts:27-28` — `YOUTUBE_URL_RE = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/`. Tight YouTube-only gate.
- `docs/research/research-001-...md` — the one existing report. Frontmatter route value is documented in ADR-015's F1 schema (`route: general` or similar); plan-016 must verify the exact field name against the existing report.

## Decision

Execute a single coordinated 3-part refactor as one plan (plan-016), one PR, one review window:

### Part 1 — Remove Route D

Delete Route D and its supporting infrastructure:

- Delete `scripts/lib/github-research.ts` (449 LOC).
- Delete `tests/lib/github-research.test.ts` (455 LOC, 18 tests). Post-delete test count: 627 → 609 passing, 60 → 59 files.
- Remove the Route D spec block from `.claude/agents/skavenger.md:60-82` (~23 lines) and the classifier branch at `:38` that distinguishes GitHub URLs.
- Remove Route D routing and quota guidance from `.claude/commands/skavenger.md` (~20 lines).
- Remove "Route D" references from `.claude/rules/common/development-workflow.md` `/skavenger` row.

Ad-hoc GitHub research is henceforth a direct `gh api ...` invocation by the user or skavenger inside Route B (general). No structured wrapper, no routing branch.

### Part 2 — Rename Route C → Route B

With D gone, `{A, C}` is the live route set. Rename C to B everywhere in the **live** agent and command specs:

- `.claude/agents/skavenger.md` — all "Route C" occurrences become "Route B". Step 1 header, PDF/arXiv preprocessing note, parallelization exclusion list, Example 1 header, and any inline cross-references.
- `.claude/commands/skavenger.md` — same rename in Phase 2 dispatch and any narrative references.
- `CLAUDE.md` — `/skavenger` row in the command reference gets a one-line update.
- `.claude/rules/common/development-workflow.md` — same.

**Append-only docs are NOT touched.** ADR-009, ADR-014, ADR-015, and plan-015 all continue to say "Route C" in their narrative — that is historically accurate (C was the name when those documents shipped). ADR-016 documents the lineage: the post-ADR-016 route set is `{A, B}`; prior ADRs describing `{A, C, D}` remain correct for their respective dates.

### Part 3 — Widen Route A to multi-site

Expand Route A's regex gate from YouTube-only to the broader `yt-dlp` surface:

- Rebrand: "Route A — YouTube" → "Route A — Media".
- New regex set covers: YouTube (preserved verbatim), Vimeo (`vimeo.com/\d+`), SoundCloud (`soundcloud.com/[^/]+/[^/]+`), Twitch clips and VODs (`clips.twitch.tv/`, `twitch.tv/videos/`), Twitter/X videos (`(?:twitter|x)\.com/[^/]+/status/\d+`), TikTok (`tiktok.com/@[^/]+/video/\d+`), Archive.org (`archive.org/details/`), Dailymotion (`dailymotion.com/video/`), podcast RSS feeds (content-type check, not regex — deferred to konstruct's call during plan-016).
- Regex composition: one alternation union with the YouTube branch first (preserves existing behavior as the primary case).
- Exact regex set, anchor rules, and edge-case handling (query strings, trailing slashes, `m.` mobile subdomains) are konstruct's call during plan-016. This ADR fixes the widening decision and the capability set, not the regex literal.
- **YouTube-is-protected invariant**: the new regex must match every URL the old regex matched. plan-016's test suite must include all current YouTube test fixtures verbatim as a non-regression gate. If the new regex is narrower than the old one for YouTube, the refactor is rolled back.
- **yt-dlp failure fallback preserved**: the current behavior when yt-dlp exits non-zero or produces no VTT (fall back to `WebFetch` on the video URL, note in Methodology) stays intact. This is the single contract that makes the widening safe: a matched-but-unsupported URL degrades to WebFetch, not to a hard error. `scripts/lib/youtube-transcript.ts` already implements this for YouTube; Route A's widening does not change the helper's error surface.

### Out of decision scope

Konstruct decides during plan-016:

- The exact final regex literal for Route A's expanded gate.
- The commit sequence (likely: Part 1 first as deletion, then Part 2 as rename, then Part 3 as expansion — but konstruct owns ordering).
- Any helper-rename inside `scripts/lib/youtube-transcript.ts` (e.g., file rename to `media-transcript.ts` or keeping the current name). The file's public API does not change; the rename is cosmetic.
- Whether to add test cases for each new Route A site, or rely on integration coverage.
- The cheat sheet `docs/research/README.md` content (a konstruct deliverable for plan-016, not an ADR-016 artifact).

The 7 depth modes (`--continue`, `--plan`, `--verify`, `--drill`, `--history`, `--verify-citations`, bare) remain exactly as ADR-015 shipped them. The persist-research-report pipeline (`PERSIST_REPORT_INPUT` HTML comment, `research_reports` SQLite table, `docs/research/research-NNN-<slug>.md` auto-write, `KADMON_RESEARCH_AUTOWRITE=off` escape hatch) is untouched. Report frontmatter, report body shape, and DB schema are unchanged. Only the routing metadata inside reports changes: reports generated under Route C become Route B; the `route` field in frontmatter (if it exists under that name) maps old `C` → new `B`. Existing `docs/research/research-001-...md` is not edited.

## Alternatives Considered

### Alternative 1: Keep all 3 routes, add documentation only

Write a cheat sheet at `docs/research/README.md` surfacing the 7 depth modes and the 3 routes. Zero code removal. Zero renames. Zero expansion.

- Pros: minimal blast radius, preserves optionality for future Route D adoption, no risk of regressing a working case.
- Cons: 904 LOC (449 production + 455 test) of dead code accumulates entropy; every `/skanner` and `/medik` run still inspects it; agent prompt surface stays 500-600 lines; the naming asymmetry `{A, C, D}` confuses future readers; Route A's capability cliff stays hidden.
- Why not: documentation cannot fix a code smell. The feedback memory `feedback_no_half_done.md` says "close status drift same day plan ships" — the symmetric rule is "remove unused infrastructure same week usage data confirms zero". Two days of zero usage against 904 LOC is data; ignoring it produces documentation of the wrong reality.

### Alternative 2: Remove Route D only

Delete `github-research.ts` and its tests. Leave the route naming as `{A, C}`. Leave Route A's regex as YouTube-only.

- Pros: smallest correction, lowest risk, highest revertibility — one well-scoped commit.
- Cons: leaves the naming gap A→C visible to every future reader without explanation (requires a footnote ADR-016-addendum later); misses the opportunity to act on Route A's underused capability while the surface is already open; produces two shallow ADRs instead of one complete one.
- Why not: the three signals are coupled by the same surface — skavenger's routing specification. Editing that surface three times across three PRs is wasteful; editing it once captures the coherent story. The user philosophy (CLAUDE.md "Working Style") prefers principled reasoning over pragmatic slicing, and the principled story is "skavenger's routing was over-engineered and under-leveraged; rebalance both at once".

### Alternative 3 (chosen): Coordinated 3-part refactor

Remove D + rename C→B + widen A as one plan, one PR.

- Pros: maximal coherence — the narrative writes itself; -820 LOC net; clearer routing mental model (`A=Media`, `B=General`); Route A's capability expanded to many more URLs at approximately zero cost; test suite shrinks from 60 files to 59 reducing CI time; ADR append-only contract preserved (ADR-015 stays, ADR-016 documents the pivot); single review window.
- Cons: touches more files than Alternative 2; requires a careful smoke test to confirm YouTube non-regression (the one working case); Route A widening may surface yt-dlp edge cases for less-tested sites (mitigation: WebFetch fallback, already present); renames inside live files can produce noisy diff hunks mixed with semantic changes.
- Why chosen: cohesion wins when the surface is small enough to hold in one mental model — skavenger is one 351-line agent file plus one command file plus one lib file. The refactor is mechanical once the decisions are fixed, and the YAGNI debt is explicit in the data (1 invocation, 0 Route D, 1000+ untapped yt-dlp sites).

### Alternative 4: Remove D + rewrite skavenger from scratch

Delete everything, restart with a minimal Route B-only agent and port back what is needed.

- Pros: ultimate clean slate; opportunity to rethink the 7 depth modes from first principles; no legacy constraints.
- Cons: discards plan-015's working implementation (Groups A, B, D already proven in the one invocation); 90% of the rewritten code would be re-creation of current behavior; review surface explodes from "slim refactor" to "new agent design"; invalidates the one existing report's route metadata.
- Why not: ADR-015 shipped two days ago and its non-D features are working as designed. A rewrite is a solution to a different problem.

**Chosen: Alternative 3.** Matches the coupled nature of the three signals, minimizes net effort, preserves working surface, and produces a coherent narrative for future readers.

## Consequences

### Positive

- **Net -820 LOC.** `scripts/lib/github-research.ts` (449) + `tests/lib/github-research.test.ts` (455) removed; Route D spec in agent (~35) and command (~20) removed; ~10 lines added for Route A regex expansion and the Route A rename. Rough math: -(449+455+35+20) + 10 = -949 + 10 + ~80 additional prose retouches = ~ -820 net.
- **Clearer routing mental model.** `A = Media` (yt-dlp-backed, multi-site) and `B = General` (WebSearch + WebFetch, includes PDF/arXiv preprocessing). Two routes named by capability, not by URL shape — better mental handle than three routes where one was named by repo hosting.
- **Route A capability expanded ~50x URL space at ~zero cost.** yt-dlp already ships with every site's extractor; the widening is a regex change, not a new integration.
- **Test suite shrinks from 60 files to 59.** Faster CI, less maintenance. The 18 Route D tests were proving capabilities nobody invokes.
- **Agent prompt shrinks.** `skavenger.md` projected from 351 to ~310 lines after the refactor. Well inside the <400 normal budget documented in `CLAUDE.md`.
- **ADR-015's extension seam preserved.** The 7 depth modes, the archive, the forge loop, the frontmatter schema, and the escape hatch all survive unchanged. Users who adopted `--continue`, `--plan`, `--verify`, etc. over the next 9 days lose nothing.

### Negative

- **Ad-hoc GitHub research loses structural support.** Anyone needing issues/PRs/README/CHANGELOG content now runs `gh api repos/owner/repo/issues` directly. That is explicitly the user's preference today, but if the usage pattern shifts (e.g., a later task wants batch GitHub synthesis), Route D would need to be resurrected. Mitigation: `github-research.ts` remains recoverable from git history; the 18 tests also reconstructable. Reintroduction cost is one plan round, not a rewrite.
- **Route A widening may surface yt-dlp edge cases for non-YouTube sites.** Some sites have DRM-protected streams, some expose subtitles only in non-English, some embed player URLs that don't match the regex. Mitigation: the WebFetch fallback already in place for YouTube transcript failures covers these cases — a matched-but-unsupported URL degrades to metadata-only via WebFetch, not to a hard error. plan-016 smoke test must exercise at least one non-YouTube Route A URL.
- **Renames inside live files produce mixed diff hunks.** Commit 2 (C→B rename) in plan-016 will touch several narrative blocks in the agent file. Reviewers must confirm no semantic content changes inside those blocks — only the letter C → B. Mitigation: commit split discipline; konstruct orders Part 2 as a pure rename commit separate from Part 3's expansion commit.
- **One ADR's Route D section becomes historically-only-correct.** ADR-015's F8 narrative remains accurate for 2026-04-17 state; ADR-016 is the pointer forward. Readers navigating the decision chain must read both. This is the append-only ADR trade-off and is acceptable under this repo's convention.

### Neutral

- The 7 depth modes stay. User may or may not adopt them based on downstream cheat-sheet visibility (that cheat sheet is a plan-016 artifact, not ADR-016's concern).
- The persist-research-report pipeline, frontmatter schema, DB table, and escape hatch are unchanged. Existing `research-001-...md` is not edited; its route metadata remains whatever ADR-015's F1 schema named it.
- Table count in DB stays at 7. No migration.

### Risks

- **R1 — Route A regex regression on YouTube.** A bad alternation could miss a YouTube URL the old regex matched (e.g., playlists with `&list=` params). Mitigation: plan-016 must include every YouTube test fixture from current coverage as a non-regression gate. Go/no-go: all existing YouTube tests pass on the widened regex.
- **R2 — yt-dlp fails on a new Route A site.** Some yt-dlp extractors are fragile or rate-limited per site. Mitigation: the existing WebFetch fallback is preserved; a Route A URL that yt-dlp cannot transcribe degrades gracefully to metadata. plan-016 smoke test exercises at least one non-YouTube URL to prove the fallback path runs end-to-end.
- **R3 — Stale Route D references surface later.** Grep for "Route D", "github-research", "Route C" across the repo may miss occurrences in prose or comments. Mitigation: plan-016 final commit includes a pre-merge grep verification — zero matches for "github-research", zero matches for "Route D" outside of ADR-009/014/015 (append-only docs keep their prose). Route C references outside append-only docs also zero-match.
- **R4 — Agent tool surface shrinkage.** Route D was the only consumer of the `gh` CLI inside skavenger's own workflow. Removing D does not remove tools (Bash stays for yt-dlp, Task stays for F9 parallelization), so no `tools:` frontmatter edit is strictly required. Mitigation: plan-016 confirms `tools:` list is unchanged.
- **R5 — Documentation drift across ADRs.** Readers landing on ADR-015 may not realize ADR-016 exists. Mitigation: ADR-015's frontmatter stays as-is (append-only), but doks should cross-link ADR-016 in the ADR index at next `/doks` pass. Not a plan-016 gate — doks cadence handles it.

### Rollback

- **Per-part rollback:** each of Parts 1/2/3 maps to one commit in plan-016. `git revert` on the Part 1 commit restores `github-research.ts` and its tests. `git revert` on Part 2 restores "Route C" naming. `git revert` on Part 3 narrows Route A back to YouTube-only.
- **Full rollback:** three reverts return the harness to ADR-015 shipped state. No DB changes, no data migration.
- **Recovery path:** `github-research.ts` lives in git history at all commits before the Part 1 revert — grep `git log --oneline --all -- scripts/lib/github-research.ts` to find the SHA, then `git show <sha>:scripts/lib/github-research.ts > scripts/lib/github-research.ts` if reinstatement is ever needed.

## Supersede Rationale

ADR-015 is partially superseded, not fully, because its 12 features split cleanly into surviving (A, B, D groups: docs, depth, archive, forge loop) and replaced (C group: one of three breadth features — Route D).

**Preserved from ADR-015 (still authoritative):**
- Group A — F1 auto-doc, F2 mandatory Open Questions, F3 `--continue`, F4 `--drill`
- Group B — F5 `--plan`, F6 `--verify`, F7 self-evaluation pass
- Group C — F9 parallelization via Task tool, F10 source diversity enforcement
- Group D — F11 SQLite archive, F12 `/forge` integration
- Q1-Q5 architectural decisions (forge consumer, FTS5 fallback, session-scoped continuation, file size budget, untrusted-sources frontmatter flag)
- Escape hatch `KADMON_RESEARCH_AUTOWRITE=off`

**Replaced by ADR-016:**
- Group C — F8 Route D (GitHub). Entire feature removed.

Route naming (`A, C, D` → `A, B`) is a consequential rename driven by the F8 removal, not an independent decision. Route A widening (YouTube → Media) is a capability expansion inside a route whose regex was already part of ADR-015's implementation surface but whose scope was not fixed by ADR-015's text.

**Why partial, not full.** ADR-015's architectural core (frontmatter schema, DB table, forge loop, escape hatch, Q1-Q5) is load-bearing for every remaining feature. Full supersede would force readers of Q2 (FTS5 fallback) or Q5 (untrusted content) to chase the rationale through a redirect. Partial supersede matches the ADR-012 → ADR-013 precedent in this repo (see ADR-013's Supersede Rationale section).

**Why not amend ADR-015 in place.** Append-only convention (feedback memory `feedback_no_half_done.md`, doks workflow). ADR-015 is committed and reflects what was true on 2026-04-17. Editing it to retroactively remove Route D would break the audit trail — future readers deserve to see both the ambition that shipped and the pivot that followed.

## Non-goals

- **Reintroducing Route B as a dedicated PDF/arXiv branch.** PDF/arXiv preprocessing stays inline in Route B (formerly C) per ADR-015's 2026-04-17 consolidation. If usage data later supports a dedicated branch, that is a future ADR.
- **Replacing `github-research.ts` with a lighter wrapper.** No wrapper. Ad-hoc `gh api` invocations are the contract.
- **Changing the 7 depth modes.** `--continue`, `--plan`, `--verify`, `--drill`, `--history`, `--verify-citations`, and bare invocation all stay exactly as ADR-015 shipped them.
- **Editing `docs/research/research-001-...md`.** The existing report is immutable user-generated content.
- **Migrating the DB schema.** `research_reports` table is unchanged. No column added, no column removed.
- **Writing the `docs/research/README.md` cheat sheet.** That is a plan-016 deliverable, not an ADR-016 artifact.
- **Updating append-only docs.** ADR-009, ADR-014, ADR-015, plan-015 all stay as-is. Route C in their prose is historically correct for their dates.

## Checklist Verification

- [x] **Requirements documented.** Three parts listed with exact scope: delete two files + trim ~55 lines of spec (Part 1); rename C→B in live files, skip append-only docs (Part 2); widen Route A regex to yt-dlp multi-site with YouTube non-regression invariant (Part 3).
- [x] **Alternatives evaluated.** Four alternatives examined: docs-only, D-only, coordinated 3-part (chosen), full rewrite.
- [x] **Evidence anchored.** Cited `.claude/agents/skavenger.md:60-82` for Route D block, `scripts/lib/github-research.ts:449 LOC`, `tests/lib/github-research.test.ts:455 LOC`, `docs/research/research-001-pgvector-hnsw-vs-ivfflat-2026-q2.md` as sole existing report, `scripts/lib/youtube-transcript.ts:27-28` for current YouTube regex, ADR-015:58 for Route B consolidation history.
- [x] **Data model specified.** No schema changes. `research_reports` table unchanged. Report frontmatter shape unchanged. Route metadata inside reports: C → B mapping.
- [x] **Component responsibilities.** skavenger agent: classifier loses Route D branch, gains broader Route A regex. `/skavenger` command: loses Route D routing. `github-research.ts`: deleted. `youtube-transcript.ts`: unchanged public API, possible cosmetic rename (konstruct's call).
- [x] **Error handling.** Route A widening preserves WebFetch fallback on yt-dlp failure (R2 mitigation). Regression-gated by full YouTube test fixture preservation (R1 mitigation).
- [x] **Testing strategy.** Delete `tests/lib/github-research.test.ts`. Preserve every existing YouTube test fixture for the Route A widening as non-regression gate. plan-016 adds at least one non-YouTube smoke test for Route A. Post-refactor: 627 → 609 tests passing, 60 → 59 files.
- [x] **Migration path.** Three commits, revertible independently. No DB migration. No data transform. `KADMON_RESEARCH_AUTOWRITE=off` escape hatch untouched.
- [x] **Performance.** No hook-latency involvement. Agent prompt shrinks ~40 lines. Test suite runtime decreases by ~1 file's worth.
- [x] **Security.** `github-research.ts` removal eliminates one `execFileSync` surface (the `gh api` wrapper). Route A widening keeps `execFileSync` with argument arrays (yt-dlp invocation pattern unchanged). No new shell interpolation, no new `eval`.
- [x] **Windows compatibility.** yt-dlp CLI cross-platform (unchanged). No new paths. `gh` removal from skavenger's routing reduces Windows-specific CLI surface by one.
- [x] **Observability.** Route metadata in reports shifts C → B going forward; the one existing report keeps its current value. Dashboard research-report count unaffected. `caps_hit[]` frontmatter unchanged.
- [x] **Rollback plan.** Per-part and full-revert paths documented. Recovery path for `github-research.ts` via git history.

## Open Questions (surface for plan-016)

- **Exact Route A regex literal.** konstruct's call during plan-016 based on yt-dlp extractor coverage and repo convention.
- **Rename `youtube-transcript.ts` → `media-transcript.ts`?** Cosmetic, optional, konstruct's call. Public API unchanged either way.
- **`docs/research/README.md` cheat sheet scope.** plan-016 deliverable.
- **When to backfill ADR-016 reference into ADR-015's frontmatter.** Append-only says never; doks index update at next `/doks` pass is the path.

## References

- ADR-009 — Deep research capability (original). Chain-rule closure over `deep-research` skill. Extension seam for Perplexity Fase 2.
- ADR-014 — kerka → skavenger rename. Identity invariant preserved.
- ADR-015 — Skavenger ULTIMATE. Partially superseded by ADR-016 (Route D only).
- ADR-013 — Skills subdirectory structure. Referenced as the precedent for partial supersede pattern.
- plan-015 — Implementation of ADR-015. Remains historically accurate for 2026-04-17 state.
- plan-016 — Forthcoming. konstruct's implementation plan for this ADR.

## Review date

**2026-07-19** — three months. Criteria for the review: (a) did any user ask for Route D back, or did `gh api` remain sufficient? (b) did Route A widening surface yt-dlp edge cases that needed additional fallback logic? (c) did the `{A, B}` naming hold, or did a new route emerge? (d) did the ~820 LOC reduction stay reduced, or did helpers drift back in?
