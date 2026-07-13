import type { ReleaseContext, StatusFlipProposal } from "./types.js";
/**
 * Scans the ## [Unreleased] CHANGELOG section for referenced ADR-NNN / plan-NNN / roadmap
 * file references and proposes a status flip for each doc that is not already at its
 * target status. Never writes — output only (ADR-037 D5).
 */
export declare function proposeStatusFlips(ctx: ReleaseContext): readonly StatusFlipProposal[];
