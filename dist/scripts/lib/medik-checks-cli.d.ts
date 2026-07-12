import type { CheckContext, CheckResult } from "./medik-checks/types.js";
export interface CheckModule {
    name: string;
    /** Checks #11/#12 query SQLite — the runner opens/closes the DB around them. */
    needsDb: boolean;
    run: (ctx: CheckContext) => CheckResult;
}
export type CheckRegistry = ReadonlyMap<number, CheckModule>;
export declare const DEFAULT_REGISTRY: CheckRegistry;
export interface CliOptions {
    cwd: string;
    checks: readonly number[];
}
export interface CliCheckResult extends CheckResult {
    check: number;
    name: string;
}
export declare function parseCliArgs(argv: readonly string[], registry?: CheckRegistry): CliOptions;
export declare function resolveProjectHash(cwd: string): string;
export declare function runChecks(options: CliOptions, registry?: CheckRegistry): Promise<readonly CliCheckResult[]>;
export declare function main(argv: readonly string[]): Promise<number>;
