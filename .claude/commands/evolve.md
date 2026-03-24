---
description: Run harness self-optimization analysis
---

## Purpose
Invoke harness-optimizer agent to analyze harness health and propose improvements.

## Steps
1. Invoke harness-optimizer agent (sonnet)
2. Analyze: hook latency from recent sessions
3. Analyze: instinct quality (confidence distribution, contradictions)
4. Identify: unused or underperforming skills
5. Identify: cost trends across sessions
6. Produce optimization report with recommendations
7. NEVER auto-apply changes — recommendations only

## Output
Optimization report with actionable recommendations and expected impact.