# `docs/` — Kadmon Harness documentation

Navigation guide for everything the harness documents that is not code. Each subdirectory has its own purpose; this file tells you which one to open.

## Subdirectories

| Dir | What's in it | When you need it |
|---|---|---|
| [`decisions/`](./decisions/) | **26 ADRs** — immutable architectural decisions with context, options, and consequences | "Why is the code structured this way?" / "Why was X rejected?" |
| [`plans/`](./plans/) | **19 implementation plans** — one per multi-step feature, referenced by commits and ADRs | "What was the scope and order of changes for feature Y?" |
| [`roadmap/`](./roadmap/) | **4 milestone docs** (v1.0, v1.1, v1.2.4, v2.0) with status + sprint breakdown | "What's shipped, shipping next, and deferred?" |
| [`onboarding/`](./onboarding/) | Entry points for new projects consuming the harness + troubleshooting | "How do I install this?" / "Something's broken, where's the checklist?" |
| [`research/`](./research/) | `/skavenger` reports with citations (external web, papers, transcripts) | "What have we already investigated about X?" (don't re-research) |
| [`insights/`](./insights/) | Curated `/insights` snapshots — architect's workflow analytics over time | "How has the way I work with Claude evolved?" (personal reflection) |
| [`genesis/`](./genesis/) | Foundational document — why the harness exists, original vision | "What was the original mission this project inherits from?" |

## Reading order for a new collaborator

If you are new to the harness, open in this order:

1. **Root [`README.md`](../README.md)** — install steps, what the harness is, what commands exist
2. **[`onboarding/CLAUDE.template.md`](./onboarding/CLAUDE.template.md)** — template for the `CLAUDE.md` you'll drop into your own project
3. **[`onboarding/reference_kadmon_harness.md`](./onboarding/reference_kadmon_harness.md)** — catalog of agents / skills / commands / hooks for your project's memory dir
4. **[`onboarding/TROUBLESHOOTING.md`](./onboarding/TROUBLESHOOTING.md)** — the 3 install bugs observed in real dogfood + a 6-step systematic checklist
5. **[`genesis/genesis.md`](./genesis/genesis.md)** — optional context on what the harness is trying to be
6. **[`decisions/`](./decisions/)** — browse by number when a commit or agent references `ADR-NNN`; immutable once `accepted`

## Reading order for an existing collaborator

When you are working on the harness itself:

1. **[`roadmap/`](./roadmap/)** — what's on deck, what's in flight, what's deferred
2. **[`plans/`](./plans/)** — the current plan file is the authoritative scope for the feature in flight
3. **[`decisions/`](./decisions/)** — review the ADRs relevant to the area you are touching
4. **[`research/`](./research/)** — check here before spawning `/skavenger` for something that might already be answered
5. **[`insights/`](./insights/)** — useful for retrospectives; not consulted during routine feature work

## Conventions

- **ADRs are immutable once `accepted`**. To revise a decision, write a new ADR that supersedes the old one; do not edit accepted ADRs.
- **Plans are work artifacts**. They are written before a sprint, updated during, and preserved after — they document the path taken, not the "current state". The current state lives in code + CHANGELOG + roadmap.
- **Research reports are append-only**. `/skavenger` writes new `research-NNN-<slug>.md` files; existing reports are not edited retroactively.
- **Naming**: `ADR-NNN-<slug>.md`, `plan-NNN-<slug>.md`, `research-NNN-<slug>.md` — all 3-digit zero-padded, monotonically increasing.

## Cross-references elsewhere in the repo

- **[`CHANGELOG.md`](../CHANGELOG.md)** — user-facing release notes. Entries reference ADRs for rationale and plans for scope.
- **[`.claude/rules/common/`](../.claude/rules/common/)** — operational rules auto-loaded by Claude Code. These reference ADRs to explain why a rule exists.
- **[`.claude/skills/architecture-decision-records/SKILL.md`](../.claude/skills/architecture-decision-records/SKILL.md)** — how to write a new ADR (invoked by agents via the Skill tool).
