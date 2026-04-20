declare const TABLES: readonly ["sessions", "instincts", "cost_events", "hook_events", "agent_invocations", "sync_queue"];
type TableName = (typeof TABLES)[number];
export interface SessionRow {
    id: string;
    branch: string | null;
    msgs: number;
    cost: number;
    startedAt: string;
    endedAt: string | null;
}
export interface HookStat {
    hookName: string;
    count: number;
    blocks: number;
    maxMs: number | null;
}
export interface AgentStat {
    agentType: string;
    count: number;
    avgMs: number;
}
export interface CostStat {
    model: string;
    count: number;
    totalUsd: number;
}
export interface DbHealthReport {
    tableCounts: Record<TableName, number>;
    freshness: Record<TableName, string | null>;
    lastSessions: SessionRow[];
    hookEvents24h: HookStat[];
    agentInvocations24h: AgentStat[];
    costEvents24h: CostStat[];
    anomalies: string[];
}
export declare function getDbHealthReport(): DbHealthReport;
export {};
