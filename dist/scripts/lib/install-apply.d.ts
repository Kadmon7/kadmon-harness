#!/usr/bin/env node
export interface InstallApplySummary {
    projectDenyCount: number;
    projectAdded: number;
    userMarketplaceAdded: boolean;
    userEnabledPluginAdded: boolean;
    userSettingsPath: string;
}
export declare function runInstallApply(argv: readonly string[]): InstallApplySummary;
