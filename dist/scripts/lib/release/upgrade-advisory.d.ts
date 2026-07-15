export type Territory = "plugin" | "install" | "memoryRef" | "neutral";
export interface UpgradeAdvisory {
    readonly needsPluginUpdate: boolean;
    readonly needsInstallRerun: boolean;
    readonly needsMemoryRefRedrop: boolean;
    readonly changedPaths: {
        readonly plugin: readonly string[];
        readonly install: readonly string[];
        readonly memoryRef: readonly string[];
    };
}
export interface UpgradeAdvisoryDeps {
    readonly runDiff: (cwd: string, range: string) => readonly string[];
}
/** Classifies a single changed path into an ADR-010 distribution territory. */
export declare function classifyPath(p: string): Territory;
/** Groups changed paths by territory and derives the consumer-action flags. Pure — no git. */
export declare function advisoryFromPaths(paths: readonly string[]): UpgradeAdvisory;
/** Computes the upgrade advisory for the range `<prevTag>..<headRef ?? HEAD>`. */
export declare function computeUpgradeAdvisory(cwd: string, prevTag: string, headRef?: string, deps?: UpgradeAdvisoryDeps): UpgradeAdvisory;
/** Renders the operator-facing upgrade path message. Plain text (command stdout), pure. */
export declare function renderUpgradeAdvisory(advisory: UpgradeAdvisory, tagName: string): string;
