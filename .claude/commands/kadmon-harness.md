---
description: Show the Kadmon Harness dashboard — instincts, sessions, costs, hook health
---

## Purpose
Display a visual dashboard of the harness state: active instincts (with promotable markers), recent sessions (filtered, with duration), cost breakdown by model, and hook health status.

## Steps
1. Run: `npx tsx scripts/dashboard.ts`
2. Display the output to the user

## Output
ANSI-colored dashboard with 4 sections: Instincts (with inline promotable markers), Sessions (filtered + duration), Cost Summary (by model), Hook Health.

## Example
```
╔══════════════════════════════════════╗
║       KADMON HARNESS DASHBOARD       ║
╚══════════════════════════════════════╝

── INSTINCTS (15 active | 10 promotable) ──
  [█████████░] 0.9  Check dashboard for system health (12x) → /instinct promote
  [█████████░] 0.9  Build after editing TypeScript (15x) → /instinct promote
  [███░░░░░░░] 0.3  Research before building (1x)

── SESSIONS ──
  Date        Branch              Files  Msgs  Cmps  Duration  Cost
  2026-03-30  main                   12   640     2        —  $4.52  *
  2026-03-29  main                    6    87     0    1h 30m  $0.45
  * = live session

── COST SUMMARY ──
  Model              Sessions  Tokens In  Tokens Out   Cost
  claude-opus-4             3      450.2K     125.3K  $3.20
  claude-sonnet-4           8      280.1K      95.4K  $0.85
  ──────────────────────────────────────────────────────────
  Total                                                $4.05

── HOOK HEALTH ──
  Tool            Total  Fail  Status
  Read               62     0  OK
  Edit               14     0  OK
  ExitPlanMode        8     0  OK
```
