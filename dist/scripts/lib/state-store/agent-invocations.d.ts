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
}>;
