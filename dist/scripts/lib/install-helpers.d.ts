/**
 * Copy own enumerable keys from `src` into a fresh object, filtering any key
 * in FORBIDDEN_KEYS. Preserves ordinary prototype (not null-proto) so the
 * result works seamlessly with JSON.stringify and ordinary JS consumers.
 */
export declare function safeAssign<T extends Record<string, unknown>>(src: T): T;
/** Platforms Kadmon Harness supports. Narrower than NodeJS.Platform on purpose. */
export type SupportedPlatform = "win32" | "darwin" | "linux";
/**
 * Detect the current OS platform, narrowed to the 3 platforms Kadmon supports.
 * Throws on unknown platforms (e.g. freebsd, sunos, aix) — callers must handle
 * the failure explicitly rather than silently degrading to an unsupported path.
 */
export declare function detectPlatform(): SupportedPlatform;
export interface HookCommandOpts {
    platform: SupportedPlatform;
    /** True when running install.sh from Windows Git Bash; false for native PowerShell, Mac, Linux. */
    usesGitBash: boolean;
}
/**
 * Build the shell command string for a Claude Code plugin hook entry.
 * The script name (e.g. "session-start.js") is embedded inside the
 * `${CLAUDE_PLUGIN_ROOT}/.claude/hooks/scripts/` template — plugin variables
 * use POSIX forward slashes regardless of host OS.
 */
export declare function generateHookCommand(scriptName: string, opts: HookCommandOpts): string;
export interface MergeDenyResult {
    /** Final union (harness rules first, then target-only rules). */
    merged: string[];
    /** Harness rules NOT already present in target (the new additions). */
    added: string[];
    /** Harness rules already present in target (the overlap). */
    dedupedCount: number;
}
/**
 * Merge two permissions.deny lists with predictable ordering: harness rules
 * appear first in declaration order, then any target-only rules. Inputs are
 * never mutated; a new array is always returned.
 */
export declare function mergePermissionsDeny(harness: readonly string[], target: readonly string[]): MergeDenyResult;
export interface SettingsJsonLike {
    permissions?: {
        deny?: readonly string[];
        allow?: readonly string[];
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
export interface MergeSettingsOpts {
    forceDenySync?: boolean;
}
/**
 * Deep-merge ONLY permissions.deny from harness into target, preserving every
 * other top-level key (hooks, mcpServers, statusLine, etc.) untouched. Returns
 * a new object — inputs are never mutated. Never touches settings.local.json
 * (caller's responsibility to pass the correct file).
 */
export declare function mergeSettingsJson(harness: SettingsJsonLike, target: SettingsJsonLike, _opts?: MergeSettingsOpts): SettingsJsonLike;
export interface TargetPaths {
    rules: string;
    settings: string;
    settingsLocal: string;
}
/**
 * Compute the canonical .claude/* paths inside a target project directory.
 * Throws on empty or null/undefined input — install scripts must validate the
 * target up front, not silently produce broken paths.
 */
export declare function resolveTargetPaths(cwd: string): TargetPaths;
