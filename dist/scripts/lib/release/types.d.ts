export type BumpLevel = "patch" | "minor" | "major";
export interface ReleaseOptions {
    readonly level: BumpLevel;
    readonly dryRun: boolean;
    readonly push: boolean;
}
export interface VerifyResult {
    readonly ok: boolean;
    readonly failures: readonly string[];
}
export type VerifyRunner = (cwd: string) => VerifyResult;
export interface ReleaseDeps {
    readonly runVerify: VerifyRunner;
    readonly now: () => Date;
}
export interface ReleaseContext {
    readonly cwd: string;
    readonly options: ReleaseOptions;
    readonly currentVersion: string;
}
export type StepStatus = "applied" | "skipped" | "blocked" | "proposed" | "failed";
export interface StepResult {
    readonly step: string;
    readonly status: StepStatus;
    readonly message: string;
    readonly filesTouched: readonly string[];
    readonly details?: unknown;
}
export type ReleaseErrorCode = "DIRTY_TREE" | "VERIFY_RED" | "EMPTY_UNRELEASED" | "NOT_ON_MAIN" | "TAG_EXISTS" | "IO" | "GIT" | "BAD_VERSION";
export interface ReleaseError {
    readonly code: ReleaseErrorCode;
    readonly message: string;
}
export type PreflightResult = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly blockers: readonly ReleaseError[];
};
export interface StatusFlipProposal {
    readonly file: string;
    readonly current: string;
    readonly proposed: string;
    readonly reason: string;
}
export interface UnnarratedPruneWarning {
    readonly line: string;
    readonly id: string;
}
export interface ReleasePlan {
    readonly currentVersion: string;
    readonly nextVersion: string;
    readonly bumpLevel: BumpLevel;
    readonly suggestedLevel: BumpLevel;
    readonly tagName: string;
    readonly releaseDate: string;
    readonly changelogPreview: string;
    readonly filesToTouch: readonly string[];
    readonly backlogPrune: readonly string[];
    readonly statusFlipProposals: readonly StatusFlipProposal[];
    readonly blocked: readonly string[];
}
