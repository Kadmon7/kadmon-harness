import type { ObservabilityEvent } from "./types.js";
export interface InstinctRow {
    pattern: string;
    confidence: number;
    occurrences: number;
    bar: string;
    isPromotable: boolean;
}
export interface SessionRow {
    date: string;
    branch: string;
    filesCount: number;
    messageCount: number;
    compactionCount: number;
    durationMs: number;
    cost: string;
    costNum: number;
    isLive: boolean;
}
export interface HookHealthRow {
    tool: string;
    total: number;
    failures: number;
    status: "OK" | "WARN" | "FAIL";
}
export interface ModelCostRow {
    model: string;
    sessionCount: number;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
}
/** @internal — exported for tests only; internal helper of renderDashboard */
export declare function renderConfidenceBar(confidence: number): string;
/** @internal — exported for tests only; internal helper of renderDashboard */
export declare function getInstinctRows(projectHash: string): InstinctRow[];
/** @internal — exported for tests only; internal helper of renderDashboard */
export declare function getSessionRows(projectHash: string, limit?: number): SessionRow[];
/** @internal — exported for tests only; internal helper of renderDashboard */
export declare function getHookHealthRows(events: ObservabilityEvent[]): HookHealthRow[];
/** @internal — exported for tests only; internal helper of renderDashboard */
export declare function getModelCostRows(projectHash: string): ModelCostRow[];
export declare function renderDashboard(projectHash: string, events: ObservabilityEvent[]): string;
