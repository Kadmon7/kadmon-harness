---
number: 9
title: Deep Research Capability (kerka agent + /research command)
date: 2026-04-14
status: accepted
route: A
plan: plan-009-deep-research-capability.md
---

# ADR-009: Deep Research Capability (kerka agent + /research command)

> **Implementation Status:** Decision `accepted` 2026-04-14. Konstruct will follow with `plan-009-deep-research-capability.md` for sequencing and test surfaces. No code written yet.

**Deciders**: Ych-Kadmon (architect), arkitect (agent)

## Context

The harness has a chain-rule invariant codified in `rules/common/agents.md`: every skill must be reachable through a command -> agent -> skill chain so that the skill is actually loaded at runtime, not just cataloged. Auditing the 46-skill headcount against that rule surfaces one clean violation.

**The orphaned skill.** `.claude/skills/deep-research.md` is a complete, executable methodology skill. Its workflow (`deep-research.md:25`+): decompose into sub-questions, search in parallel with WebSearch/WebFetch/Context7, deep-read key sources, synthesize a cited report with inline citations. The tool inventory in the skill file (`deep-research.md:18-23`) already assumes access to `WebSearch`, `WebFetch`, `Context7 MCP`, and the `Agent` tool for parallelization. The skill is well-designed and carries its own weight in the catalog.

**The violation.** No command in `.claude/commands/*.md` references `deep-research` (grep confirmed: zero matches). `rules/common/agents.md:43` lists `deep-research` under almanak's skill column — but almanak cannot execute it. `almanak.md:78` blocks WebSearch and WebFetch explicitly: "Context7 is the ONLY source — no WebSearch, no WebFetch, no training data". That blindering is deliberate (almanak is a narrow Context7-only library-docs agent) and the user has ruled it load-bearing. So the skill is **cataloged-but-unexecutable**: the routing table claims almanak owns it, but the agent's runtime contract forbids the tools the skill needs. Running `/almanak` to get deep research silently degrades to a Context7 call. No command produces the skill's actual output.

**The video gap.** Separately, `WebFetch` on a YouTube URL returns the page's HTML shell and the description blob, not the transcript. A research task on, say, "current state of RAG retrieval strategies" where the best evidence is a conference talk will either miss the evidence entirely or hallucinate content from the page metadata. No existing skill or agent fills this gap.

**Constraint: do not touch almanak.** The user has validated almanak's Context7-only posture as deliberate and wants it preserved. Any fix for the chain-rule violation must add a *new* executor, not widen almanak's tool surface.

### Current state, anchored to files

- `.claude/skills/deep-research.md` — full workflow, uses WebSearch + WebFetch + Context7 + Agent tool. No owner command.
- `.claude/agents/almanak.md:78` — "Context7 is the ONLY source — no WebSearch, no WebFetch, no training data". Hard constraint.
- `.claude/rules/common/agents.md:43` — catalog lists `deep-research` under almanak, inconsistent with line 78 above. Routing is broken in documentation, not just in absence.
- `.claude/commands/` — zero command invokes deep-research. Zero command mentions research-with-citations as a user entry point.
- `scripts/lib/` — 17 TypeScript modules; zero bash scripts anywhere in `.claude/hooks/scripts/` or `scripts/lib/`. The harness is TS-first by established convention.
- Agent roster — 15 agents, all K-prefix (arkitect, konstruct, kody, ..., alchemik). No agent owns web research.

## Decision

Ship deep research as a new first-class capability behind a `/research` command and a new `kerka` agent. Reuse the existing `deep-research.md` skill as-is. Add one TypeScript helper for YouTube transcript extraction. Reserve an extension point for a paid fallback in a later phase.

The seven concrete decisions below close the chain-rule violation, fill the video gap, and respect every user constraint already negotiated.

### D1 — New agent `kerka`

Create `.claude/agents/kerka.md`. Sonnet model. K-prefix, 5 letters, pronounceable (evokes "search" via Spanish *cerca*/Basque *bilatu*). Frontmatter `tools:` surface: `Read, WebSearch, WebFetch, Bash, Task`.

- `WebSearch`/`WebFetch` — required by the skill's workflow.
- `Bash` — required to invoke the `youtube-transcript.ts` helper (D4) and any shell-level text slicing (head/tail on large transcripts).
- `Task` — required because the skill explicitly says "Agent tool — parallelize research across sub-questions" (`deep-research.md:23`). Without `Task`, the parallelization step silently degrades to serial.
- `Read` — to consult cached results and repo files when the user's question has a local context component.
- **No `Skill`** in tools, matching the project-wide subagent convention (verified 2026-04-14: zero agents have `Skill` in their frontmatter).
- **No `Write`** — kerka returns its cited report as text output to the calling command. Persistence (if any) is orchestrated at command level.

**Alternatives for the name, already negotiated and rejected:**
- `skript` — violates K-prefix convention.
- `kolektor` — 8 letters, clunky next to 5-letter peers.
- `kazador` — "hunter" semantics read as hostile; research should feel collaborative.

### D2 — New command `/research`

Create `.claude/commands/research.md`. Frontmatter invokes kerka. Loads `deep-research` skill explicitly in the command's `skills:` field (closing the chain-rule violation at the command layer exactly as `rules/common/agents.md` requires). Keeps the orchestration simple:

```
/research <topic>
  -> kerka agent
     loads deep-research skill
     executes the skill's Step 1..N workflow
     returns cited report with source list
```

No preview gate, no approval step, no persistence side-effect. Output is read-only text. This matches the shape of `/almanak` (single lookup, no side-effects), not `/forge` (mutation pipeline). Matches the Direct orchestration pattern already documented in `rules/common/agents.md`.

### D3 — Reuse `deep-research.md`, do not create a new skill

The existing skill is complete and already scoped to what kerka needs. Creating `kerka-web-research.md` or similar would duplicate workflow content and violate skill-stocktake discipline (skill headcount stays at 46, not 47).

The ONLY edit to the skill file is additive: append a short "Execution caps (kerka)" subsection that documents the iteration caps from D7 so they travel with the skill. The skill remains reusable if a future command or agent needs the same workflow.

### D4 — YouTube transcript helper as TypeScript + yt-dlp CLI

Create `scripts/lib/youtube-transcript.ts`. Thin wrapper around the `yt-dlp` CLI. Public API:

```typescript
export interface YouTubeTranscriptOptions {
  url: string;
  maxChars?: number;      // defaults to 20000, returns a truncation marker on overflow
  language?: string;      // preferred auto-sub language, defaults to "en"
}

export interface YouTubeTranscript {
  videoId: string;
  title: string;
  durationSec: number;
  transcript: string;
  source: "manual" | "auto" | "unavailable";
  truncated: boolean;
}

export async function fetchYouTubeTranscript(
  opts: YouTubeTranscriptOptions,
): Promise<YouTubeTranscript>;
```

Implementation sketch (konstruct will detail):
- `execFileSync("yt-dlp", ["--skip-download", "--write-auto-sub", "--sub-format", "vtt", "--sub-lang", language, "--print", "title,duration", url], { ... })`
- Parse the emitted `.vtt` file, strip timestamps, return plain text.
- If `yt-dlp` is missing or exits non-zero, return `source: "unavailable"` with an empty transcript and a helpful diagnostic. Never throw into the agent — kerka must be able to continue with the remaining sources.

**Why TypeScript, not bash:** the harness has zero bash scripts. All 21 hook scripts are `.js`; all 17 lib modules are `.ts`. Adding a bash file here would be a one-off outlier with no test harness, no typechecking, no Windows CI. Keeping it in TS means the existing Vitest + tsx toolchain covers it and kerka invokes it via `Bash` through a compiled entry point (same pattern as `dashboard.ts`).

**Why `yt-dlp` as an external CLI, not an npm package:** the user wanted a zero-cost, non-abandoned solution. Every major JS YouTube-transcript wrapper on npm is either unmaintained (>12mo since last release), scrapes YouTube HTML and breaks on format changes, or wraps `yt-dlp` anyway. Using `yt-dlp` directly avoids the wrapper tax and the abandonware risk. `yt-dlp` is the de-facto standard, open source, actively maintained, cross-platform, and installable on Windows via `winget install yt-dlp`.

### D5 — Iteration caps (prompt-enforced, not hard-coded)

The kerka agent system prompt will carry explicit caps:

| Cap | Limit | Purpose |
|---|---|---|
| Sub-questions | 5 | Prevent unbounded decomposition |
| WebSearch per sub-question | 3 | Prevent search thrash |
| WebFetch total | 5 | Prevent deep-crawl drift |
| youtube-transcript per URL | 1 | Prevent retry storms |

These are **soft caps enforced in the prompt**, not hard-coded rate limits in a helper. Rationale discussed in the Trade-offs section. The caps are observable in kerka's output (every cited source is traceable) and tunable by editing the agent file without a code release. This matches the enforcement style already used in `almanak.md:71` ("Do not call `resolve-library-id` or `query-docs` more than 3 times total per request").

### D6 — Model selection: sonnet

Sonnet, not opus. Rationale: research is a tool-calling-heavy, long-tail-of-sources task. The reasoning cost per step is modest (read page, extract claim, continue). Opus is reserved in this harness for architectural judgment, complex planning, security analysis, and documentation synthesis (arkitect, konstruct, spektr, alchemik, doks). kerka's job is mechanical synthesis with citation discipline — sonnet territory. If heuristic quality disappoints after a week of real use, this is revisable without a new ADR (frontmatter-only change, auto-synced by `agent-metadata-sync` per ADR-008 Q8).

### D7 — Extension point for Fase 2 (Perplexity Sonar), documented only

In kerka's agent file, at the top of the "Execute Research" step, add a commented-out branch:

```md
<!--
  Fase 2 extension point (not implemented in ADR-009):
  if (process.env.PERPLEXITY_API_KEY && flags.premium) {
    // call Perplexity Sonar API, return answer+citations, skip Step 2-4
  }
  See ADR-009 section "Follow-ups" and CLAUDE.md /research command.
-->
```

This is a **documentation-only extension point**. No env var is read today. No flag is parsed today. The comment exists so that when Fase 2 ships, the addition is a local edit to one agent file, not a rework of the command chain. This matches ADR-005's "pure pipeline + single mutator" ethos: design for additive evolution, not replacement.

## Alternatives Considered

### Route A: Custom free (chosen)

Build the capability in-house using free tools already allowed by the harness (WebSearch, WebFetch, Context7, yt-dlp).

- **Pros:** zero recurring cost; no new API keys; no new governance surface; closes the chain-rule violation with a minimal, fully-owned stack; reuses existing skill; extension-point-ready for Fase 2.
- **Cons:** iteration caps are prompt-enforced (soft); yt-dlp must be installed on every machine that runs `/research`; transcript quality degrades on videos without auto-subs.
- **Cost:** $0.
- **Alignment with Kadmon philosophy:** high. Infrastructure-not-product; built once; carried via bootstrap.

### Route B: Perplexity Sonar API

Integrate Perplexity's Sonar API as the research backend; kerka emits structured queries and consumes the cited answers.

- **Pros:** very high answer quality; first-class citations; no per-site scraping; no rate-limit babysitting.
- **Cons:** recurring cost (Sonar is pay-per-query, nontrivial at harness scale); requires a new API key in every environment that bootstraps the harness; does NOT solve the video transcript gap (Perplexity cites video pages but does not transcribe); adds one more paid dependency to the harness.
- **Cost:** nontrivial recurring; variable per query.
- **Alignment:** medium. Solves the routing violation but introduces cost and doesn't close the video gap.

### Route C: Firecrawl as an external skill

Add Firecrawl as an external research skill via its published plugin or an HTTP wrapper.

- **Pros:** high-quality page extraction; JS-rendered content handled.
- **Cons:** paid; violates the `skill-creator:skill-creator` governance rule ("MUST use skill-creator plugin for ALL skill work" per `rules/common/agents.md`) because Firecrawl-as-a-skill would bypass that plugin; doesn't solve video transcripts either; skill sprawl.
- **Cost:** nontrivial recurring.
- **Alignment:** low. Governance-unfriendly.

### Route D: Combine A and B upfront

Ship A AND wire Perplexity at the same time as a premium fallback.

- **Pros:** best quality now; no follow-up sprint.
- **Cons:** doubles the surface of the first ship; forces a decision about API key management, cost tracking, quota handling, and failure fallbacks at launch; the user cannot yet evaluate whether A alone is sufficient; premature optimization.
- **Cost:** recurring + engineering overhead.
- **Alignment:** medium. Buys Fase 2 value but at the cost of shipping one thing well.

**Chosen: A.** It is the only route that ships at zero cost, reuses the existing skill, closes the routing violation cleanly, and leaves a clean extension seam for B if A's quality proves insufficient.

## Consequences

### Positive

- Chain-rule violation closed. `deep-research.md` has a real owner (kerka) reachable through a real command (`/research`). The routing inconsistency in `rules/common/agents.md:43` is resolved by moving `deep-research` from almanak's row to a new kerka row (auto-syncable via ADR-008 Q8's `agent-metadata-sync` hook).
- Users unlock research over videos, PDFs, and multi-source synthesis without touching almanak's deliberately narrow posture.
- Skill headcount stays at 46. skill-stocktake discipline preserved.
- Zero recurring cost. No new API keys in bootstrap. plan-003 distribution picks this up for free.
- Extension point D7 makes Fase 2 an additive, local edit rather than a rework.

### Negative

- `yt-dlp` is an external dependency that must be installed per machine (`winget install yt-dlp` on Windows, `brew install yt-dlp` on macOS, `pip install yt-dlp` cross-platform). Joe/Eden/Abraham will see an install step. The bootstrap script (plan-003) should document this but should NOT block on it — kerka must degrade gracefully when yt-dlp is missing.
- Iteration caps in D5 are prompt-enforced, not mechanical. A misbehaving model run could exceed them silently. Mitigation: kerka's output format requires enumerating every source fetched, making violations observable; and the caps can be promoted to hard-coded if abuse is seen in telemetry (cost-tracker logs for `/research` sessions will be the early warning).
- Transcript quality varies: videos without auto-subs, with paywalled captions, or with non-English content degrade to `source: "unavailable"`. The skill must treat transcript availability as best-effort.
- One new agent to maintain; model/tool changes must be auto-synced via `agent-metadata-sync` (already exists per ADR-008 Q8).

### Neutral

- Headcount bumps: 15 -> **16 agents**; 11 -> **12 commands**; 46 -> **46 skills (unchanged)**; 21 -> **21 hooks (unchanged)**; 19 -> **19 rules (unchanged)**. `CLAUDE.md` and `rules/common/agents.md` need row updates in both tables; both files are in scope for `agent-metadata-sync` so the sync is automatic on save.
- `.claude/commands/research.md` registered alongside the existing 11 commands. No category reshuffle needed — it naturally fits the "Observe/Remember/Evolve" triad as an Observe-phase tool.

## Architectural Trade-offs

Four decisions in this ADR involve genuine tension. Documenting them explicitly so future reviewers can re-evaluate without guessing.

### Prompt-enforced caps vs hard-coded caps

**Chosen: prompt-enforced.**

- **Velocity:** caps are tunable by editing one agent file; no code release, no test churn. Early iteration on a new agent benefits more from this than from mechanical safety.
- **Consistency:** almanak already enforces its 3-call Context7 limit in the prompt (`almanak.md:71`). Adding a second, different style of enforcement for kerka would fork the mental model.
- **Observability:** kerka's output format lists every source consulted. A cap violation is visible in the final report, not hidden behind a silent rate limiter.
- **Escalation path:** if real telemetry (cost-tracker events for `/research`) shows repeated violations, promoting the caps to hard-coded guards inside `youtube-transcript.ts` and a WebFetch counter in a future helper is a local change. The soft-first design is not a dead end.

Hard-coded caps would be safer in isolation but buy safety the harness does not yet need. Reject Premature Optimization; accept monitor-and-harden.

### Reuse `deep-research.md` vs new skill

**Chosen: reuse.**

The workflow in `deep-research.md` is nearly verbatim what kerka needs. Creating `kerka-web-research.md` would mean either (a) duplicating that workflow, or (b) making the new skill a thin shim that says "see deep-research". Neither is useful.

skill-stocktake (Tier S, per CLAUDE.md Meta skills section) exists to keep the catalog lean; this ADR respects that by adding **zero** skills. The only mutation to the skill file is additive (D3's "Execution caps (kerka)" subsection), and it travels *with* the skill so a hypothetical future third executor inherits the caps for free.

### Custom (Route A) vs Perplexity upfront (Route D)

**Chosen: Custom first, Perplexity as an extension seam.**

Route D buys better quality immediately, but at real cost and at the price of shipping two surfaces at once. The governing question is: **do we have evidence that A's quality is insufficient?** Answer: no — we have not yet measured. Shipping B preemptively would be a classic Golden Hammer (paid tool for every research task regardless of fit).

Ship A; instrument cost and iteration-cap telemetry; re-evaluate at a 2-week mark with real data. If A's quality is acceptable, Fase 2 is unneeded. If not, D7's extension seam makes Fase 2 a surgical addition.

### `yt-dlp` CLI vs npm wrapper

**Chosen: `yt-dlp` CLI.**

Every established JS YouTube-transcript npm package either (a) hasn't been updated in 12+ months, (b) scrapes YouTube HTML and breaks on UI changes, or (c) shells out to `yt-dlp` internally and adds no value. `yt-dlp` is the upstream that every wrapper chases; depending on the wrapper means depending on a chain that ultimately ends at `yt-dlp` anyway, with more failure modes.

**Cost of the CLI choice:** one install step per machine, documented in the bootstrap. **Benefit:** zero npm dependencies added to `package.json`; cross-platform; maintained; no abandonware risk. The harness already depends on `gh` and `git` as external CLIs; `yt-dlp` joins the same category.

## Implementation hand-off

Konstruct will own plan-009. Expected surface, specified here only so the plan can be drafted without reverse-engineering this ADR:

### New files

- `.claude/agents/kerka.md` — sonnet, tools `Read, WebSearch, WebFetch, Bash, Task`, K-prefix conventions, D5 caps in system prompt, D7 extension-point comment.
- `.claude/commands/research.md` — loads `deep-research` skill, invokes kerka, Direct orchestration pattern.
- `scripts/lib/youtube-transcript.ts` — `fetchYouTubeTranscript` helper wrapping `yt-dlp`.
- `tests/lib/youtube-transcript.test.ts` — unit tests (mocked `execFileSync`) covering: happy path, missing yt-dlp, missing auto-subs, truncation marker, non-English language.

### Modified files

- `.claude/skills/deep-research.md` — append "Execution caps (kerka)" subsection (D3). No workflow changes.
- `.claude/rules/common/agents.md` — add kerka row to agent catalog table; remove `deep-research` from almanak's skills column; add `/research` to the orchestration patterns section under Direct.
- `CLAUDE.md` — bump agent count (15 -> 16), command count (11 -> 12); add `/research` entry under Observe phase section; add kerka to the agent roster table.
- `docs/plans/plan-009-deep-research-capability.md` — konstruct writes this.

### Not touched

- `.claude/agents/almanak.md` — per user constraint, blindering preserved byte-for-byte.
- `.claude/skills/deep-research.md` workflow — only the caps subsection is added.
- `scripts/lib/state-store.ts` — no schema changes.
- `.claude/hooks/scripts/` — no new hooks, no modifications. `agent-metadata-sync` (from ADR-008 Q8) picks up the new kerka row automatically.
- `package.json` — no new npm dependency. `yt-dlp` is external.

## Follow-ups / Future Work

- **Fase 2 (conditional):** Perplexity Sonar integration via D7 extension point. Triggered by `--premium` flag on `/research` and `PERPLEXITY_API_KEY` env var. Requires: cost-tracker integration, quota handling, fallback-to-A on API failure, ADR-010 to document the cost model. **Go/no-go criterion:** two weeks of real `/research` use with cost-tracker telemetry showing either (a) A's quality is insufficient for >30% of queries, or (b) users explicitly request premium mode.
- **Fase 3 (hypothetical):** browser automation for sites with JS-rendered content that WebFetch cannot resolve. If pursued, evaluate whether kartograf (Playwright) can delegate a partial headless-fetch capability rather than introducing another dependency.
- **Monitoring:** `/research` sessions should be tracked via cost-tracker exactly like `/medik` and `/evolve` are today. No new schema — the existing `cost_events` table per CLAUDE.md's 6-table list handles it.
- **Bootstrap (plan-003):** document `yt-dlp` as an optional-but-recommended external dependency alongside `gh` and `git`. Never block bootstrap on its absence; kerka must degrade gracefully.

## Checklist verification

- [x] Requirements documented with concrete D1-D7 decisions.
- [x] API contracts defined (`fetchYouTubeTranscript`, `YouTubeTranscript`).
- [x] Data models specified (`YouTubeTranscriptOptions`, `YouTubeTranscript`). No DB changes.
- [x] User workflow mapped (`/research <topic>` -> kerka -> deep-research skill -> cited report).
- [x] Component responsibilities defined (command orchestrates, kerka executes, skill provides methodology, helper handles videos).
- [x] Error handling strategy (yt-dlp missing -> `source: "unavailable"`; kerka continues; never throws into the agent).
- [x] Testing strategy (unit tests on helper with mocked execFileSync; kerka itself validated via `/akademy` in a follow-up session).
- [x] Migration path: none needed, additive.
- [x] Performance targets: no hook latency involved; `/research` is user-initiated, not hook-time.
- [x] Security requirements (no eval, no shell interpolation — `execFileSync` with argument array per `rules/common/security.md`).
- [x] Windows compatibility (`yt-dlp` via winget; `execFileSync` with argument array; TS-first helper; no bash outlier).
- [x] Observability (cost-tracker picks up `/research` automatically; kerka output enumerates every source).

## Review date

**2026-04-28** — align with Sprint B.1 review. At that date: evaluate `/research` quality and iteration-cap telemetry from real use; decide Fase 2 go/no-go; revisit model selection (sonnet vs opus) if citation quality is weak; tighten D5 caps mechanically if prompt enforcement has leaked.
