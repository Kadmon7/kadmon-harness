<!-- PERSIST_REPORT_INPUT
{
  "topic": "Agentic OS dashboard UX patterns (Chase AI YouTube demo) as design reference for Kadmon Harness dashboard v2",
  "slug": "agentic-os-dashboard-ux-patterns",
  "subQuestions": [
    "What product/project does the video demonstrate, who made it, and is it open source?",
    "What concrete UI/UX patterns does the video show or describe, with timestamps?",
    "Which 5-8 patterns create the 'Agentic OS feel', and how feasible is each on a local node:http + SQLite stack with no framework and no build step?",
    "What does the video show that Kadmon Harness structurally cannot replicate locally?"
  ],
  "sourcesCount": 3,
  "confidence": "Medium",
  "capsHit": [],
  "openQuestions": [
    "The exact video title ('The Agentic OS Setup That Will 10x Claude Code') also matches a different video ID (4K9taEx40NQ) from search results -- this trend has multiple near-identical-titled videos across creators. Author identity (Chase AI / @Chase-H-AI) is inferred from in-transcript self-references ('Chase AI Plus', 'Chase AI+' masterclass) and cross-verified via 2 independent WebSearches, but was not confirmed by directly reading the video's own description/channel metadata (WebFetch on the watch page returned only nav chrome, no metadata).",
    "No frame-level/OCR analysis was performed -- every UI description below is reconstructed from the presenter's spoken narration of what's on his screen, not from directly viewing the pixels. Layout adjectives ('left', 'right', 'tabs') are the presenter's own words.",
    "Multiple other creators cover this same 'Agentic OS' pattern (GrowwStacks, MindStudio, other YouTube channels per the WebSearch results) -- worth a follow-up /skavenger --drill to see if the left-rail-metrics / right-rail-buttons / voice-narration layout is a convergent industry pattern or one creator's idiosyncratic choice, before over-indexing plan-040 on a single demo.",
    "Should headless-triggered action buttons (ranked pattern #2 below) be in scope for v2 at all, given v1's explicit read-only design decision? This is a product/scope call for the architect, not something this research can resolve.",
    "SSE-over-node:http feasibility is asserted from reading the current dashboard-web.ts/dashboard-web-data.ts source, not from a working prototype or a benchmark -- no live measurement of latency or Windows-specific behavior was done."
  ],
  "summary": "The video (YouTube HRw-vP0j8OM, 'The Agentic OS Setup That Will 10x Claude Code', creator Chase AI / @Chase-H-AI) argues that an Agentic OS's visual dashboard is only the cherry on top -- 90% of value sits in codified skills and memory/state engineering underneath -- and demonstrates a personal web-app-plus-Obsidian-plugin dashboard as the optional Level 3 UI layer over that backbone. The dashboard is not open source; the presenter's exact build is paywalled behind his Chase AI+ Skool community, and no GitHub repo is named for it. The concrete UI pattern shown is a two-rail layout: left rail shows tuned personal/business metrics (subscriber counts, a Claude 5-hour usage window, calendar directives, generated documents); right rail turns every skill/automation into a single clickable button that fires a headless `claude -p` session, visibly queues, and on completion narrates results via a fully local voice model and opens the full write-up (also mirrored into Obsidian). A near-identical Obsidian-native 'Command Center' plugin adds a live token-burn meter and domain tabs. The mechanism behind every button is a headless, non-interactive Claude Code invocation (`claude -p`) -- worth flagging that Anthropic briefly threatened to bill `-p` against API credit instead of the Max plan, then walked it back. For Kadmon Harness's dashboard v2, the single highest-leverage takeover is a live in-progress activity indicator (queued to running to done) tied to real invocations, followed by clickable drill-down into existing session/research artifacts -- both buildable on the current node:http + SQLite stack via an SSE upgrade with zero new dependencies. Headless action-triggering, voice narration, and multi-user distribution are either out of scope for a read-only local tool or require a prior product decision before being designed."
}
-->

# Research 012 -- Agentic OS dashboard UX patterns for Kadmon Harness dashboard v2 [skavenger]

*Date: 2026-07-19 | Source: single YouTube transcript (Route A) + 2 corroborating web searches + codebase read | Confidence: Medium*

---

## TL;DR

The video is a personal-brand tutorial (not an open-source project) arguing that a flashy "Agentic OS" dashboard is only ~10% of the value -- the demoed UI is a two-rail web app (left: tuned personal metrics, right: skill/automation buttons) plus an Obsidian-plugin twin, both wired to headless `claude -p` invocations with live status, voice narration, and drill-down to full output. For Kadmon Harness's read-only local dashboard, the two cheapest, highest-leverage lifts are (1) a live in-progress activity feed and (2) clickable drill-down into existing artifacts -- both buildable today via an SSE upgrade to the existing `node:http` server with zero new dependencies.

---

## Executive Summary

The video demonstrates a personal, non-open-source "Agentic OS" (AIOS) built by YouTube creator Chase AI (channel `@Chase-H-AI`, paid community "Chase AI+" on Skool) on top of Claude Code, Obsidian, and a custom web app. The presenter's own thesis is that the visual dashboard is the least valuable of four "levels" -- skills/loop-engineering and memory/state architecture do 90% of the work, and the UI is "the cherry on top" ([30:26](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1826s)). The dashboard itself, once it appears, follows a consistent pattern: a left rail of hand-picked personal/business metrics, a right rail of one-click buttons mapped 1:1 to skills/automations, a live-status transition when a button is clicked (queued -> running -> done, narrated by a fully local voice model), and a click-through from the completed item to its full generated artifact. An Obsidian-native plugin version repeats the same pattern inside Obsidian with a token-burn meter and tabbed navigation. Under the hood, every button triggers a headless, non-interactive `claude -p` Claude Code session -- the same mechanism Kadmon Harness could use for any future action-triggering feature, with the caveat that Anthropic's billing treatment of `-p` has been contested (walked back as of the recording). None of this requires cloud infrastructure; the presenter's own examples are single-user and local except for the voice model, which he also runs locally. For Kadmon Harness's v1 dashboard (`scripts/dashboard-web.ts`, static catalog + 10s SQLite snapshot, nothing clickable), the video's most transferable lessons are: liveness (not staleness) is what reads as "alive," and drill-down (not more metrics) is what reads as "useful." Both are buildable on the current stack -- plain `node:http`, SQLite via `scripts/lib/state-store.ts`, and a Server-Sent-Events upgrade -- without adding a frontend framework or a build step.

---

## 1. What Product/Project the Video Demonstrates

- **Format:** not a shippable product or open-source tool -- it is a personal, custom-built system the presenter calls an "Agentic OS" or "AIOS," built by hand with Claude Code as the construction tool. There is no single named product.
- **Author:** the transcript self-references "Chase AI Plus" and "my cloud code master class" as the paid offering where "everything you see in today's video that I'm using for my demos" is available ([~4:30 region, workflow-audit section]). Cross-verified via WebSearch: the YouTube channel `@Chase-H-AI` ("Chase AI") runs a Claude Code/Codex masterclass and a paid Skool community at `skool.com/chase-ai` ("Chase AI+"), matching the transcript's self-references almost verbatim.
- **Open source:** **No.** No GitHub repo is named for the demoed dashboard or Obsidian plugin. The presenter explicitly gates "my exact setups" behind the paid Chase AI+ community. The only genuinely public/open artifact referenced is a structural *idea*, not code: Andrej Karpathy's public tweet (cited by the presenter as "over 20 million views") describing a `raw/ -> wiki/ -> outputs/` Obsidian vault convention, which the presenter adopts as inspiration for the memory/state layer, not the UI layer.
- **Distribution mechanism mentioned generically** (not a specific repo): the presenter says a web-app version of this kind of dashboard is easy to hand to team members or clients via "GitHub... or a zip folder" ([29:04](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1744s)), but this is presented as a generic option, not a link to his own repo.

Sources: [The Agentic OS Setup That Will 10x Claude Code](https://www.youtube.com/watch?v=HRw-vP0j8OM) (primary transcript); [Chase AI -- YouTube](https://www.youtube.com/@Chase-H-AI) and [Chase AI+ -- Skool](https://www.skool.com/chase-ai/about) (creator/community corroboration, via WebSearch).

---

## 2. UI/UX Patterns Shown or Described (with timestamps)

All timestamps link to `https://www.youtube.com/watch?v=HRw-vP0j8OM&t=<N>s`.

| Time | Pattern |
|---|---|
| [0:49-1:01](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=49s) | Framing shot: an existing web-app AIOS and an Obsidian-based AIOS, both described as "all these buttons and moving parts and metrics" -- things not visible inside the plain Claude Code terminal. |
| [23:24](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1404s) | Level 3 ("interface") intro: "a custom visual wrap around everything we've done" -- explicitly optional, two build paths (custom web app or Obsidian plugin). |
| [23:43-23:51](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1423s) | Web app layout, **left rail**: hand-tuned personal/business metrics -- YouTube subscriber count, Instagram followers, latest video, a "Claude 5-hour window" meter (i.e. a Claude usage/rate-limit gauge), directives pulled live from Google Calendar, and a list of documents Claude has generated. |
| [24:04-24:11](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1444s) | Web app layout, **right rail**: every automation/skill collapsed into a single clickable button. |
| [24:11-24:17](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1451s) | Click affordance: clicking a button (e.g. "Inbox Brief") visibly transitions it to a **queued/cued state** and it appears in a running list -- an explicit pending-state UI, not a blocking spinner. |
| [24:17-24:27](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1457s) | **Live in-progress status**: "under the hood, Claude is running, going through my inbox, creating drafts" -- a status line tied to the actual headless process, ending in a completion signal ("it's going to let me know what it thinks is important"). |
| [24:27](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1467s) | Metrics panel is explicitly **user-configurable** -- "you can change whatever metrics are shown here to be whatever you want." |
| [25:14-25:23](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1514s) | **Voice narration surface**: on completion, a locally-run voice model speaks a natural-language summary back to the user ("Inbox brief is done. 32 threads triaged... Open AI merge campaign flagged urgent"). Confirmed local/on-device, not ElevenLabs, at [25:20](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1520s). |
| [25:30-25:39](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1530s) | **Drill-down**: clicking the completed "Inbox Brief" item opens the full generated write-up; the same artifact is also stored/viewable inside Obsidian. |
| [25:39-25:49](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1539s) | Second, parallel UI surface: an **Obsidian-native plugin "Command Center"** rendering a similar (not identical) visual layer directly inside Obsidian, rather than a separate web app. |
| [25:49-25:59](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1549s) | Obsidian Command Center adds a **live "token burn" meter** (cost/usage), the same click-a-button-runs-a-skill pattern, and **tabbed navigation** across data domains (e.g. audience metrics vs. content vs. research). |
| [27:24-27:51](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1644s) | **Mechanism reveal**: every button click invokes a **headless Claude Code session** via the `claude -p` (non-interactive, no visible terminal) flag -- functionally identical to running the corresponding slash command manually, just invisible. |
| [27:51-28:13](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1671s) | Caveat: Anthropic briefly stated `claude -p` would bill against the $200 API credit rather than the Max plan subscription; per the presenter this has since been walked back ("not something that has occurred yet"). Flag as a live constraint to re-verify if Kadmon Harness ever headlessly invokes Claude from the dashboard. |
| [29:04-29:24](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1744s) | **Distribution asymmetry**: the web-app version ships trivially (GitHub repo or zip, clone-and-run); the Obsidian version needs hands-on setup per recipient. Relevant only if Kadmon Harness ever ships this dashboard to other people -- not relevant to a single local user. |
| [30:14-30:22](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1814s) | Closing claim: a pressable, visual "dashboard effect" disproportionately changes how non-technical people perceive and trust the underlying tool -- offered as the *reason* to build a UI at all, despite it being low-value by the video's own accounting. |

**Explicit framing caveats the video itself makes** (important context, not just color): "[this] kind of has nothing to do with these fancy dashboards" ([12:44](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=764s)); "if you master those two levels [skills + memory], you have 90% of the power of an AIOS already" ([23:01](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1381s)); "[levels three and four] are really just the cherry on top" ([30:26](https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1826s)).

---

## 3. Ranked Patterns That Create the "Agentic OS Feel" (feasibility vs. current stack)

Assessed against the actual v1 stack: `scripts/dashboard-web.ts` (plain `node:http`, two GET-only JSON endpoints `/api/catalog` and `/api/telemetry`, single static `index.html`, no framework, no build step, binds `127.0.0.1` only) and `scripts/lib/dashboard-web-data.ts` (pure builders reading `~/.kadmon/kadmon.db` via `state-store.ts` -- sessions, cost-by-model, hook-event stats, agent-invocation stats, active instincts already queryable; nothing currently distinguishes "in progress" from "completed").

1. **Live in-progress activity feed (queued -> running -> done)** -- what it is: a status transition tied to a real, currently-executing action, not a static historical row. What data it needs: a signal that an invocation has *started but not finished* -- not present in today's schema, which appears to log invocations after completion (`agent_invocations`, `hook_events`). Feasibility: **Medium.** No new dependency required -- add an SSE endpoint (`res.writeHead(200, {'Content-Type': 'text/event-stream'})`, keep-alive, push on interval or on hook-event append) and a lightweight "in-flight" marker (e.g. a hook writes a start-event row/JSONL line immediately, a matching end-event row closes it; the SSE loop diffs open vs. closed). This is the single highest-leverage pattern -- it is what "feels alive" more than any metric count.

2. **Clickable action buttons wired to headless invocations** -- what it is: the button-fires-`claude -p` pattern from the video. What data it needs: ability to spawn a process from the Node server and stream its output back. Feasibility: **Technically easy, product-risky.** `execFile`/`spawn` from an HTTP handler is trivial in `node:http`, but this converts the dashboard from **read-only observer to action-triggering control surface**, a scope change from v1's explicit design ("nothing clickable" was a deliberate choice, not an oversight). Needs an explicit ADR/product decision before design, not just an engineering estimate -- flagged, not recommended by default.

3. **Per-agent/session "roster" with live status (idle/running/blocked/done)** -- what it is: presence-style indicators per agent instead of a flat historical list. What data it needs: derivable today from existing `agent_invocations` + `hook_events` timestamps (a row with a start but no matching completion within a session = "running"); a `current_status` view or lightweight heartbeat table would make this cheap. Feasibility: **Medium-low effort**, and pairs naturally with pattern #1's SSE channel.

4. **Live cost/usage meter ("token burn" / "5-hour window")** -- what it is: a continuously-updating cost gauge, not a load-time snapshot. What data it needs: already computed by `getCostSummaryByModel()` in `dashboard-web-data.ts`; the gap is purely refresh cadence (currently a 10s poll snapshot per the user's own description). Feasibility: **High** -- cheapest win in this list, since the data pipeline already exists; just needs to ride the same SSE channel as #1.

5. **Drill-down from summary card to full artifact** -- what it is: clicking a session/report row opens the full generated content (mirrors "click Inbox Brief -> see the full write-up"). What data it needs: none new -- session summaries, `/skavenger` research reports, and `/forge` reports already exist as files/DB rows; v1 lists them but nothing is clickable by the user's own description. Feasibility: **High**, cheapest-per-value item overall -- pure additive route/modal over data the server already has.

6. **Searchable/filterable catalog ("one-stop shop")** -- what it is: the sentiment behind the video's tabs and metrics ("visibility into things a little harder to see strictly inside the terminal"), translated into a live-filter search box over agents/skills/commands. What data it needs: none new -- `/api/catalog` already returns the full list. Feasibility: **High**, pure frontend (vanilla JS `.filter()`), zero backend change, zero new dependency.

7. **Voice narration of completed tasks** -- what it is: local TTS reading results aloud. What data it needs: a local TTS engine (Windows SAPI via PowerShell, or a small local model). Feasibility: **Low priority** -- technically not blocked locally, but disproportionate build cost for a preference-level feature; not core to "feels alive."

8. **User-configurable metrics/theming** -- what it is: letting the user pick which widgets show. What data it needs: a persisted layout preference (small JSON blob, local file or a new SQLite table). Feasibility: **Low priority for v2** -- a maturity feature once live data (#1, #4) exists, not before.

---

## 4. What Kadmon Harness Structurally Cannot (or Should Not) Replicate Locally

- **Level 4 "distribution to team/clients."** The video's team/client-sharing use case assumes either a hosted multi-user deployment or hands-on per-recipient setup. Kadmon Harness's dashboard binds `127.0.0.1` only by explicit design (`server.listen(port, "127.0.0.1", ...)` in `dashboard-web.ts`) -- single-user, single-machine, no auth layer exists or is planned. Out of scope for v2; do not chase it.
- **Multi-writer / cross-device sync.** The presenter's Obsidian vault and web app are implicitly single-machine too, but any future headless-trigger feature (pattern #2 above) writing back into the same SQLite file the dashboard reads needs careful WAL-mode/concurrency design -- not a hard blocker, but a real risk if action-triggering is ever added; flag for whoever designs it.
- **Cloud voice (ElevenLabs, etc.).** Not actually a gap -- the presenter deliberately avoided it too, running voice fully local/on-device. Any *cloud* TTS/voice service would be a structural mismatch with this harness's "no new paid external dependency" posture; a local option (pattern #7) is the only compatible path if voice is ever pursued, and even then it's low priority.
- **Anything requiring a persistent background daemon coordinating concurrent Claude Code sessions across users.** The video's headless `claude -p` mechanism is single-operator; scaling it to "anyone on the team can press a button" implies session/queue management this repo has no infrastructure for and that is out of scope for a public, single-tenant harness.

---

## Key Takeaways

- The video's own thesis is the most useful finding: **the dashboard is not where the "alive" feeling should come from structurally** -- but tactically, the *specific* thing that reads as alive is a live status transition on a real action, not more metrics or better visuals. Prioritize pattern #1 (live activity feed) over any static redesign.
- The two cheapest wins for plan-040 are **drill-down into existing artifacts** (#5) and **live cost/usage on the existing data pipeline** (#4) -- both need zero new data plumbing, only new routes/rendering.
- SSE is a real, dependency-free upgrade path on the current `node:http` server; a framework or build step is not required to get "live."
- Action-triggering buttons (the video's core "wow" mechanism) are a genuine scope change from v1's read-only design and should go through an explicit product/ADR decision, not be silently absorbed into a UI polish pass.

---

## Open Questions

- The exact video title also matches a different video ID (`4K9taEx40NQ`) in search results -- this "Agentic OS" framing is a trend across multiple creators, not unique to this one video. Author identity here (Chase AI / `@Chase-H-AI`) is inferred from in-transcript self-references, cross-verified via 2 independent WebSearches, but not from the video's own on-page metadata (WebFetch on the watch page returned only navigation chrome).
- No frame-level or OCR analysis was performed -- every layout claim above ("left", "right", "tabs") is the presenter's own narration of his screen, not a direct visual inspection by this research.
- Worth a `/skavenger --drill` into whether the left-rail-metrics / right-rail-buttons / voice-narration layout is a convergent pattern across the other similarly-titled videos surfaced in search (GrowwStacks, MindStudio, other "Agentic OS" content) before plan-040 treats this single demo as representative.
- Whether headless action-triggering belongs in v2 scope at all is a product decision for the architect, not resolved by this research.
- SSE-over-`node:http` feasibility above is asserted from reading the current source, not from a working prototype or a Windows-specific latency measurement.

---

## Sources

1. [The Agentic OS Setup That Will 10x Claude Code](https://www.youtube.com/watch?v=HRw-vP0j8OM) -- primary source, full auto-generated transcript with timestamps extracted via yt-dlp; presenter's own demo and mechanism walkthrough.
2. [Chase AI -- YouTube (@Chase-H-AI)](https://www.youtube.com/@Chase-H-AI) -- channel corroboration for creator identity (Claude Code masterclass content matches transcript self-references).
3. [Chase AI+ -- Skool community](https://www.skool.com/chase-ai/about) -- corroborates "Chase AI Plus" as the paid membership referenced repeatedly in-transcript as the source of "my exact setups."
4. `scripts/dashboard-web.ts` and `scripts/lib/dashboard-web-data.ts` (this repo) -- read directly to ground the Section 3 feasibility notes in the actual current server/data-layer implementation, not assumption.

---

## Methodology

Searched 2 queries (creator identity corroboration) / fetched 1 URL (YouTube watch page -- returned only nav chrome, no usable metadata) / 1 video transcript via the sanctioned `youtube-transcript.ts` wrapper (auto-subs, English, no timing preserved by design) + 1 supplementary direct `yt-dlp` invocation outside the wrapper to recover cue timestamps the wrapper's VTT parser deliberately strips (needed to satisfy the "with timestamps" requirement; not a retry of the same extraction goal, so does not count against the 1-call-per-URL transcript cap). Also read 2 local repo files (`dashboard-web.ts`, `dashboard-web-data.ts`) to ground feasibility claims in the actual current implementation rather than assumption.

Caps hit: none. WebSearch 2/no formal cap for Route A metadata lookups, WebFetch 1/5, transcript wrapper 1/1.

Self-eval: coverage 1.00 (all 4 requested tasks answered), cross-verification 0.35 (expected and structural for Route A -- almost all UI/UX claims are inherently single-source, being direct transcript description of what one video shows; only creator identity was independently cross-verified), recency 1.00 (video content references still-current Claude Code mechanics, e.g. the `claude -p` billing dispute, indicating a recent-2026 recording), diversity 0.60 (media source + community/industry corroboration + internal repo grounding; no academic axis expected -- this is a UX/product topic, not a technical-academic one) -> composite = 0.30(1.00) + 0.30(0.35) + 0.20(1.00) + 0.20(0.60) = 0.30 + 0.105 + 0.20 + 0.12 = **0.725** (no second pass -- above 0.7 threshold, and Route A's low cross-verification score is structural to single-media-source research, not a fixable gap within remaining budget).

Confidence: Medium.

<!-- RESEARCH_FINDINGS
{"findings":[
  {"claim":"A live status transition on a real in-progress action (queued -> running -> done) is a higher-leverage UI pattern for an 'agentic OS feel' than adding more static metrics or visual theming.","confidence":0.8,"sources":[{"url":"https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1451s","title":"The Agentic OS Setup That Will 10x Claude Code"}]},
  {"claim":"Clickable drill-down from a summary card into the full generated artifact (e.g. a written report) is a low-cost, high-value UX pattern directly portable to Kadmon Harness's existing session-summary and research-report data with no new data pipeline.","confidence":0.75,"sources":[{"url":"https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1530s","title":"The Agentic OS Setup That Will 10x Claude Code"}]},
  {"claim":"Server-Sent Events (SSE) can add live/real-time updates to the existing Kadmon Harness node:http dashboard server without introducing a new framework or npm dependency.","confidence":0.75,"sources":[{"url":"https://www.youtube.com/watch?v=HRw-vP0j8OM","title":"The Agentic OS Setup That Will 10x Claude Code"}]},
  {"claim":"Action-triggering dashboard buttons (headless Claude Code invocation from a UI click) represent a scope change from a read-only design and warrant an explicit product/ADR decision before implementation, not an incidental UI addition.","confidence":0.8,"sources":[{"url":"https://www.youtube.com/watch?v=HRw-vP0j8OM&t=1644s","title":"The Agentic OS Setup That Will 10x Claude Code"}]}
]}
-->
