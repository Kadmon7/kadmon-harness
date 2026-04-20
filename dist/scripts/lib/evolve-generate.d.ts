import type { EvolveGeneratePreview, GenerateProposal, ApplyApprovals, ApplyResult } from "./types.js";
export interface EvolveGenerateOptions {
    projectHash: string;
    cwd: string;
    /** Defaults to ~/.kadmon/forge-reports */
    reportsDir?: string;
    /** Defaults to KADMON_EVOLVE_WINDOW_DAYS env or 7 */
    windowDays?: number;
    /** Test seam — defaults to new Date() */
    now?: Date;
}
/**
 * Reads ClusterReports from `reportsDir`, filters by `projectHash` and time
 * window, merges clusters, and emits GenerateProposal[].
 *
 * PURE — never writes files or mutates the database.
 */
export declare function runEvolveGenerate(opts: EvolveGenerateOptions): Promise<EvolveGeneratePreview>;
/**
 * Renders a GenerateProposal to markdown using the appropriate template.
 * Used by applyEvolveGenerate (Phase 3) — exported for testing.
 */
export declare function renderProposalToMarkdown(proposal: GenerateProposal, now?: Date): string;
/**
 * Single filesystem mutator. Writes approved markdown artifacts to
 * {cwd}/.claude/{type}/{slug}.md.
 *
 * Transactional: if ANY target path already exists (collision), ZERO files
 * are written and the full collision list is returned (ADR-008:62).
 */
export declare function applyEvolveGenerate(preview: EvolveGeneratePreview, approvals: ApplyApprovals, opts: EvolveGenerateOptions): ApplyResult;
