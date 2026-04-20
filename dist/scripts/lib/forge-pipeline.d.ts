import type { Instinct, ClusterReport } from "./types.js";
export interface ForgePipelineOptions {
    projectHash: string;
    sessionId: string;
    dryRun?: boolean;
}
export interface ForgeReinforcement {
    before: Instinct;
    after: Instinct;
}
export interface ForgeScopePromotion {
    instinctId: string;
    fromScope: "project";
    toScope: "global";
    rationale: string;
}
export interface ForgePreview {
    would: {
        create: Instinct[];
        reinforce: ForgeReinforcement[];
        promote: Instinct[];
        prune: Instinct[];
        scopePromote: ForgeScopePromotion[];
    };
    clusterReport: ClusterReport;
    totals: {
        created: number;
        reinforced: number;
        promoted: number;
        pruned: number;
        scopePromoted: number;
    };
}
export declare function runForgePipeline(opts: ForgePipelineOptions): Promise<ForgePreview>;
export declare function applyForgePreview(preview: ForgePreview, _opts: ForgePipelineOptions): void;
export declare function computeClusterReport(instincts: Instinct[], projectHash: string, sessionId: string): ClusterReport;
