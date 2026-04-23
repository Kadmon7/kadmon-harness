import type { SymlinkStatus } from "./install-health.js";
export interface RemediationContext {
    readonly inPluginCache: boolean;
    readonly platform: NodeJS.Platform;
}
export declare function renderRemediationBanner(issues: ReadonlyArray<SymlinkStatus>, context: RemediationContext): string;
