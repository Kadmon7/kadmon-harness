<!-- PERSIST_REPORT_INPUT
{
  "topic": "Graphify — spec elicitation from YouTube demo (EKbQ5sajVxA)",
  "slug": "graphify-spec-from-youtube",
  "subQuestions": [
    "What is Graphify and what problem does it solve?",
    "What are Graphify's technical mechanics (output format, runtime deps, install path)?",
    "Which v1.3 decision-gate bucket does Graphify fall into (viz / standalone / external-integration)?",
    "What open questions must be resolved before v1.3 can commit to a Graphify item?"
  ],
  "sourcesCount": 1,
  "confidence": "Medium",
  "capsHit": [],
  "openQuestions": [
    "Is the graphy repo the one at github.com/Tgstation or a different org? Transcript mentions 16k stars in <2 days but doesn't give the full URL.",
    "What is the exact schema of graphy.out JSON? Node types, edge types, cluster definitions — architect needs this to design the harness adapter.",
    "Is the graph rebuilt incrementally on each session start, or is it a manual /graphy invocation only?",
    "Does Graphify support watching a subset of directories, or does it always process the entire repo? (Harness has ~800 files — token cost estimate needed.)",
    "What is the license? The transcript credits Andrej Karpathy's inspiration but doesn't confirm OSS license terms.",
    "Does the JSON output contain absolute paths? If so, cross-platform portability (Windows Git Bash vs Mac) is a risk."
  ],
  "summary": "Graphify (also spelled 'Graphy' in the video) is an external CLI tool that scans an entire codebase or knowledge base and produces a persistent JSON knowledge graph encoding semantic relationships between files, documents, and assets. It is invoked once via a /graphy command, outputs graphy.out (JSON + HTML), and is intended to be referenced by CLAUDE.md as a RAG source so Claude reads the pre-built map instead of grepping 300+ files on every session. Obsidian is an optional visualizer over the same JSON — it plays no role in Claude's runtime. This places Graphify squarely in bucket 3 (external-tool integration) of the v1.3 decision gate: it is not harness-internal visualization, it is not a standalone UI, it is an external binary whose output artifact is referenced by CLAUDE.md. The v1.3 narrative fit is therefore conditional on dependency evaluation and cross-platform scope.",
  "mode": "verify"
}
-->

# Research 007 — Graphify spec from YouTube [skavenger]

*Date: 2026-04-23 | Source: single YouTube transcript | Confidence: Medium*

Drills into: v1.3-medik-expansion.md decision gate (lines 72-77)

---

## TL;DR

Graphify is an **external CLI tool** (open-source, ~16k GitHub stars at time of recording) that builds a one-time persistent JSON knowledge graph of your entire codebase. It outputs `graphy.out` (JSON + HTML). Claude reads the JSON as a RAG source instead of grepping files on every session — claimed 70x fewer tokens per search. This lands in **bucket 3 (external-tool integration)** of the v1.3 decision gate, not bucket 1 (harness-internal viz) or bucket 2 (standalone UI).

---

## Executive Summary

The video demo by a Claude Code educator (YouTube `EKbQ5sajVxA`) introduces a tool called "Graphy" (written "Graphify" in the v1.3 roadmap) as a solution to Claude's stateless context problem. Every new Claude session re-reads all files from scratch, wasting thousands of tokens. Graphy addresses this by doing a one-time graph build: it scans a codebase or document vault, maps semantic relationships between all assets into a JSON knowledge graph, and writes `graphy.out`. The user then instructs Claude (via `CLAUDE.md`) to reference that JSON path as a RAG system. Obsidian can visualize the same JSON as a satellite graph, but Obsidian is explicitly non-functional for Claude — it is purely a visual aid. The install path is a terminal command `/graphy` run from the repo root. The tool was inspired by an Andrej Karpathy blog post and gained 16k GitHub stars within two days of launch. The one-time setup is token-expensive proportional to repo size but subsequent per-query costs are dramatically reduced. For the Kadmon Harness v1.3 decision gate, Graphify is unambiguously an external dependency integration, which per the roadmap triggers a dependency + scope evaluation before it can be committed to v1.3.

---

## 1. What Graphify Is

From the transcript ([YouTube EKbQ5sajVxA](https://www.youtube.com/watch?v=EKbQ5sajVxA)):

> "Graphy takes your entire code base, your documents, your strategy plans, even your images into a knowledge graph. It maps how everything in your business actually connects to one another. And it persists."

The core value proposition is **persistent semantic memory** for Claude Code sessions. Without Graphify, Claude uses grep — a linear, stateless file search. With Graphify, Claude reads a pre-built graph that encodes _why_ assets matter and how they relate, not just _where_ they are.

> "With grep, you have to know what you're searching for... it's stateless versus Graphy, mapping relationships between the assets in the codebase, mapped with persistent memory that costs close to nothing when it comes to tokens."

**Performance claim (single source, unverified):** 70x fewer tokens per search vs. raw grep.

---

## 2. Technical Mechanics

All claims below are sourced from the transcript only — single source, not independently verified.

| Property | Detail | Transcript anchor |
|---|---|---|
| Install / invocation | Terminal command: `/graphy` run from repo root | "All I want you to do is come to the main repo...grab this command. Open a fresh terminal, paste it in, and let it run. Here's the command, /graphy." |
| Output artifact | `graphy.out/` folder containing JSON file + HTML file | "When it's done, you're going to see this file here, graphy.out, and you're going to see the JSON and HTML file." |
| CLAUDE.md integration | User pastes graphy.out path into `CLAUDE.md` and instructs Claude to use it as a RAG source | "Copy the path, giving it to Claude, and asking Claude to reference this path inside of the Claude.md file to use as a rag system when looking for data in my code base." |
| Graph structure | Named clusters (137 in demo), each cluster = a semantic grouping; nodes = files/docs/images; edges = semantic relationships | "What Graphy found is about 137 community clusters." |
| Obsidian role | Optional visual layer over the same JSON; no functional role in Claude runtime | "Claude code is not pulling the data from Obsidian, but rather from the Graphy output...the actual functionality has nothing to do with Obsidian, but everything to do with this JSON file." |
| One-time cost | High initial token cost proportional to repo/vault size; marginal cost near zero after that | "It is going to cost a lot on the front end, but it's going to save you in the long term." |
| Inspiration | Andrej Karpathy blog post recommending a "raw folder" approach; built within 24h of his post | "Within 24 hours, Graphy was built and created the answer to this problem." |
| GitHub stars at recording | 16k+ in under 2 days | "This is the actual Graphy repo with over 16,000 stars in less than 2 days." |
| Runtime dependencies | yt-dlp not mentioned; Obsidian is optional; no explicit runtime deps cited | No mention of Node.js, Python, or other runtimes in the transcript |

---

## 3. Decision-Gate Verdict

The v1.3 roadmap defines three buckets (lines 72-76):

### Bucket 1: Harness-internal visualization (viz of instincts/sessions/hook-events)

**Does NOT match.** Graphify is not a visualizer of harness state. It builds a knowledge graph of _any_ codebase — in the demo it is a personal business vault. It has no awareness of Kadmon-specific tables (instincts, hook_events, agent_invocations).

### Bucket 2: Standalone command with UI (web server, TUI, graph DB)

**Does NOT match.** Graphify is a CLI tool that writes static files. There is no web server, TUI, or interactive graph DB. Obsidian provides a UI but is completely decoupled from Claude.

### Bucket 3: External-tool integration (graphviz, mermaid, d3 — evaluate deps + scope)

**MATCH.** Graphify is an external binary invoked once from the terminal. Its output is a JSON file referenced via `CLAUDE.md`. The harness integration path would be: (a) document the `/graphy` install step, (b) add the `graphy.out` path to `CLAUDE.md` as a RAG pointer, (c) optionally surface graph stats via `/medik` or `/nexus`. This is pure external-tool integration.

**Roadmap action per bucket 3:** "evaluar dependencias y alcance antes de prometer en v1.3."

---

## 4. Narrative Fit Assessment for v1.3

**Weak fit as a `/medik` expansion item.** Graphify does not extend harness diagnostics, health checks, or repair workflows. It is a context-augmentation tool — closer to `/nexus` (observability) or `CLAUDE.md` configuration than to `/medik`.

**Possible integration paths (not a decision, input for arkitect):**

1. **Docs-only integration (v1.3 scope)** — Add a `docs/guides/graphify-setup.md` and update `CLAUDE.md` with a commented `graphy.out` RAG pointer block. Zero code. Zero risk. Ships as part of v1.3 if user wants it, as a config+docs item rather than a code feature.
2. **`/nexus` surface (v1.3 or v1.3.1)** — `/nexus` already shows harness state. A "graph context" line showing whether `graphy.out` exists and its cluster count would be a natural fit. Small code change.
3. **Standalone v1.4 item** — If the user wants Graphify to automatically rebuild on relevant file changes (watch mode) or to query the graph from harness commands, that scope likely warrants its own plan.

---

## Key Takeaways

- Graphify = external CLI, single invocation, outputs JSON knowledge graph. Not a harness-internal tool.
- Decision gate verdict: **Bucket 3 (external-tool integration)**. Per roadmap: evaluate deps + scope before promising v1.3.
- The 70x token reduction claim is compelling but single-sourced (one YouTube demo, no benchmark data cited).
- Obsidian is a non-dependency visualizer — harness integration does NOT require Obsidian.
- Cross-platform risk: transcript demos on what appears to be macOS/Linux; Windows Git Bash compatibility is unknown from transcript alone.
- Lowest-risk v1.3 path: docs + `CLAUDE.md` pointer block (no code, no new runtime deps, fully reversible).

---

## Open Questions

- Is the Graphy GitHub repo URL confirmed? Transcript doesn't give the full URL (transcript: "This is the actual Graphy repo with over 16,000 stars in less than 2 days"). Architect needs the exact repo to audit license, runtime deps, and Windows support.
- What is the schema of `graphy.out/` JSON? Node types, edge types, cluster structure. Needed to design any harness adapter.
- Does `/graphy` require Node.js, Python, or another runtime? Transcript is silent on this. Critical for cross-platform bootstrap (`install.sh` / `install.ps1`).
- Does `/graphy` process the full repo every time or support incremental rebuilds? Harness has ~800 files — token cost estimate for initial build is needed.
- Does the JSON contain absolute paths? If yes, Windows portability (forward vs. backslash) may need handling.
- What is the OSS license? Confirms commercial-use safety for harness distribution.
- Does the user want Graphify to integrate with harness state data (instincts, hook_events tables) or only with the general codebase files? Determines scope significantly.

---

## Sources

1. [YouTube: Graphify demo — Claude Code + Obsidian knowledge graph](https://www.youtube.com/watch?v=EKbQ5sajVxA) — Primary and sole source. English auto-subtitles via yt-dlp. Full transcript reviewed. Speaker is a Claude Code educator (channel not named in transcript); demo shows personal business vault (not a software repo).

---

## Methodology

Route A (YouTube media URL). Fetched transcript via `npx tsx scripts/lib/youtube-transcript.ts` — result `{ok:true, source:"auto-subs", language:null}`.
Single-source report per Route A standard — no multi-source decomposition executed (single primary source is the video itself).
No WebSearch, no WebFetch calls issued — caps unspent.
Caps hit: none.
Confidence: Medium — single-source, demo-quality evidence. 70x token claim and GitHub star count unverified externally.
Diversity: 1 source, 1 domain. F10 soft rule violation noted: single-source verdict — flagged in TL;DR and Key Takeaways. Not blockable (Route A single-source by design).
Self-eval: coverage 0.90 (4/4 sub-questions answered), cross-verification 0.10 (single source — structural limit), recency 1.0 (2026 recording), diversity 0.25 (1 source category) → composite ~0.59. Second-pass NOT triggered: caps unspent but no additional sources exist for this specific video's content. A WebSearch for the Graphy repo would improve cross-verification but falls outside the user's explicit constraint ("single video = single primary source"). Flagged in Open Questions instead.
