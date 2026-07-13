import type { BumpLevel, ReleaseContext, ReleaseError, ReleaseErrorCode, StepResult } from "./types.js";
/**
 * Typed domain error for this module (patterns.md: "MUST use typed error classes
 * for domain errors"). Implements the shared ReleaseError shape so callers can
 * narrow on `.code` without depending on this class specifically.
 */
export declare class ReleaseValidationError extends Error implements ReleaseError {
    readonly code: ReleaseErrorCode;
    constructor(code: ReleaseErrorCode, message: string);
}
export declare function computeNextVersion(current: string, level: BumpLevel): string;
export declare function applyVersionBump(ctx: ReleaseContext, target: string): StepResult;
