# docs/insights/

Archive of `/insights` reports — Claude Code's built-in usage analytics, condensed into readable markdown for trend analysis over time.

## Why this folder exists

`/insights` generates an interactive HTML + JSON report at `~/.claude/usage-data/report.html` every time it runs. That file lives outside the repo, is not versioned, and the raw JSON (~15KB) is impractical to read as a flat file.

This folder keeps a **curated** archive of the ones worth preserving, rewritten as scannable markdown so you can:
- Read them in GitHub / VS Code without launching the HTML
- Grep across past reports (`grep -r "TDD" docs/insights/`)
- Track how your workflow evolves over time
- Surface recurring frictions/wins across snapshots

## How to archive a new report

1. Run `/insights` in Claude Code
2. Read the generated report (HTML or `/insights` output in chat)
3. Ask me: **"guarda el insights"** (or open a session, reference the JSON, tell me to archive it)
4. I convert the JSON to a `YYYY-MM-DD-insights.md` file following the template below
5. Commit with tier `skip` (docs-only, no runtime change)

**Manual by design.** Not every `/insights` run deserves an archive — short periods (a handful of sessions) rarely carry signal. Archive when the period covers ≥20 sessions or when something notably changed (new tooling, big shift in friction patterns).

## Naming convention

```
docs/insights/YYYY-MM-DD-insights.md
```

Date-first because snapshots are periodic, not counter-monotonic (unlike ADRs/plans). Sort order is naturally chronological.

## Report structure

Every report follows this skeleton (~250 lines target; aggressive compression vs the raw ~500-line JSON):

```
---
date: YYYY-MM-DD
period_from: YYYY-MM-DD
period_to: YYYY-MM-DD
sessions_total: N
sessions_analyzed: N
messages: N
hours: N
commits: N
source: ~/.claude/usage-data/report.html (snapshot archived YYYY-MM-DD)
---

# Claude Code Insights — YYYY-MM-DD

## TL;DR
Wins (3) / Frictions (3) / Quick wins (3) — single-line bullets

## What's Working
3 narrative paragraphs

## Where Things Go Wrong
3 friction categories with concrete examples

## Quick Wins to Try
Copyable prompts in code-fences

## On the Horizon
Opportunity titles + one-liners (full prompts stay in the HTML)

## Raw Data
Link to ~/.claude/usage-data/report.html
```

## Policy

- **Frequency**: monthly-ish. No hard cadence — archive when signal is high.
- **Retention**: keep all archived reports indefinitely. Small markdown files, cheap storage, historical value grows with time.
- **No automation**: conversion is manual by design. You filter what's worth archiving.
- **No emojis**: per `~/.claude/CLAUDE.md` Personal Preferences.

## Index

<!-- Add newest first -->
- [2026-04-17-insights.md](./2026-04-17-insights.md) — 97 sessions (38 analyzed), 2026-03-25 to 2026-04-17, 58h, 62 commits
