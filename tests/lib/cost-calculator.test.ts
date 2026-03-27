import { describe, it, expect } from 'vitest';
import { calculateCost, formatCost, estimateCharsPerToken } from '../../scripts/lib/cost-calculator.js';

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

  describe('estimateCharsPerToken', () => {
    it('returns 4.0 for empty string', () => {
      expect(estimateCharsPerToken('')).toBe(4.0);
    });

    it('returns 4.0 for plain prose', () => {
      expect(estimateCharsPerToken('hello world this is plain text with no symbols here')).toBe(4.0);
    });

    it('returns 4.0 when codeRatio is exactly 0.05 (boundary)', () => {
      const content = '{' + 'a'.repeat(19); // 1/20 = 0.05, NOT above threshold
      expect(estimateCharsPerToken(content)).toBe(4.0);
    });

    it('returns 3.0 when codeRatio is just above 0.05', () => {
      const content = '{}' + 'a'.repeat(18); // 2/20 = 0.10
      expect(estimateCharsPerToken(content)).toBe(3.0);
    });

    it('returns 3.0 for code-heavy content', () => {
      expect(estimateCharsPerToken('function add(a, b) { return a + b; }')).toBe(3.0);
    });

    it('returns 3.0 for a single code character', () => {
      expect(estimateCharsPerToken('{')).toBe(3.0);
    });

    it('counts all 8 code character types', () => {
      expect(estimateCharsPerToken('{}[]();=')).toBe(3.0);
    });

    it('returns 4.0 for whitespace only', () => {
      expect(estimateCharsPerToken('   \n\t  ')).toBe(4.0);
    });
  });
});
