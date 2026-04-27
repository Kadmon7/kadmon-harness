// Kadmon Harness — /medik Check #13: skill-creator-probe (plan-028 Phase 5.2)
// Probes candidate paths for the skill-creator plugin. WARN if none found.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
function resolveFromInstalledPlugins(jsonPath) {
    try {
        const raw = readFileSync(jsonPath, "utf8");
        // Best-effort parse; schema mismatch falls through to null (probe is non-authoritative).
        const parsed = JSON.parse(raw);
        const plugins = parsed.plugins;
        if (!plugins)
            return null;
        const key = Object.keys(plugins).find((k) => k.startsWith("skill-creator"));
        if (!key)
            return null;
        const entries = plugins[key];
        const installPath = entries?.[0]?.installPath;
        if (!installPath)
            return null;
        return path.join(installPath, "skills", "skill-creator", "SKILL.md");
    }
    catch {
        // Intentional: registry absence/parse error is not a defect — fall through to project/global candidates.
        return null;
    }
}
export function runCheck(ctx) {
    const homedir = os.homedir();
    const pluginsJsonPath = path.join(homedir, ".claude", "plugins", "installed_plugins.json");
    const fromRegistry = resolveFromInstalledPlugins(pluginsJsonPath);
    // Candidates in order of priority. First entry derives from
    // installed_plugins.json (plugin cache v2 layout), falls back to project
    // skills, then global skills.
    const candidates = [
        fromRegistry,
        path.join(ctx.cwd, ".claude", "skills", "skill-creator", "SKILL.md"),
        path.join(homedir, ".claude", "skills", "skill-creator", "SKILL.md"),
    ].filter((p) => p !== null);
    // Human-readable labels (NOT absolute paths) — avoids leaking username when
    // the /medik conversational output is pasted (only --ALV output is redacted).
    const labelsFull = ["plugin registry", "project skills", "global skills"];
    const labels = fromRegistry ? labelsFull : labelsFull.slice(1);
    for (let i = 0; i < candidates.length; i++) {
        // filter above guarantees string elements
        if (existsSync(candidates[i])) {
            return {
                status: "PASS",
                category: "runtime",
                message: `skill-creator found (${labels[i]})`,
            };
        }
    }
    return {
        status: "WARN",
        category: "runtime",
        message: "skill-creator plugin missing — /evolve step 6 Generate will fail. Install via Claude Code plugin marketplace.",
    };
}
