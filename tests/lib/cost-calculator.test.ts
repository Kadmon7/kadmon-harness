import { describe, it, expect } from 'vitest';
import { calculateCost, formatCost } from '../../scripts/lib/cost-calculator.js';

describe('cost-calculator', () => {
  it('calculates haiku pricing correctly', () => {
    const r = calculateCost('haiku', 1_000_000, 1_000_000);
    expect(r.inputCostUsd).toBeCloseTo(0.8);
    expect(r.outputCostUsd).toBeCloseTo(4.0);
    expect(r.totalCostUsd).toBeCloseTo(4.8);
  });

  it('calculates sonnet pricing correctly', () => {
    const r = calculateCost('sonnet', 1_000_000, 1_000_000);
    expect(r.inputCostUsd).toBeCloseTo(3.0);
    expect(r.outputCostUsd).toBeCloseTo(15.0);
    expect(r.totalCostUsd).toBeCloseTo(18.0);
  });

  it('calculates opus pricing correctly', () => {
    const r = calculateCost('opus', 1_000_000, 1_000_000);
    expect(r.inputCostUsd).toBeCloseTo(15.0);
    expect(r.outputCostUsd).toBeCloseTo(75.0);
    expect(r.totalCostUsd).toBeCloseTo(90.0);
  });

  it('handles full model names', () => {
    const r = calculateCost('claude-opus-4-6', 500_000, 100_000);
    expect(r.inputCostUsd).toBeCloseTo(7.5);
    expect(r.outputCostUsd).toBeCloseTo(7.5);
  });

  it('falls back to sonnet pricing for unknown models', () => {
    const r = calculateCost('unknown-model', 1_000_000, 1_000_000);
    expect(r.totalCostUsd).toBeCloseTo(18.0);
  });

  it('handles zero tokens', () => {
    const r = calculateCost('sonnet', 0, 0);
    expect(r.totalCostUsd).toBe(0);
  });

  it('formats cost with 4 decimal places', () => {
    expect(formatCost(0.0042)).toBe('$0.0042');
    expect(formatCost(1.5)).toBe('$1.5000');
    expect(formatCost(0)).toBe('$0.0000');
  });
});
