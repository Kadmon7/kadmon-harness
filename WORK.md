# WORK — in flight right now

First read for any new session (including parallel sessions — see CORRECTIONS.md C-002:
note here what you are touching before you touch it).

## Active

- **2026-07-12 — Full harness audit (6 parallel agents) + Wave 1 (P0) LANDED.** Report: `docs/insights/2026-07-12-full-harness-audit.md` (local-only, docs/insights/ is gitignored). Findings in `BACKLOG.md` (AUD-01..AUD-30). Wave 1 shipped AUD-01..08 through the full /chekpoint tier: 3 Phase 2a reviewers (spektr APPROVE — original MEDIUM closed; typescript-reviewer APPROVE-with-notes; orakle APPROVE) + all reviewer WARNs applied (dirty-flag disk writes, anomalous-pairing logging, scrub-order + free-text scrub) + kody GO. Suite 1158 tests / 90 files green. Next: Wave 2 (AUD-09..23) pending user go.

## In flight elsewhere

- **plan-036 Sentinel-harness fork** — executing in sibling repo `C:\Command-Center\Sentinel-harness` (11 commits, 2026-06-24 through 2026-07-03; Phases 0-1+ done). Kadmon-side status flip pending (BACKLOG AUD-08). Sentinel keeps its own decisions dir per ADR-036 §5.

## Landed but unreleased (CHANGELOG [Unreleased] pending — AUD-17)

- `f912181` feat(skills): fable-prompt (also broke the skill-count contract test — AUD-01)
- `29d24f3` fix(medik): skill-creator probe via installed_plugins.json (closes roadmap R-11)
- `4415674` graphify UserPromptSubmit reminder hook in `.claude/settings.json` (uncataloged — AUD-17)

## Known-red state on main

- Deterministic failure (`manifest-schema.test.ts:341`) FIXED in Wave 1 (AUD-01). Remaining: 4 flaky hook tests (AUD-21 — pre-compact-save x2, session-end-all x2), pass in isolation.

Last updated: 2026-07-12
