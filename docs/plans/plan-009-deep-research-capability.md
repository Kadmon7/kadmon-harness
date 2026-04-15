---
number: 9
title: Deep research capability — kerka agent and /research command
date: 2026-04-14
status: shipped
needs_tdd: true
route: A
adr: ADR-009-deep-research-capability.md
---

# Plan 009: Deep research capability (kerka agent + /research command) [konstruct]

## 1. Context

The harness has an orphaned skill: `.claude/skills/deep-research.md` is a complete multi-source research methodology but no command or agent invokes it. `.claude/rules/common/agents.md:43` falsely catalogs it under almanak, yet `.claude/agents/almanak.md:78` hard-blocks WebSearch/WebFetch because almanak is deliberately narrowed to Context7-only library docs. The routing table is broken in documentation and in absence, which violates the harness chain-rule invariant (every skill must be reachable through a command -> agent -> skill chain). Separately, WebFetch on YouTube URLs returns page HTML, not transcripts, so any research task whose best evidence is a conference talk or tutorial video degrades silently.

ADR-009 selects Route A (custom free): ship a new `kerka` sonnet agent and `/research` command that own the existing `deep-research` skill, plus a small `scripts/lib/youtube-transcript.ts` helper wrapping `yt-dlp` (external CLI, installable via `winget install yt-dlp`). Skill headcount stays at 46 (reuse, not duplicate). almanak is untouched. A commented extension point reserves space for a Fase 2 Perplexity Sonar fallback without implementing it today.

This plan converts ADR-009's D1–D7 decisions into concrete files, TDD steps, and a verification sequence. See ADR-009 for the full alternatives matrix (Routes A–D) and architectural trade-offs; this plan does not relitigate them.

## 2. Architectural References

- `docs/decisions/ADR-009-deep-research-capability.md` — decisions D1–D7, alternatives, trade-offs, follow-ups
- `.claude/skills/deep-research.md` — workflow that kerka loads; only additive edit is the "Execution caps (kerka)" subsection (ADR-009 D3)
- `.claude/agents/almanak.md` — structural template for kerka (security block, memory block, skill reference, workflow steps, no_context rule, output format)
- `.claude/commands/almanak.md` — structural template for `/research` (Direct orchestration, single agent, no preview gate)
- `.claude/rules/common/agents.md` — chain-rule invariant, orchestration patterns table, agent catalog
- `docs/plans/plan-008-evolve-generate-pipeline.md` — format/tone reference for this plan

## 3. Files to Create

| Path | Lines (est.) | Purpose |
|---|---|---|
| `.claude/commands/research.md` | ~45 | Direct orchestration command, frontmatter loads `deep-research` skill, invokes kerka |
| `.claude/agents/kerka.md` | ~160 | Sonnet research agent with WebSearch/WebFetch/Bash/Task, D5 caps, D7 extension point, security block |
| `scripts/lib/youtube-transcript.ts` | ~140 | `fetchYouTubeTranscript()` + `parseVtt()` wrapping `yt-dlp` via `execFileSync` |
| `tests/lib/youtube-transcript.test.ts` | ~110 | 5 Vitest cases: missing yt-dlp, happy path, parseVtt unit, non-YouTube URL reject, empty-VTT fallback |
| `tests/fixtures/stubs/yt-dlp-stub.sh` | ~25 | PATH-shim stub that writes a canned VTT file when invoked (bash, POSIX; wired via `PATH` env in test subprocess) |

## 4. Files to Modify

| Path | Changes |
|---|---|
| `CLAUDE.md` | (1) Agents table header `## Agents (15)` -> `## Agents (16)` ~line 77 + insert `\| kerka \| sonnet \|` row. (2) Commands section `## Commands (11)` -> `## Commands (12)` ~line 96. (3) Add new bullet `- **Research** (1): /research` in the command category list ~line 97–102. (4) `File Structure` block `agents/` count `15` -> `16` and `commands/` count `11` -> `12` ~line 44–46. (5) Status line at ~line 179: bump `15 agents` -> `16 agents`, `11 commands` -> `12 commands`, add Sprint D completion note. |
| `.claude/rules/common/agents.md` | (1) `## Agent Catalog (15)` -> `(16)` + insert `\| kerka \| sonnet \| /research, unfamiliar research topics \| /research \| deep-research \|` row. (2) Remove `deep-research` from almanak's skills column (fix the false catalog entry per ADR-009 Context). (3) Add line under `## Auto-Invoke`: "- User asks to research/investigate/deep-dive/compare/analyze topics beyond current codebase -> kerka (via /research)". (4) Header "### Orchestration Patterns (11 commands)" -> `(12 commands)`. (5) Add `/research  direct (kerka single agent)` row inside the Direct block. (6) Add a line under `## Manual Rules`: "- NEVER invoke kerka without explicit /research command or equivalent research intent" (mirrors alchemik/kartograf discipline). |
| `.claude/rules/common/development-workflow.md` | (1) `## Command Reference (11)` -> `(12)`. (2) Insert new subsection "### Research Phase (1)" with a 1-row table for `/research` between Remember and Evolve phases, purpose "Multi-source deep research — web, YouTube transcripts, PDFs", agent `kerka`. |
| `.claude/settings.json` | Add to `permissions.allow`: `"Bash(yt-dlp:*)"`, `"WebFetch(domain:www.youtube.com)"`, `"WebFetch(domain:youtube.com)"`. No hook registration (no new hooks). |
| `.claude/skills/deep-research.md` | Append new subsection `### Execution caps (kerka)` at the end (after the `## no_context Application` section). Content: the 4 caps from ADR-009 D5 (5 sub-questions, 3 WebSearch per sub-q, 5 WebFetch total, 1 youtube-transcript per URL). Additive only — no existing line modified. |

## 5. Implementation Steps

Sequential TDD order. Dependencies explicit. Sizes: S (trivial one-file change), M (multi-file or nontrivial logic), L (cross-cutting).

### Phase 0: Research (already done via ADR-009)

- [ ] **0.1** Re-read `ADR-009` + this plan before starting implementation. (S)
  - Verify: Claude can restate D1–D7 from memory before editing any file.
  - Depends on: none.

### Phase 1: yt-dlp helper (TDD, foundation)

- [ ] **1.1** Create the yt-dlp PATH-shim stub. Bash script that detects `--print` vs download-subs invocation, writes a canned VTT to the path yt-dlp would use (`<outputTemplate>.en.vtt`), and exits 0. Includes a `STUB_MODE` env switch (`empty`, `success`, `unavailable`) so a single stub covers all test cases. (S)
  - File: `tests/fixtures/stubs/yt-dlp-stub.sh`
  - Verify: `bash tests/fixtures/stubs/yt-dlp-stub.sh --help` exits 0; `STUB_MODE=empty` path produces no VTT; `STUB_MODE=success` writes a 3-cue VTT to `$OUTDIR`.
  - Depends on: none.

- [ ] **1.2 RED** Write `tests/lib/youtube-transcript.test.ts` with 5 Vitest cases (imports only — no implementation yet). Use `describe`/`it`, `execFileSync` with modified PATH pointing to the stub dir, `os.tmpdir()` for working dirs, cleanup in `afterEach`. (M)
  - File: `tests/lib/youtube-transcript.test.ts`
  - Cases:
    1. `parseVtt()` unit test: input = WEBVTT header + NOTE block + 3 cues with `<c>` tags and consecutive duplicates; output = stripped plain text, no timestamps, no tags, no dedupes. Direct function call, no subprocess.
    2. `fetchYouTubeTranscript({ url: "https://www.youtube.com/watch?v=abc123" })` with yt-dlp absent (PATH stripped to empty dir) -> returns `{ ok: false, source: "error", error: /yt-dlp not found/ }` and includes install hint (`winget install yt-dlp`).
    3. `fetchYouTubeTranscript({ url: "https://www.youtube.com/watch?v=abc123&t=42s" })` with stub on PATH (`STUB_MODE=success`) -> returns `{ ok: true, source: "auto-subs", language: "en", text: /.+/ }`; query string `&t=42s` stripped before yt-dlp invocation (assert via stub echo log).
    4. `fetchYouTubeTranscript({ url: "https://example.com/foo" })` -> returns `{ ok: false, error: /not a youtube url/ }` (regex validation, no subprocess spawned).
    5. `fetchYouTubeTranscript({ url: "https://www.youtube.com/watch?v=abc123" })` with `STUB_MODE=empty` (yt-dlp exits 0 but no VTT written) -> returns `{ ok: true, source: "fallback", language: null, text: null }`.
  - Verify: `npx vitest run tests/lib/youtube-transcript.test.ts` — all 5 red (module not found).
  - Depends on: 1.1.

- [ ] **1.3 GREEN** Implement `scripts/lib/youtube-transcript.ts`. (M)
  - File: `scripts/lib/youtube-transcript.ts`
  - Public exports:
    ```ts
    export interface YouTubeTranscriptOk {
      ok: true;
      source: "auto-subs" | "manual" | "fallback";
      language: string | null;
      text: string | null;
      videoId: string;
    }
    export interface YouTubeTranscriptErr {
      ok: false;
      source: "error";
      error: string;
    }
    export type YouTubeTranscriptResult = YouTubeTranscriptOk | YouTubeTranscriptErr;
    export async function fetchYouTubeTranscript(
      opts: { url: string; language?: string; timeoutMs?: number }
    ): Promise<YouTubeTranscriptResult>;
    export function parseVtt(content: string): string;
    ```
  - Main flow:
    1. Validate URL with regex `/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/`. Strip query params past the `v=` value. Return `{ ok:false, source:"error", error:"not a youtube url" }` on failure.
    2. Check `which yt-dlp` (use `execFileSync("which", ["yt-dlp"], { stdio: "pipe" })` on POSIX; fall back to `where yt-dlp` on win32). On ENOENT or non-zero exit, return `{ ok:false, source:"error", error:"yt-dlp not found. Install: winget install yt-dlp" }`.
    3. Create a tempdir in `os.tmpdir()` via `fs.mkdtempSync`. NEVER use a path under the repo.
    4. Spawn via `execFileSync("yt-dlp", [ "--write-auto-sub", "--skip-download", "--sub-format", "vtt", "--sub-langs", "en.*,es.*", "--output", path.join(tempdir, "%(id)s.%(ext)s"), "--socket-timeout", "30", "--no-warnings", url ], { stdio: "pipe", timeout: opts.timeoutMs ?? 60_000 })`. Never `shell: true`. Never string-interpolate `url` into a shell command.
    5. `fs.readdirSync(tempdir)` + pick first `*.vtt` (`en-US.vtt` vs `en.vtt` both acceptable — glob-by-extension, first wins). If none, return `{ ok:true, source:"fallback", language:null, text:null, videoId }`.
    6. Read VTT, detect language from filename suffix (`.en.vtt` -> `"en"`), call `parseVtt(raw)`, return `{ ok:true, source:"auto-subs", language, text, videoId }`.
    7. `finally { fs.rmSync(tempdir, { recursive: true, force: true }); }`.
  - `parseVtt(content: string): string`:
    - Split on `\n`.
    - Drop first line if `WEBVTT`.
    - Drop lines inside `NOTE` blocks (blank-line-terminated).
    - Drop cue timing lines matching `/^\d\d:\d\d:\d\d\.\d{3}\s-->/`.
    - Drop standalone position lines (cue settings after `-->`).
    - Strip inline tags `<c(?:\.[^>]*)?>`, `</c>`, `<\d\d:\d\d:\d\d\.\d{3}>`, `<v [^>]+>`.
    - Trim each line; drop empty.
    - Dedupe consecutive identical lines (auto-sub artifact).
    - Join with `\n`.
  - Error handling: catch `unknown`, narrow via `instanceof Error`; any subprocess error collapses to `{ ok:false, source:"error", error: err.message }`. Never rethrow into the caller.
  - Verify: all Phase 1.2 tests green.
  - Depends on: 1.2.

- [ ] **1.4** Build + run targeted suite. (S)
  - Verify: `npm run build` clean; `npx tsc --noEmit` clean; `npx vitest run tests/lib/youtube-transcript.test.ts` all 5 green.
  - Depends on: 1.3.

### Phase 2: kerka agent

- [ ] **2.1** Create `.claude/agents/kerka.md` matching the almanak structure byte-for-byte in shape (frontmatter, skill reference, security, expertise, workflow, key principles, output format, no_context rule, memory). (M)
  - File: `.claude/agents/kerka.md`
  - Frontmatter (exact):
    ```yaml
    ---
    name: kerka
    description: Use PROACTIVELY when user asks to research, investigate, deep-dive, compare, or analyze any topic beyond the current codebase. Command: /research. Detects YouTube URLs, PDFs, and general queries and synthesizes cited reports.
    model: sonnet
    tools: Read, Grep, Glob, Bash, WebSearch, WebFetch
    memory: project
    skills: deep-research
    ---
    ```
  - Note: ADR-009 D1 specifies `Read, WebSearch, WebFetch, Bash, Task`. This plan narrows to `Read, Grep, Glob, Bash, WebSearch, WebFetch` because: (a) `Task` is not a standard tool name on the existing agent frontmatters audited (verify: `grep -l "tools:.*Task" .claude/agents/`), (b) Grep/Glob support the "local context component" use-case D1 mentions under `Read`, (c) Task-based parallelization remains available via the harness Agent tool at runtime regardless of frontmatter. **TODO at implementation time:** if grep confirms other agents DO use `Task` in frontmatter, add it. If not, proceed with the narrowed set and note the deviation in the commit body.
  - Body sections (in order):
    1. **Agent identity paragraph** — "You are a multi-source deep research specialist. You synthesize cited reports from web search, YouTube transcripts, PDFs, and documentation. You are the chain-rule executor for `deep-research.md` — every claim must trace to a source you actually fetched, never to training data."
    2. **Skill Reference** — one-line pointer to `.claude/skills/deep-research.md`, copying almanak's format.
    3. **Security** — verbatim from `almanak.md:17–23` (prompt-injection defense, untrusted tool output, flag anomalies). Critical because WebFetch on arbitrary domains is high-risk prompt-injection surface.
    4. **Workflow Routing (Step 1)** — detect input type before delegating to the skill:
       - YouTube URL (regex matches) -> Route A: `Bash` invokes a tiny wrapper that runs `npx tsx -e "import('./scripts/lib/youtube-transcript.js').then(...)"` OR direct shell call to a compiled `dist/scripts/lib/youtube-transcript.js`. **TODO** at implementation time: pick the invocation shape that matches existing helper invocation precedent in other agents; if no precedent exists, document in the agent that the caller runs `node dist/scripts/lib/youtube-transcript.js <url>`. The helper currently has NO CLI entry point — if Route A chooses the CLI path, Phase 1.3 must add a `if (require.main === module)` guard or equivalent ESM check. Mark this decision for the implementer.
       - PDF or arxiv URL -> Route B: WebFetch direct, fall back to extracting abstract if full text fails.
       - General query -> Route C: load `deep-research.md` skill and execute Steps 2–6 of that skill's workflow.
    5. **Premium Mode extension point (commented)** — verbatim per ADR-009 D7:
       ```md
       <!--
         Fase 2 extension point (not implemented in ADR-009/plan-009):
         if (process.env.PERPLEXITY_API_KEY && flags.premium) {
           // call Perplexity Sonar API, return answer+citations, skip Step 2-4
         }
         See ADR-009 "Follow-ups" and CLAUDE.md /research command.
       -->
       ```
    6. **Execution caps** — table of the 4 caps from ADR-009 D5, plus: "Each cap is prompt-enforced. If you are about to exceed one, stop and return partial results with an explicit `caps_hit` note in the output footer." Mirrors almanak's "Call Limit" section style.
    7. **no_context Rule** — kerka is the evidence-based-claim enforcer outside library docs. Every claim must cite a fetched source. When sources conflict, present both sides. When data is insufficient, say so — do NOT fall back to training data.
    8. **Output Format** — markdown block with sections: TL;DR, Executive Summary, Themes (numbered), Key Takeaways, Sources (numbered list with URLs), Methodology (search count, fetch count, transcript count), optional `caps_hit` footer. Tagged `[kerka]` in the header.
    9. **Memory** — verbatim from almanak's memory block, swapping `almanak` -> `kerka`. Memory file path: `.claude/agent-memory/kerka/MEMORY.md`.
  - Verify: file parses, frontmatter lints, `agent-metadata-sync` hook fires on save and updates CLAUDE.md + agents.md catalog rows automatically (Sprint B Q8 hook). If hook does NOT auto-sync (unexpected), revert to manual edits in Step 3.x.
  - Depends on: 1.4.

### Phase 3: /research command

- [ ] **3.1** Create `.claude/commands/research.md`. (S)
  - File: `.claude/commands/research.md`
  - Frontmatter:
    ```yaml
    ---
    description: Multi-source deep research — web, YouTube transcripts, PDFs. Detects input type and synthesizes cited reports.
    agent: kerka
    skills: [deep-research]
    ---
    ```
  - Body sections (mirroring `/almanak`):
    1. **Purpose** — "Invoke kerka to run the deep-research skill's full workflow against web, video, and PDF sources."
    2. **Arguments** — `<query-or-url>`: free-text research topic OR a single URL (YouTube/PDF/arxiv). Multi-URL research supported by separating URLs with spaces.
    3. **Steps** — 4 numbered: (1) invoke kerka with the raw query, (2) kerka routes to A/B/C per its workflow, (3) kerka executes and synthesizes, (4) return cited report to chat. No preview gate, no persistence.
    4. **Output** — inline for short reports (< ~800 lines of chat), otherwise post executive summary + takeaways + sources inline and save full report to a user-confirmed path (NEVER auto-write).
    5. **Examples** — 3 examples matching the 3 E2E cases in Phase 5:
       - `/research current state of pgvector HNSW vs IVFFlat indexing` (general query)
       - `/research https://www.youtube.com/watch?v=abc123` (single YouTube URL)
       - `/research compare ragas vs deepeval for RAG evaluation` (comparison)
  - Verify: frontmatter valid; `agent: kerka` resolves; `skills: [deep-research]` parses as array.
  - Depends on: 2.1.

### Phase 4: Catalog + config updates

Steps 4.1–4.5 may run in parallel — no inter-dependencies.

- [ ] **4.1** Edit `CLAUDE.md` — 5 changes per Section 4 table. Read the file first; use unique anchor lines to avoid ambiguous Edits. (S)
  - File: `CLAUDE.md`
  - Verify: `grep -c "kerka" CLAUDE.md` >= 2 (agents table + status line); `grep "Commands (12)" CLAUDE.md` matches.
  - Depends on: 2.1 (kerka exists).

- [ ] **4.2** Edit `.claude/rules/common/agents.md` — 6 changes per Section 4 table. (S)
  - File: `.claude/rules/common/agents.md`
  - Verify: `grep -c "kerka" .claude/rules/common/agents.md` >= 3 (catalog row, auto-invoke line, manual rule, orchestration pattern); `grep "Agent Catalog (16)"` matches; almanak's skill column no longer contains `deep-research`.
  - Depends on: 2.1.

- [ ] **4.3** Edit `.claude/rules/common/development-workflow.md` — command count + new Research Phase subsection. (S)
  - File: `.claude/rules/common/development-workflow.md`
  - Verify: `grep "Command Reference (12)"` matches; new `### Research Phase (1)` subsection renders with a valid markdown table.
  - Depends on: 3.1.

- [ ] **4.4** Edit `.claude/settings.json` — add 3 permissions entries to `permissions.allow` in correct lexical position (keep alphabetical or follow existing order). (S)
  - File: `.claude/settings.json`
  - Verify: `cat .claude/settings.json | node -e "JSON.parse(require('fs').readFileSync(0,'utf8'))"` parses; `grep "yt-dlp" .claude/settings.json` matches.
  - Depends on: 1.4 (helper shape confirms `yt-dlp:*` is the right permission string).

- [ ] **4.5** Edit `.claude/skills/deep-research.md` — append `### Execution caps (kerka)` subsection at the end. Keep it additive: zero existing lines modified. (S)
  - File: `.claude/skills/deep-research.md`
  - New subsection content:
    ```md
    ### Execution caps (kerka)

    When this skill is executed by the kerka agent via /research, the following
    iteration caps apply (prompt-enforced, see ADR-009 D5):

    - Sub-questions: 5 max
    - WebSearch calls per sub-question: 3 max
    - WebFetch calls total: 5 max
    - youtube-transcript calls per URL: 1 max

    Exceeding a cap: stop and return partial results with a `caps_hit` footer.
    Caps are observable in the final report's Methodology section.
    ```
  - Verify: `tail -20 .claude/skills/deep-research.md` shows new subsection; `git diff .claude/skills/deep-research.md` shows only additions (no deletions, no modifications).
  - Depends on: none (orthogonal to other Phase 4 edits).

### Phase 5: E2E verification (manual)

- [ ] **5.1** Execute 5 E2E cases against the live harness. Each case is a manual invocation of `/research` with observation of routing, cap adherence, and output shape. (M)
  - Case matrix:

    | # | Input | Expected route | Pass criteria |
    |---|---|---|---|
    | 1 | `/research current state of pgvector HNSW vs IVFFlat` | Route C (general, deep-research Steps 2–6) | WebSearch <= 15 total, WebFetch <= 5 total, output has TL;DR + 3+ themes + >= 5 sources + Methodology |
    | 2 | `/research https://www.youtube.com/watch?v=<real-video-id-with-auto-subs>` | Route A (yt-dlp helper) | `source:"auto-subs"`, transcript text non-empty, kerka synthesizes TL;DR from transcript alone, sources list includes the video URL |
    | 3 | `/research compare ragas vs deepeval for RAG evaluation` | Route C (comparison) | Output has side-by-side comparison section, cites both projects' docs, >= 4 sources, Methodology shows distinct sub-questions for each tool |
    | 4 | `/research https://www.youtube.com/watch?v=<private-or-age-gated-video>` | Route A falls back gracefully | `source:"error"` OR `source:"fallback"`, kerka continues and says "transcript unavailable, continuing with title/description only"; does NOT throw |
    | 5 | `/research asdfghjkl nonsense query` | Route C | WebSearch returns low-confidence; kerka explicitly responds `no_context` or "insufficient data found" per Quality Rule 5 of the skill; does NOT hallucinate |
  - Verify: all 5 cases pass their criteria. Record results in the PR body.
  - Depends on: all Phase 4 steps (configs must be live).

### Phase 6: Commit

- [ ] **6.1** Run `/chekpoint full` — this diff touches production TS (`youtube-transcript.ts`), hook-relevant surface (`Bash(yt-dlp:*)` permission), and multi-file catalog sync, so `full` is mandatory (not `lite`, not `skip`). Expected reviewers: ts-reviewer, spektr (for `execFileSync` + external CLI surface), kody consolidation. (M)
  - Verify: `npm run build` clean; `npx tsc --noEmit` clean; `npx vitest run` full suite green (549 + 5 new = 554 expected); lint clean; spektr has no CRITICAL/HIGH findings on the helper's argument-array construction.
  - Depends on: Phase 5 complete.

- [ ] **6.2** Commit with conventional format. (S)
  - Message:
    ```
    feat(research): add kerka agent and /research command for deep multi-source research

    Closes the chain-rule violation on deep-research.md skill: creates kerka
    (sonnet, K-prefix) and /research (Direct orchestration) so the skill has
    a real executor. Adds scripts/lib/youtube-transcript.ts wrapping yt-dlp
    for video transcription (Windows: winget install yt-dlp). almanak
    untouched. Skill headcount unchanged (46). Agent count 15 -> 16.
    Command count 11 -> 12.

    See ADR-009 and plan-009-deep-research-capability.md.

    Reviewed: full
    ```
  - Verify: `git log -1` shows conventional format + `Reviewed: full` footer.
  - Depends on: 6.1.

## 6. Test Plan (Vitest)

Phase 1.2 defines 5 cases in `tests/lib/youtube-transcript.test.ts`:

1. **`parseVtt()` unit** — direct function call with a canned VTT string containing WEBVTT header, NOTE block, 3 cues with `<c>` tags, and 2 consecutive duplicate lines. Expected output: 3 stripped non-duplicate lines joined by `\n`. No subprocess.
2. **yt-dlp not in PATH** — `execFileSync` subprocess with `env: { PATH: "/nonexistent" }` to simulate missing CLI. Expected: `{ ok:false, source:"error", error: /yt-dlp not found/ }` + install hint string `winget install yt-dlp`.
3. **Valid URL + stub yt-dlp** — `env: { PATH: "<repo>/tests/fixtures/stubs", STUB_MODE: "success" }`. Expected: `{ ok:true, source:"auto-subs", language:"en", text: /non-empty/ }`. Also asserts `&t=42s` was stripped from URL before yt-dlp invocation (stub logs the received URL).
4. **Non-YouTube URL** — direct call `fetchYouTubeTranscript({ url: "https://example.com/foo" })`. Expected: `{ ok:false, source:"error", error:/not a youtube url/ }` with ZERO subprocess spawn (verified by stub NOT being called — stub writes a marker file if invoked).
5. **yt-dlp exits 0 but no VTT** — `STUB_MODE: "empty"`. Expected: `{ ok:true, source:"fallback", language:null, text:null, videoId:"abc123" }`.

No other test files created. kerka agent and `/research` command are markdown — they pass `no-context-guard` + `post-edit-typecheck` (no-op on .md) and do not need Vitest coverage. Agent quality is validated in Phase 5 E2E + a follow-up `/akademy` session (out of scope for this plan).

## 7. E2E Verification (manual, post-implementation)

See Phase 5.1 matrix above. 5 cases. Run by the user with real credentials/network after Phase 4 ships. Record results in the PR body before merging to main.

## 8. Risks & Mitigations

- **Risk: yt-dlp missing on the machine running `/research`.** ADR-009 D4 accepts this as a per-machine install step. Mitigation: Phase 1 test case 2 locks down graceful degradation — kerka continues with other sources, returns a `caps_hit`-style diagnostic, and never throws. Bootstrap script (plan-003) should document `yt-dlp` alongside `gh` and `git`.
- **Risk: video has no auto-subs, or YouTube blocks unauthenticated yt-dlp.** Mitigation: `source:"fallback"` branch returns empty text with `ok:true`, so kerka can continue synthesis from title + description + other sources.
- **Risk: iteration caps leak because they are prompt-enforced.** ADR-009 accepts this explicitly. Mitigation: caps are observable in kerka's output Methodology + `caps_hit` footer; cost-tracker telemetry on `/research` events provides early warning; caps can be promoted to mechanical guards inside `youtube-transcript.ts` and a future WebFetch counter helper if abuse is seen.
- **Risk: prompt injection via WebFetch on arbitrary domains.** This is the biggest security surface added by Route A. Mitigation: kerka's Security block (copied from almanak) explicitly disables instruction-following on fetched content; spektr reviews the diff in `/chekpoint full`; output format requires citations (injected instructions would not match the citation pattern and would stick out in review).
- **Risk: VTT edge cases break `parseVtt`.** Regional subtitle formats (`.en-US.vtt` vs `.en.vtt`), styled cues, CJK, positional tags. Mitigation: 5 test cases cover the common shapes; fallback branch handles the unknown-format case gracefully; failures here degrade to `source:"fallback"` instead of crashing.
- **Risk: `Task` frontmatter tool name does not match harness convention.** ADR-009 D1 names it; this plan narrows to `Grep, Glob` instead. Mitigation: Step 2.1 includes a TODO to verify frontmatter precedent at implementation time and correct if needed.
- **Risk: `agent-metadata-sync` hook does not fire for the new kerka file.** The hook was written to detect edits to existing agent files; creating a new one may or may not trigger the sync depending on PostToolUse matcher semantics. Mitigation: Phase 4.1/4.2 manually edit CLAUDE.md + agents.md as a belt-and-braces backstop. If the hook does auto-sync, the manual edits are idempotent no-ops.

## 9. Rollback Plan

Trivial — no DB migrations, no schema changes, no forge/evolve artifact mutations.

**Delete (5 files):**
- `.claude/commands/research.md`
- `.claude/agents/kerka.md`
- `scripts/lib/youtube-transcript.ts`
- `tests/lib/youtube-transcript.test.ts`
- `tests/fixtures/stubs/yt-dlp-stub.sh`

**Revert (5 files, via `git checkout main -- <path>`):**
- `CLAUDE.md`
- `.claude/rules/common/agents.md`
- `.claude/rules/common/development-workflow.md`
- `.claude/settings.json`
- `.claude/skills/deep-research.md`

**Runtime disable (no rollback needed):** remove `yt-dlp` from PATH or skip `/research` invocation. Existing commands are unaffected. `~/.kadmon/kadmon.db` untouched.

## 10. Definition of Done

- [ ] All 5 new files created per Section 3
- [ ] All 5 existing files updated per Section 4
- [ ] 5 Vitest cases in `tests/lib/youtube-transcript.test.ts` green
- [ ] 5 E2E verification cases from Phase 5.1 pass with results recorded in PR body
- [ ] `npm run build` clean
- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` full suite green (554+ tests expected — baseline 549 + 5 new)
- [ ] `/chekpoint full` passes (ts-reviewer, spektr for `execFileSync` + external CLI + WebFetch surface, kody consolidation)
- [ ] Commit landed with `Reviewed: full` footer
- [ ] `CLAUDE.md` shows "16 agents" and "12 commands" in header, File Structure, and Status line — all consistent
- [ ] `grep -r "deep-research" .claude/rules/common/agents.md` shows it under kerka, NOT under almanak
- [ ] `agent-metadata-sync` hook fires on kerka edit (smoke test: tweak kerka's `description:` field — CLAUDE.md row refreshes within 500ms per Sprint B budget)
- [ ] `yt-dlp` is documented as an optional bootstrap dependency (follow-up note for plan-003, out of scope for this plan)

## 11. Complexity total

Phase 0: S
Phase 1: S + M + M + S (1 S + 1 M for RED + 1 M for GREEN + 1 S verify)
Phase 2: M
Phase 3: S
Phase 4: S + S + S + S + S (5 parallelizable edits)
Phase 5: M (manual E2E)
Phase 6: M + S (chekpoint + commit)

Count: **9 S + 5 M + 0 L = 14 steps**

Estimate: 1.5–2 days. Phase 1 is the only code surface; the rest is markdown catalog updates and manual E2E. Risk-adjusted: 2–2.5 days if the `Task`-frontmatter or agent-metadata-sync assumptions need resolution mid-implementation.
