import type { CheckContext, CheckResult } from "./types.js";
export type GraphHealthInput = {
    readonly dirExists: false;
} | {
    readonly dirExists: true;
    readonly graphJsonExists: false;
} | {
    readonly dirExists: true;
    readonly graphJsonExists: true;
    readonly graphMtimeMs: number;
    readonly headCommitMs: number | null;
};
export declare function evaluateGraphHealth(input: GraphHealthInput): CheckResult;
export declare function runCheck(ctx: CheckContext): CheckResult;
