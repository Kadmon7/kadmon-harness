---
description: Multi-source deep research — web, YouTube transcripts, PDFs. Detects input type and synthesizes cited reports.
agent: kerka
skills: [deep-research]
---

## Purpose
Run deep multi-source research over web pages, YouTube transcripts, and PDFs. Closes the chain-rule gap on the `deep-research` skill, which previously had no executor (see ADR-009). Use this instead of raw WebSearch when the topic needs synthesis, citations, or cross-source verification.

## Arguments
- `<topic>` — free-text research query (e.g., `/research current state of pgvector HNSW vs IVFFlat indexing`)
- `<youtube-url>` — a single YouTube URL; kerka extracts the transcript via yt-dlp and synthesizes from it (e.g., `/research https://www.youtube.com/watch?v=<id>`)
- `<pdf-url>` or `<arxiv-url>` — a PDF or arXiv paper URL; kerka fetches and summarizes
- `<topic with url>` — mixed free-text with one or more URLs; kerka treats URLs as primary sources and uses search to fill gaps

## Steps
1. Invoke kerka agent with the raw argument
2. kerka classifies input and chooses Route A (YouTube), B (PDF/arXiv), or C (general deep-research workflow)
3. kerka executes the `deep-research` skill's Steps 2–6 (with Route A/B shortcuts) under the execution caps from ADR-009 D5
4. kerka returns a cited report with TL;DR, themes, key takeaways, sources list, and Methodology footer

## Output
- **Short reports** (under ~800 lines): posted inline in chat
- **Long reports**: post Executive Summary + Key Takeaways + Sources inline; offer to save the full report to a user-confirmed path (never auto-write)
- Every non-trivial claim carries an inline citation
- Methodology footer shows search/fetch/transcript counts and any `caps_hit` events

## Prerequisites
- For YouTube transcripts: `yt-dlp` must be on PATH. Install with `winget install yt-dlp` (Windows), `brew install yt-dlp` (macOS), or `pip install yt-dlp` (cross-platform). If missing, kerka degrades gracefully and continues with WebFetch metadata.
- For general research: no prerequisites — WebSearch and WebFetch are always available.

## Examples

### Example 1: General query (Route C)
```
User: /research current state of pgvector HNSW vs IVFFlat indexing

Result:
## Research: pgvector HNSW vs IVFFlat [kerka]

### TL;DR
HNSW gives better recall and lower latency for most workloads; IVFFlat uses
less memory and indexes faster but requires retraining on data shifts. Choose
HNSW unless memory-bound.

### 1. Performance
...citations...

### Sources
1. [pgvector README](https://github.com/pgvector/pgvector) — index trade-offs
2. ...

### Methodology
Searched 8 queries / fetched 4 URLs / 0 transcripts.
Caps hit: none
Confidence: High
```

### Example 2: YouTube URL (Route A)
```
User: /research https://www.youtube.com/watch?v=<id>

Result:
## Research: [Video Title] [kerka]

### TL;DR
[3-sentence summary of the talk]

### Sources
1. [Video Title (YouTube)](https://www.youtube.com/watch?v=<id>) — auto-subs, en

### Methodology
Searched 0 queries / fetched 0 URLs / 1 transcript (source: auto-subs).
Confidence: Medium (single-source)
```

### Example 3: Comparison query
```
User: /research compare ragas vs deepeval for RAG evaluation

Result: side-by-side comparison with sub-questions per tool, cited docs
from both projects, and a recommendation table.
```
