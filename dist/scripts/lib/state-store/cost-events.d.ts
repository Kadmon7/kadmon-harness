import type { CostEvent } from "../types.js";
export declare function insertCostEvent(event: Omit<CostEvent, "id">): void;
export declare function getCostBySession(sessionId: string): CostEvent[];
export declare function getCostSummaryByModel(projectHash: string): Array<{
    model: string;
    sessionCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
}>;
