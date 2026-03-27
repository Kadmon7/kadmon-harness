import type { CostResult } from './types.js';

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'opus': { input: 15, output: 75 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'sonnet': { input: 3, output: 15 },
  'claude-haiku-4': { input: 0.8, output: 4 },
  'haiku': { input: 0.8, output: 4 },
};

const DEFAULT_PRICING = MODEL_PRICING['sonnet'];

function resolvePricing(model: string): { input: number; output: number } {
  const normalized = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalized.includes(key)) return pricing;
  }
  return DEFAULT_PRICING;
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): CostResult {
  const pricing = resolvePricing(model);
  const inputCostUsd = (inputTokens / 1_000_000) * pricing.input;
  const outputCostUsd = (outputTokens / 1_000_000) * pricing.output;

  return {
    model,
    inputTokens,
    outputTokens,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

const CODE_CHARS = /[{}\[\]();=]/g;

export function estimateCharsPerToken(content: string): number {
  if (content.length === 0) return 4.0;
  const codeChars = (content.match(CODE_CHARS) ?? []).length;
  const codeRatio = codeChars / content.length;
  return codeRatio > 0.05 ? 3.0 : 4.0;
}
