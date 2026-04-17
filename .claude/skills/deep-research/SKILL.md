---
name: deep-research
description: Multi-source deep research methodology — plan sub-questions, search with WebSearch/WebFetch/Context7, deep-read key sources, synthesize cited reports with inline citations. Use this skill whenever the user asks to "research", "investigate", "deep dive", "compare", "evaluate options", "look into", or says "what's the current state of", "due diligence", "competitive analysis", "market sizing", or needs any evidence-based analysis drawing on sources beyond the current codebase. Also use when the user asks for an opinion on a technology or framework — research first, then recommend with citations. Prefer this over WebSearch-alone because the methodology forces sub-question decomposition and cross-referencing.
---

# Deep Research

Produce thorough, cited research reports from multiple web sources.

## When to Use

- User asks to research any topic in depth
- Competitive analysis, technology evaluation, or market sizing
- Due diligence on companies, technologies, or frameworks
- Any question requiring synthesis from multiple sources
- User says "research", "deep dive", "investigate", or "what's the current state of"

## Tools Available

- **WebSearch** — search the web for information
- **WebFetch** — fetch and read full page content from URLs
- **Context7 MCP** — fetch current library/framework documentation
- **Agent tool** — parallelize research across sub-questions

## Workflow

### Step 1: Understand the Goal

Ask 1-2 quick clarifying questions:
- "What's your goal -- learning, making a decision, or writing something?"
- "Any specific angle or depth you want?"

If the user says "just research it" -- skip ahead with reasonable defaults.

### Step 2: Plan the Research

Break the topic into 3-5 research sub-questions. Example:
- Topic: "Impact of AI on healthcare"
  - What are the main AI applications in healthcare today?
  - What clinical outcomes have been measured?
  - What are the regulatory challenges?
  - What companies are leading this space?
  - What's the market size and growth trajectory?

### Step 3: Execute Multi-Source Search

For EACH sub-question, search using available tools:

```
WebSearch: "<sub-question keywords>"
```

**Search strategy:**
- Use 2-3 different keyword variations per sub-question
- Mix general and news-focused queries
- Aim for 15-30 unique sources total
- Prioritize: academic, official, reputable news > blogs > forums

### Step 4: Deep-Read Key Sources

For the most promising URLs, fetch full content:

```
WebFetch: "<url>"
```

Read 3-5 key sources in full for depth. Do not rely only on search snippets.

### Step 5: Synthesize and Write Report

```markdown
# [Topic]: Research Report
*Generated: [date] | Sources: [N] | Confidence: [High/Medium/Low]*

## Executive Summary
[3-5 sentence overview of key findings]

## 1. [First Major Theme]
[Findings with inline citations]
- Key point ([Source Name](url))
- Supporting data ([Source Name](url))

## 2. [Second Major Theme]
...

## Key Takeaways
- [Actionable insight 1]
- [Actionable insight 2]
- [Actionable insight 3]

## Sources
1. [Title](url) -- [one-line summary]
2. ...

## Methodology
Searched [N] queries across web and news. Analyzed [M] sources.
```

### Step 6: Deliver

- **Short topics**: Post the full report in chat
- **Long reports**: Post executive summary + key takeaways, save full report to a file

## Parallel Research with Subagents

For broad topics, use Agent tool to parallelize:

```
Launch 3 research agents in parallel:
1. Agent 1: Research sub-questions 1-2
2. Agent 2: Research sub-questions 3-4
3. Agent 3: Research sub-question 5 + cross-cutting themes
```

Each agent searches, reads sources, and returns findings. The main session synthesizes into the final report.

## Quality Rules

1. **Every claim needs a source.** No unsourced assertions.
2. **Cross-reference.** If only one source says it, flag as unverified.
3. **Recency matters.** Prefer sources from the last 12 months.
4. **Acknowledge gaps.** If you couldn't find good info, say so.
5. **No hallucination.** If you don't know, say "insufficient data found."
6. **Separate fact from inference.** Label estimates, projections, and opinions.

## Integration

- **Agent**: skavenger (primary, for multi-source research via /research)
- **Tools**: WebSearch, WebFetch (deferred tools), Context7 MCP
- **Aligns with**: no_context principle (evidence-based claims, never invent)

## no_context Application

This skill is fundamentally about evidence-based claims. Every assertion must be traceable to a source. When sources conflict, present both sides. When data is insufficient, say so explicitly rather than filling gaps with assumptions.

## Execution caps (skavenger)

When this skill is executed by the skavenger agent via /research, the following iteration caps apply (prompt-enforced, see ADR-009 D5):

- Sub-questions: 5 max
- WebSearch calls per sub-question: 3 max
- WebFetch calls total: 5 max
- youtube-transcript calls per URL: 1 max

Exceeding a cap: stop and return partial results with a `caps_hit` footer listing which cap was reached and what remained unexplored. Caps are observable in the final report's Methodology section. A partial report with transparency beats a complete-looking report built on inference.
