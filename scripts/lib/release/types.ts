// Shared type contract for the /release command subsystem (ADR-037, plan-037).
// Type-only module — no runtime code, no test (mirrors scripts/lib/medik-checks/types.ts).
// The 4AM autonomous-routine motivation in ADR-037 is RETIRED (see the ADR Amendment
// 2026-07-13): /release is a normal human-invoked command; the idempotency + refusal
// gates below stand as engineering robustness, not unattended-execution affordances.

export type BumpLevel = "patch" | "minor" | "major";

export interface ReleaseOptions {
  readonly level: BumpLevel;
  readonly dryRun: boolean; // compute + print plan, zero writes / zero git ops
  readonly push: boolean; // opt-in publish (git push --follow-tags) — explicit human step (D3)
}

// Injected dependencies — keep the heavy toolchain + clock out of the pure modules.
export interface VerifyResult {
  readonly ok: boolean;
  readonly failures: readonly string[];
}
export type VerifyRunner = (cwd: string) => VerifyResult; // real impl spawns build+typecheck+test+lint

export interface ReleaseDeps {
  readonly runVerify: VerifyRunner;
  readonly now: () => Date; // real impl () => new Date(); tests inject a fixed clock
}

export interface ReleaseContext {
  readonly cwd: string; // repo root
  readonly options: ReleaseOptions;
  readonly currentVersion: string; // read from plugin.json at construction
}

export type StepStatus = "applied" | "skipped" | "blocked" | "proposed" | "failed";

export interface StepResult {
  readonly step: string; // e.g. "version-bump"
  readonly status: StepStatus;
  readonly message: string;
  readonly filesTouched: readonly string[];
  readonly details?: unknown;
}

export type ReleaseErrorCode =
  | "DIRTY_TREE"
  | "VERIFY_RED"
  | "EMPTY_UNRELEASED"
  | "NOT_ON_MAIN"
  | "TAG_EXISTS"
  | "IO"
  | "GIT"
  | "BAD_VERSION";

export interface ReleaseError {
  readonly code: ReleaseErrorCode;
  readonly message: string; // what failed, why, which input (patterns.md)
}

export type PreflightResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly blockers: readonly ReleaseError[] };

export interface StatusFlipProposal {
  readonly file: string; // ADR/plan/roadmap path
  readonly current: string; // "proposed" | "pending" | "in-progress" | "[ ]"
  readonly proposed: string; // "accepted" | "completed" | "[x]"
  readonly reason: string; // which [Unreleased] entry references it
}

// A BACKLOG [x] item that was pruned but not found narrated in the CHANGELOG text
// (prune-only + warn resolution of AMBIGUITY-1 — nothing is silently dropped).
export interface UnnarratedPruneWarning {
  readonly line: string; // the pruned "- [x] ..." line
  readonly id: string; // the AUD-xx / R-xx id, if parseable
}

export interface ReleasePlan {
  readonly currentVersion: string;
  readonly nextVersion: string;
  readonly bumpLevel: BumpLevel;
  readonly suggestedLevel: BumpLevel; // advisory from [Unreleased] scan (D1)
  readonly tagName: string; // vX.Y.Z
  readonly releaseDate: string; // YYYY-MM-DD (UTC, deps.now())
  readonly changelogPreview: string; // consolidated section text
  readonly filesToTouch: readonly string[];
  readonly backlogPrune: readonly string[]; // [x] lines to prune
  readonly statusFlipProposals: readonly StatusFlipProposal[];
  readonly blocked: readonly string[]; // preflight blocker messages, empty if clear
}
