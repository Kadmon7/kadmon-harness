// Kadmon Harness — Cost Calculator
// Phase: v1 scaffold — implementation in Prompt 4
// Purpose: Token cost calculation per model

import type { CostEvent } from './types.js';

// Pricing per 1M tokens (USD)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'haiku': { input: 0.8, output: 4.0 },
  'sonnet': { input: 3.0, output: 15.0 },
  'opus': { input: 15.0, output: 75.0 },
};

// TODO: implement
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Return estimated cost in USD
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function recordCostEvent(sessionId: string, model: string, inputTokens: number, outputTokens: number): CostEvent {
  throw new Error('Not implemented — Prompt 4');
}

// TODO: implement
export function getSessionCost(sessionId: string): number {
  // Return total cost for a session
  throw new Error('Not implemented — Prompt 4');
}
