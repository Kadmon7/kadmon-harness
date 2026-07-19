# Pattern Detection Engine

> 20 nodes

## Key Concepts

- **pattern-engine.ts** (17 connections) — `scripts/lib/pattern-engine.ts`
- **evaluatePatterns()** (11 connections) — `scripts/lib/pattern-engine.ts`
- **pattern-engine.test.ts** (9 connections) — `tests/lib/pattern-engine.test.ts`
- **pattern-engine-file-sequence.test.ts** (6 connections) — `tests/lib/pattern-engine-file-sequence.test.ts`
- **pattern-engine-tool-arg-presence.test.ts** (6 connections) — `tests/lib/pattern-engine-tool-arg-presence.test.ts`
- **PatternDefinition** (5 connections) — `scripts/lib/types.ts`
- **extractCandidates()** (4 connections) — `scripts/lib/forge-pipeline.ts`
- **matchGlob()** (4 connections) — `scripts/lib/pattern-engine.ts`
- **detectFileSequencePattern()** (4 connections) — `scripts/lib/pattern-engine.ts`
- **loadPatternDefinitions()** (4 connections) — `scripts/lib/pattern-engine.ts`
- **detectSequence()** (3 connections) — `scripts/lib/pattern-engine.ts`
- **detectCommandSequence()** (3 connections) — `scripts/lib/pattern-engine.ts`
- **detectToolArgPresencePattern()** (3 connections) — `scripts/lib/pattern-engine.ts`
- **detectCluster()** (3 connections) — `scripts/lib/pattern-engine.ts`
- **PatternResult** (3 connections) — `scripts/lib/types.ts`
- **normalizePath()** (2 connections) — `scripts/lib/pattern-engine.ts`
- **globToRegExp()** (2 connections) — `scripts/lib/pattern-engine.ts`
- **fileSeqLine()** (1 connections) — `tests/lib/pattern-engine-file-sequence.test.ts`
- **argLine()** (1 connections) — `tests/lib/pattern-engine-tool-arg-presence.test.ts`
- **ADR-0006** (1 connections) — `tests/lib/pattern-engine.test.ts`

## Relationships

- [Forge Pipeline](Forge_Pipeline.md) (6 shared connections)
- [Shared Type Definitions](Shared_Type_Definitions.md) (6 shared connections)

## Source Files

- `scripts/lib/forge-pipeline.ts`
- `scripts/lib/pattern-engine.ts`
- `scripts/lib/types.ts`
- `tests/lib/pattern-engine-file-sequence.test.ts`
- `tests/lib/pattern-engine-tool-arg-presence.test.ts`
- `tests/lib/pattern-engine.test.ts`

## Audit Trail

- EXTRACTED: 92 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*