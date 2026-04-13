---
description: Forge session observations into tempered instincts via unified pipeline with preview gate
skills: [continuous-learning-v2]
---

## Purpose

Forge observations from the current session into high-confidence instincts. Runs a single deep pipeline with one approval gate — no subcommands, no granular escape valves except `--dry-run` and `export`. Mirrors the `/medik` idiom (diagnose + repair in one pass with a single gate).

`/forge` is the verb; `instincts` is the noun. The SQL table and data-layer terminology stay "instinct" — only the command is renamed. See ADR-005 for the full design.

## Arguments

- (none) — run the full pipeline with approval gate
- `--dry-run` — run steps 1–6 and print what WOULD happen, but make NO database writes
- `export` — serialize active instincts for the current project to a JSON file (Sprint E preview — shape may change)

No other flags. No positional arguments.

## Pipeline

`/forge` runs the following steps in order. Nothing is mutated until the gate (step 6) is approved.

1. **Read** — load the session's observations JSONL from `$TEMP/kadmon/<sessionId>/observations.jsonl`.
2. **Extract** — run `pattern-engine.evaluatePatterns` against `.claude/hooks/pattern-definitions.json` to find triggered patterns.
3. **Reinforce / Create** — for each triggered pattern, project in memory: reinforce existing instinct (`confidence += 0.1`, `occurrences++`) or create fresh (`confidence: 0.3`). **Never touches the DB.**
4. **Evaluate** — compute promote/prune recommendations on the projected state using thresholds from `instinct-manager.ts`:
   - **Promote** when `confidence >= 0.7 AND occurrences >= 3` (active only)
   - **Prune** when `contradictions > occurrences` OR `(confidence < 0.2 AND occurrences < 2)`
5. **Cluster** — group active instincts by shared `domain` into a `ClusterReport` (typed, see `scripts/lib/types.ts`). Singletons land in `unclustered`. Report is computed each run, not stored in SQL.
6. **Preview Gate** — render a single table:
   - Rows to create, reinforce, promote, prune
   - Cluster report summary (count, dominant domains, suggested categories)
   - Totals and expected state deltas
   - Wait for user approval. Reject aborts with no mutation.
7. **Apply** — on approval, call `applyForgePreview`. This is the ONLY function in the pipeline that writes to SQL (via `upsertInstinct`). Then write the cluster report JSON to `~/.kadmon/forge-reports/forge-clusters-<sessionId>.json` for future `/evolve` step 6 consumption. Prune old reports (keep last 20).
8. **Report** — print what actually changed and surface the cluster report path.

## Implementation

Invoked via the TypeScript pipeline in `scripts/lib/forge-pipeline.ts`:

```typescript
import { runForgePipeline, applyForgePreview } from "./scripts/lib/forge-pipeline.js";
import { writeClusterReport, pruneOldReports } from "./scripts/lib/forge-report-writer.js";

const preview = await runForgePipeline({ projectHash, sessionId, dryRun: false });
// show preview.would and preview.clusterReport summary, wait for user OK
applyForgePreview(preview, { projectHash, sessionId });
writeClusterReport(preview.clusterReport);
pruneOldReports(path.join(os.homedir(), ".kadmon", "forge-reports"));
```

For `--dry-run` mode, call `runForgePipeline({ ..., dryRun: true })` and skip `applyForgePreview` and `writeClusterReport` entirely. For `export`, call `exportInstinctsToJson(projectHash, destPath)` from `forge-report-writer.ts`.

## Preview gate format

```
## /forge preview — session sess-abc123

### Would create (1)
| pattern                          | initial confidence |
|----------------------------------|--------------------|
| Use Zod for validation           | 0.3                |

### Would reinforce (2)
| pattern                          | before | after |
|----------------------------------|--------|-------|
| Read files before editing them   | 0.5    | 0.6   |
| Test after implementing changes  | 0.7    | 0.8   |

### Would promote (1)
| pattern                          | confidence | occurrences |
|----------------------------------|------------|-------------|
| Test after implementing changes  | 0.8        | 4           |

### Would prune (0)
(none)

### Cluster report
2 clusters, 1 unclustered.
- workflow (3 members, suggested PROMOTE)
- typescript (2 members, suggested CREATE_RULE)

### Totals
create: 1  reinforce: 2  promote: 1  prune: 0

Apply? [y/N]
```

## Example

```
> /forge
## /forge preview — session sess-20260413
Would create: 0
Would reinforce: 3 (Read files before editing them, Test after implementing changes, Verify before committing code)
Would promote: 1 (Commit before pushing → confidence 0.9, occurrences 77)
Would prune: 0

Cluster report: 2 clusters
- workflow (4 members, PROMOTE)
- git (2 members, PROMOTE)

Apply? [y/N] y

Applied:
- reinforced: 3
- promoted: 1
- pruned: 0
Cluster report written to ~/.kadmon/forge-reports/forge-clusters-sess-20260413.json

> /forge --dry-run
## /forge dry-run — session sess-20260413
(same preview output, but no mutation, no file written)

> /forge export
Exported 11 active instincts to instincts-export-9444ca5b-2026-04-13.json
(project_hash: 9444ca5b, schema_version: 1 preview)
```

## See also

- ADR-005: `docs/decisions/ADR-005-forge-evolve-pipeline.md`
- Plan: `docs/plans/plan-005-forge-evolve-pipeline.md`
- Implementation: `scripts/lib/forge-pipeline.ts`, `scripts/lib/forge-report-writer.ts`
- Contract for `/evolve` step 6: `ClusterReport` interface in `scripts/lib/types.ts`
- Deprecation: `/instinct` is retained as a deprecated alias until 2026-04-20 (see `.claude/commands/instinct.md`).
