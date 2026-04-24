#!/usr/bin/env node
export interface SandboxStatus {
    ready: boolean;
    path: string;
    hasGitRemote: boolean;
    projectHash: string | null;
    reasons: string[];
}
export interface SimulatedEvent {
    event: "SessionStart" | "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PreCompact" | "Stop";
    toolName?: string;
    stdin: string;
    hooksToInvoke: string[];
}
export interface HookInvocationResult {
    hook: string;
    invocations: number;
    exitCodes: number[];
    persistedInDb: boolean;
}
export interface DogfoodReport {
    sandboxPath: string;
    projectHash: string;
    sessionId: string;
    totalEvents: number;
    hooksInvoked: HookInvocationResult[];
    hooksNotDisparados: string[];
    summary: {
        passed: number;
        failed: number;
        total: 22;
    };
}
export declare const ALL_HOOK_NAMES: readonly string[];
/**
 * Validates that the sandbox path is a git repo with a remote origin.
 * Returns a SandboxStatus describing readiness.
 */
export declare function checkSandbox(sandboxPath: string): SandboxStatus;
/**
 * Builds a realistic sequence of ~10 Claude Code events that collectively
 * cover all 22 hooks. Order: SessionStart → N x (PreToolUse + PostToolUse) →
 * PostToolUseFailure → PreCompact → Stop.
 */
export declare function buildEventSequence(sessionId: string, sandboxCwd: string): SimulatedEvent[];
/**
 * Orchestrates the full dogfood session:
 * 1. checkSandbox (auto-adds remote if missing)
 * 2. Build event sequence
 * 3. Invoke hooks per event
 * 4. Query DB for persisted hook_events
 * 5. Build DogfoodReport
 */
export declare function runPluginModeDogfood(sandboxPath: string): Promise<DogfoodReport>;
/**
 * Formats a DogfoodReport as a readable text table.
 */
export declare function formatReport(report: DogfoodReport): string;
