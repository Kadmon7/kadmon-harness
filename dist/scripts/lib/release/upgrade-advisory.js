// Kadmon Harness — /release: upgrade-advisory phase (ADR-037 D7 amendment)
// Classifies changed paths since the previous tag into ADR-010 distribution
// territories (plugin / install / memoryRef / neutral) and renders an
// operator-facing "what to run to pull this release" message for consumers.
// Mirrors tag.ts's execFileSync("git", [...], { cwd, timeout, stdio }) pattern —
// arg-array only, no shell interpolation (security rule).
import { execFileSync } from "node:child_process";
import { log } from "../utils.js";
// 5000ms — wider than the 3000ms in tag.ts/preflight.ts because `git diff --name-only`
// over a full release range can scan more history than their single tag/rev-parse calls.
const GIT_TIMEOUT_MS = 5000;
const PLUGIN_PREFIXES = [
    ".claude/agents/",
    ".claude/skills/",
    ".claude/commands/",
    ".claude/hooks/",
    ".claude-plugin/",
];
// `scripts/lib/install-` covers install-apply.ts and any future install-* helper.
const INSTALL_PREFIXES = [".claude/rules/", "scripts/lib/install-"];
const INSTALL_EXACT = new Set(["install.sh", "install.ps1", ".claude/settings.json"]);
const MEMORY_REF_EXACT = new Set([
    "docs/onboarding/reference_kadmon_harness.md",
    "docs/onboarding/CLAUDE.template.md",
]);
/** Normalizes Windows backslashes to `/` so prefix matching is platform-agnostic. */
function normalizePath(p) {
    return p.replace(/\\/g, "/");
}
/** Classifies a single changed path into an ADR-010 distribution territory. */
export function classifyPath(p) {
    const normalized = normalizePath(p);
    if (PLUGIN_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return "plugin";
    }
    if (INSTALL_EXACT.has(normalized) ||
        INSTALL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
        return "install";
    }
    if (MEMORY_REF_EXACT.has(normalized)) {
        return "memoryRef";
    }
    return "neutral";
}
/** Groups changed paths by territory and derives the consumer-action flags. Pure — no git. */
export function advisoryFromPaths(paths) {
    const plugin = [];
    const install = [];
    const memoryRef = [];
    for (const p of paths) {
        const territory = classifyPath(p);
        if (territory === "plugin")
            plugin.push(p);
        else if (territory === "install")
            install.push(p);
        else if (territory === "memoryRef")
            memoryRef.push(p);
        // neutral paths are intentionally dropped — no consumer action they imply
    }
    return {
        needsPluginUpdate: plugin.length > 0,
        needsInstallRerun: install.length > 0,
        needsMemoryRefRedrop: memoryRef.length > 0,
        changedPaths: { plugin, install, memoryRef },
    };
}
/**
 * Default runDiff: `git diff --name-only <range>`. Best-effort — an advisory
 * must never block a release, so any git failure (bad range, non-repo cwd,
 * git not installed) is swallowed and yields an empty path list.
 */
function defaultRunDiff(cwd, range) {
    try {
        const output = execFileSync("git", ["diff", "--name-only", range], {
            cwd,
            encoding: "utf8",
            timeout: GIT_TIMEOUT_MS,
            stdio: ["ignore", "pipe", "pipe"],
        });
        return output.split(/\r?\n/).filter((line) => line.trim().length > 0);
    }
    catch (e) {
        log("warn", "defaultRunDiff failed: falling back to returning empty path list (no consumer action inferred)", {
            operation: "defaultRunDiff",
            fallback: "returning empty path list (no consumer action inferred)",
            error: e instanceof Error ? e.message : String(e),
        });
        return [];
    }
}
const DEFAULT_DEPS = { runDiff: defaultRunDiff };
/** Computes the upgrade advisory for the range `<prevTag>..<headRef ?? HEAD>`. */
export function computeUpgradeAdvisory(cwd, prevTag, headRef, deps = DEFAULT_DEPS) {
    const range = `${prevTag}..${headRef ?? "HEAD"}`;
    const paths = deps.runDiff(cwd, range);
    return advisoryFromPaths(paths);
}
const PLUGIN_SECTION = [
    "[PLUGIN] Consumers must update the plugin:",
    "  /plugin marketplace update kadmon-harness",
    "  /plugin update kadmon-harness@kadmon-harness",
    "  /reload-plugins",
].join("\n");
const INSTALL_SECTION = [
    "[INSTALL] Consumers must re-run the installer:",
    "  install.ps1 -ForcePermissionsSync <proj>   (Windows)",
    "  ./install.sh <proj>   (macOS/Linux)",
].join("\n");
const MEMORY_REF_SECTION = [
    "[MEMORY REF] Consumers must refresh their harness reference doc:",
    "  Re-drop docs/onboarding/reference_kadmon_harness.md into the consumer project's memory/",
].join("\n");
/** Renders the operator-facing upgrade path message. Plain text (command stdout), pure. */
export function renderUpgradeAdvisory(advisory, tagName) {
    const header = `Upgrade advisory — ${tagName}`;
    const sections = [];
    if (advisory.needsPluginUpdate)
        sections.push(PLUGIN_SECTION);
    if (advisory.needsInstallRerun)
        sections.push(INSTALL_SECTION);
    if (advisory.needsMemoryRefRedrop)
        sections.push(MEMORY_REF_SECTION);
    if (sections.length === 0) {
        return `${header}\n\nNo consumer action needed — this release touched only non-distributed files.`;
    }
    return `${header}\n\n${sections.join("\n\n")}`;
}
