export type SymlinkState = "symlink_ok" | "junction_ok" | "broken_target" | "text_file" | "regular_dir" | "missing";
export interface SymlinkStatus {
    readonly name: "agents" | "skills" | "commands";
    readonly path: string;
    readonly state: SymlinkState;
    readonly target: string | null;
    readonly fileSize: number | null;
}
export interface InstallHealthReport {
    readonly rootDir: string;
    readonly platform: NodeJS.Platform;
    readonly nodeVersion: string;
    readonly runtimeRootEnv: string | null;
    readonly inPluginCache: boolean;
    readonly symlinks: readonly SymlinkStatus[];
    readonly distPresent: boolean;
    readonly distStale: {
        readonly stale: boolean;
        readonly reason: string;
    };
    readonly anomalies: readonly string[];
    readonly ok: boolean;
    readonly timestamp: string;
}
export declare function checkInstallHealth(rootDir: string): InstallHealthReport;
