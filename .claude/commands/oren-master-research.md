---
description: Run Oren Master Research — daily intelligence briefing covering Claude Code updates, YouTube channels, GitHub repos, AI tools, and Kadmon project-specific insights. Generates structured report in docs/research/YYYY-MM-DD.md
---

## Purpose
Invoke Oren to run the full daily intelligence briefing.
Covers all monitored sources and generates an actionable report.

## Steps
1. Invoke Oren agent with daily-research skill
2. Search all monitored YouTube channels for new videos (last 48h)
3. Check official sources: Anthropic, Supabase, ElevenLabs
4. Scan GitHub repos for new releases and trending activity
5. Search AI news and developer blogs
6. Synthesize findings filtered through Kadmon projects
7. Generate report: docs/research/YYYY-MM-DD.md
8. Print top 3 signals to terminal

## Output
- Full report saved to docs/research/YYYY-MM-DD.md
- Terminal summary with top signals
- Action items per project (Harness, ToratNetz, KAIRON)

## Usage
```
/oren-master-research
```

Or with a specific focus:
```
/oren-master-research focus: claude code new features
/oren-master-research focus: supabase pgvector updates
/oren-master-research focus: KAIRON react native
```

## Scheduled Task Setup
To run automatically every day at 8:00am:

In Claude Desktop app:
1. Click "Scheduled" in left sidebar
2. Click "+ New task"
3. Name: "Oren Daily Research"
4. Prompt: "Run /oren-master-research and save the report"
5. Schedule: Daily at 8:00am
6. Working folder: C:\Proyectos Kadmon\Kadmon-Harness
7. Save

The report will be ready when you open Claude Code each morning.
