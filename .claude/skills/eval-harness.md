---
name: eval-harness
description: Use when evaluating agent or skill quality through structured evaluation criteria — /eval command, pre-promotion checks, regression detection
---

# Eval Harness

Structured evaluation framework for measuring agent and skill effectiveness in the Kadmon stack.
All scores derive from measurable criteria applied to actual agent output — never subjective impression.

## When to Use
- When `/eval` command is invoked
- Before promoting an instinct (confidence >= 0.7 check)
- After modifying an agent definition or skill file
- Regression detection after harness updates
- Comparing two agent versions side-by-side

## Core Types

```typescript
interface EvalCase {
  name: string;
  input: { prompt: string; context?: string };
  expected: { contains?: string[]; format?: string; maxTokens?: number };
  criteria: EvalCriterion[];
}

interface EvalCriterion {
  name: string;
  check: 'contains' | 'format' | 'accuracy' | 'no_hallucination';
  weight: number; // weights across all criteria in a case must sum to 1.0
}

interface EvalResult {
  caseName: string;
  score: number;       // 1–5
  passed: boolean;     // score >= 3
  criteriaResults: CriterionResult[];
  runAt: string;       // ISO 8601
}

interface CriterionResult {
  criterion: EvalCriterion;
  passed: boolean;
  evidence: string;    // exact substring or pattern that matched/failed
}
```

## Scoring Rubric (1–5)

| Score | Label      | Threshold | Meaning |
|-------|------------|-----------|---------|
| 5     | Excellent  | >= 95%    | All criteria met; output is precise, cited, and well-formatted |
| 4     | Good       | >= 80%    | Most criteria met; minor gaps in coverage or format |
| 3     | Acceptable | >= 60%    | Core criteria met; acceptable for production with monitoring |
| 2     | Poor       | >= 40%    | Key criteria failed; needs agent or skill revision |
| 1     | Fail       | < 40%     | Fundamental failure; block promotion or deployment |

Pass threshold: score >= 3 (60%+ weighted criteria met).
Promotion threshold: score >= 4 on at least 3 consecutive runs.

## Example Eval Cases

### Case 1 — code-reviewer agent response quality

```typescript
const codeReviewerEval: EvalCase = {
  name: "code-reviewer: severity levels and file citations",
  input: {
    prompt: "Review this TypeScript file for issues",
    context: "src/lib/instinct-manager.ts — contains any cast and missing return type"
  },
  expected: {
    contains: ["BLOCK", "WARN", "NOTE", "instinct-manager.ts"],
    format: "markdown sections with severity prefix"
  },
  criteria: [
    { name: "includes_severity_levels", check: "contains", weight: 0.35 },
    { name: "cites_file_and_line",      check: "contains", weight: 0.30 },
    { name: "no_hallucinated_symbols",  check: "no_hallucination", weight: 0.20 },
    { name: "markdown_structure",       check: "format", weight: 0.15 }
  ]
};
```

### Case 2 — instinct promotion logic

```typescript
const instinctPromotionEval: EvalCase = {
  name: "instinct promotion: confidence threshold and pattern matching",
  input: {
    prompt: "Should instinct 'always-read-before-edit' be promoted?",
    context: "instinct confidence: 0.82, reinforced 7 times, pattern: no_context_guard_triggered"
  },
  expected: {
    contains: ["promote", "0.7", "confidence", "reinforced"],
    format: "decision with numeric justification"
  },
  criteria: [
    { name: "references_threshold",    check: "contains", weight: 0.40 },
    { name: "cites_reinforcement_count", check: "accuracy", weight: 0.30 },
    { name: "no_hallucinated_instincts", check: "no_hallucination", weight: 0.20 },
    { name: "clear_promote_decision",   check: "format", weight: 0.10 }
  ]
};
```

### Case 3 — docs-lookup accuracy (Context7)

```typescript
const docsLookupEval: EvalCase = {
  name: "docs-lookup: Context7 usage and source citation",
  input: {
    prompt: "How do I use Zod .safeParse() with discriminated unions?",
    context: "no prior context loaded"
  },
  expected: {
    contains: ["safeParse", "discriminatedUnion", "context7", "zod"],
    maxTokens: 600
  },
  criteria: [
    { name: "uses_context7_tool",    check: "contains", weight: 0.35 },
    { name: "cites_library_version", check: "accuracy", weight: 0.25 },
    { name: "correct_api_shape",     check: "accuracy", weight: 0.30 },
    { name: "within_token_budget",   check: "format",   weight: 0.10 }
  ]
};
```

## Output Report Format

Results are rendered as a markdown table per eval run:

| Case | Score | Passed | Criteria Met | Top Failure | Run At |
|------|-------|--------|--------------|-------------|--------|
| code-reviewer: severity levels | 4/5 | yes | 3/4 | markdown_structure (0.15) | 2026-03-26T10:00Z |
| instinct promotion: confidence | 5/5 | yes | 4/4 | — | 2026-03-26T10:01Z |
| docs-lookup: Context7 accuracy | 3/5 | yes | 2/4 | cites_library_version (0.25) | 2026-03-26T10:02Z |

**Run summary:** 3/3 passed | Avg score: 4.0 | Lowest: docs-lookup (3/5)

## Rules

### MUST
- MUST define all `EvalCriterion` entries with measurable `check` types before running
- MUST include at least 3 test cases per evaluation run
- MUST record `runAt` timestamp for every result (regression tracking)
- MUST track eval results over time — store in SQLite via `state-store.ts` session events
- MUST weight all criteria in a case so weights sum to 1.0

### NEVER
- NEVER score subjectively — every criterion must have a `check` type from the union
- NEVER modify the agent definition, skill file, or prompt template during an active evaluation
- NEVER promote an instinct or skill based on a single eval run
- NEVER skip `no_hallucination` checks on agents that cite file paths or symbol names
- NEVER reuse eval cases across different agents without adjusting `expected.contains`

## Workflow

1. **Define** — write `EvalCase[]` for the target agent or skill
2. **Baseline** — run against current version, record scores
3. **Modify** — make changes to agent/skill/instinct
4. **Re-eval** — run same cases again
5. **Compare** — regression if any score drops by >= 1 point
6. **Promote** — only if avg score >= 4 across >= 3 runs

## no_context Application

Eval scores are evidence-based: a criterion passes only when `evidence` field contains the
actual substring or pattern match from agent output. If no evidence exists, the criterion
fails — `no_context` applies to eval just as it does to code edits.

When the agent cites a file, symbol, or library version, always cross-check against the
actual codebase or Context7 source before marking `no_hallucination` as passed.
