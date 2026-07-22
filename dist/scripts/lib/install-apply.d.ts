#!/usr/bin/env node
import { type ScaffoldResult } from "./install-scaffold.js";
export interface InstallApplySummary {
    projectDenyCount: number;
    projectAdded: number;
    allowAdded: number;
    allowDedupedCount: number;
    userMarketplaceAdded: boolean;
    userEnabledPluginAdded: boolean;
    userSettingsPath: string;
    scaffold?: ScaffoldResult;
}
export declare function runInstallApply(argv: readonly string[]): InstallApplySummary;
