#!/usr/bin/env node
export interface HookDef {
    name: string;
    script: string;
    event: "PreToolUse" | "PostToolUse" | "PostToolUseFailure" | "PreCompact" | "SessionStart" | "Stop";
    matcher: string;
}
export interface HookResult {
    hook: HookDef;
    exitCode: number;
    stderr: string;
    stdout: string;
    durationMs: number;
    error?: string;
}
export type Status = "pass" | "fail" | "unexpected";
/**
 * Reads .claude/settings.json and returns flat list of HookDef objects.
 * Extracts hook name from the node script path (basename without .js).
 */
export declare function parseSettings(settingsPath: string): HookDef[];
/**
 * Produces minimal valid JSON stdin for a given hook based on its event and matcher.
 */
export declare function generateStdin(hook: HookDef): string;
/**
 * Executes a hook script with synthetic stdin. Returns exit code, stderr, stdout, duration.
 * Wraps execFileSync errors (non-zero exits) — never throws.
 */
export declare function runHook(hook: HookDef, stdin: string): HookResult;
/**
 * Decides pass/fail based on exit code and hook identity.
 * Rules:
 *   exit 0 → always pass
 *   exit 1 → pass for warning-type hooks, fail otherwise
 *   exit 2 → pass for guard hooks (triggered as expected), fail for observe/lifecycle hooks
 *   error  → fail
 */
export declare function classify(result: HookResult): {
    status: Status;
    reason: string;
};
/**
 * Renders a formatted table of hook smoke results + summary line.
 */
export declare function reportTable(results: HookResult[]): string;
