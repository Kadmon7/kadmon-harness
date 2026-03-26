---
description: Show the Kadmon Harness dashboard — instincts, sessions, costs, hook health
---

## Purpose
Display a visual dashboard of the harness state: active instincts with confidence bars, recent sessions, cost breakdown, and hook health status.

## Steps
1. Run: `npx tsx scripts/dashboard.ts`
2. Display the output to the user

## Output
ANSI-colored dashboard with 4 sections: Instincts, Sessions, Costs, Hook Health.

## Example
```
╔══════════════════════════════════════╗
║       KADMON HARNESS DASHBOARD       ║
╚══════════════════════════════════════╝

── INSTINCTS ──
  [███████░░░] 0.7  Read files before editing (5x)
  [████░░░░░░] 0.4  Batch related edits (2x)

── SESSIONS ──
  Date        Branch                 Files  Cost
  2026-03-26  main                       6  $0.45

── COSTS ──
  Date        Session          Events  Cost
  2026-03-26  769d4b01-83e5        2  $0.01

── HOOK HEALTH ──
  Tool       Total  Fail  Status
  Read          62     0  OK
  Edit          14     0  OK
```
