// Kadmon Harness — /instinct deprecation alias resolver (ADR-005 D6)
// Maps old /instinct subcommands to their closest /forge behavior.
// Removal scheduled for 2026-04-20.
const DEPRECATION_WARNING = "/instinct is deprecated and will be removed 2026-04-20. Use /forge instead.";
const TARGET_MAP = new Map([
    ["", "/forge --dry-run"],
    ["status", "/forge --dry-run"],
    ["eval", "/forge --dry-run"],
    ["learn", "/forge"],
    ["promote", "/forge"],
    ["prune", "/forge"],
    ["export", "/forge export"],
]);
export function resolveAliasCommand(input) {
    const tokens = input.trim().toLowerCase().split(/\s+/);
    const subcommand = tokens.length > 1 ? tokens[1] : "";
    const target = TARGET_MAP.get(subcommand) ?? "/forge";
    return { target, warn: DEPRECATION_WARNING };
}
