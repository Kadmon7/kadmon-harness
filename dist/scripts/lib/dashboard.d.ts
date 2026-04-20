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
export declare function renderConfidenceBar(confidence: number): string;
export declare function getInstinctRows(projectHash: string): InstinctRow[];
export declare function getSessionRows(projectHash: string, limit?: number): SessionRow[];
export declare function getHookHealthRows(events: ObservabilityEvent[]): HookHealthRow[];
export declare function getModelCostRows(projectHash: string): ModelCostRow[];
export declare function renderDashboard(projectHash: string, events: ObservabilityEvent[]): string;
