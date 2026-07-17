import type { AgentInvocation } from "../types.js";
/**
 * Remove duplicate rows from agent_invocations, keeping the earliest rowid per
 * natural key (session_id, agent_type, timestamp). Mirrors
 * cleanupDuplicateHookEvents per ADR-022.
 * @returns Number of rows removed.
 */
export declare function cleanupDuplicateAgentInvocations(): number;
export declare function insertAgentInvocation(invocation: Omit<AgentInvocation, "id">): void;
export declare function getAgentInvocationsBySession(sessionId: string): AgentInvocation[];
export declare function getAgentInvocationStats(projectHash: string, since?: string): Array<{
    agentType: string;
    total: number;
    avgDurationMs: number;
    failureRate: number;
    /** Count of invocations with a recorded success/failure (success IS NOT
     * NULL). Additive field (AUD-dashboard WARN 3) — `failureRate` alone can't
     * distinguish "0 known outcomes" from "known outcomes, all succeeded";
     * both read failureRate === 0. Consumers that need to render "unknown"
     * (e.g. a null successRate) must check `knownOutcomes > 0` first. */
    knownOutcomes: number;
}>;
