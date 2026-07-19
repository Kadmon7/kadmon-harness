# Lib Cluster

> 8 nodes

## Key Concepts

- **cost-calculator.ts** (8 connections) — `scripts/lib/cost-calculator.ts`
- **cost-calculator.test.ts** (4 connections) — `tests/lib/cost-calculator.test.ts`
- **calculateCost()** (3 connections) — `scripts/lib/cost-calculator.ts`
- **resolvePricing()** (2 connections) — `scripts/lib/cost-calculator.ts`
- **formatCost()** (2 connections) — `scripts/lib/cost-calculator.ts`
- **estimateCharsPerToken()** (2 connections) — `scripts/lib/cost-calculator.ts`
- **CostResult** (2 connections) — `scripts/lib/types.ts`
- **MODEL_PRICING** (1 connections) — `scripts/lib/cost-calculator.ts`

## Relationships

- [Shared Type Definitions](Shared_Type_Definitions.md) (2 shared connections)

## Source Files

- `scripts/lib/cost-calculator.ts`
- `scripts/lib/types.ts`
- `tests/lib/cost-calculator.test.ts`

## Audit Trail

- EXTRACTED: 24 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*