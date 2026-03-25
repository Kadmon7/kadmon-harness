---
name: daily-research
description: Deep research methodology for staying current with AI, Claude Code, Anthropic ecosystem, and Kadmon project technologies. Use when performing daily intelligence briefings, trend analysis, or technology monitoring.
---

# Daily Research Skill

## When to Use
- Running the daily intelligence briefing
- Researching new features or tools before implementing
- Evaluating whether a new tool/framework is relevant to Kadmon
- Preparing recommendations for Harness, ToratNetz, or KAIRON

## How It Works

### Phase 1: Signal Detection (Observe)
Search broadly first — cast a wide net:
```
"claude code" site:github.com — new repos last 7 days
"claude code" — news last 24h
anthropic — blog last 7 days
supabase — updates last 7 days
[channel name] youtube — videos last 7 days
```

### Phase 2: Source Verification (Verify)
For each finding:
1. Check official source (not just secondhand reports)
2. Cross-reference with at least one other source
3. Check publication date — must be recent (last 7 days max)
4. Evaluate relevance to Kadmon specifically

### Phase 3: Synthesis (Specialize)
Transform raw findings into intelligence:
- What is this? (1 sentence)
- Why does it matter for Kadmon? (1-2 sentences)
- What should we do about it? (concrete action or skip)
- Urgency: High / Medium / Low

### Phase 4: Report Generation (Remember)
Save structured report to:
`docs/research/YYYY-MM-DD.md`

Always include:
- Date and sources checked
- Top 3-5 actionable signals
- Full findings by category
- Explicit action items for each active project

## Rules
- NEVER report information older than 7 days as "new"
- ALWAYS link to original source
- NEVER summarize without reading the original
- PREFER official sources over aggregators
- Flag when a source was unreachable (no_context)
- Keep report under 500 lines — quality over quantity

## Kadmon Context
Always filter findings through these projects:
- **Kadmon Harness** — new hooks, agents, skills, memory patterns
- **ToratNetz** — RAG improvements, pgvector, Hebrew text processing
- **KAIRON** — React Native, AI companions, ElevenLabs voice

## Output
Structured markdown report saved to docs/research/YYYY-MM-DD.md
Brief summary printed to terminal with top 3 signals.

## no_context Application
If a source is unreachable or has no recent updates, report `no_context: [source] — no updates found in last 48h`. Never fabricate information to fill a section.
