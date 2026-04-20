import type { CostResult } from "./types.js";
export declare function calculateCost(model: string, inputTokens: number, outputTokens: number): CostResult;
export declare function formatCost(usd: number): string;
export declare function estimateCharsPerToken(content: string): number;
