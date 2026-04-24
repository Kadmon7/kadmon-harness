// Kadmon Harness — /medik Check #13: skill-creator-probe (plan-028 Phase 5.2)
// Probes 3 candidate paths for the skill-creator plugin. WARN if none found.
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
export function runCheck(ctx) {
    const homedir = os.homedir();
    // Candidates in order of priority (plan-028 §Phase 5.2)
    const candidates = [
        path.join(homedir, ".claude", "plugins", "cache", "skill-creator", "SKILL.md"),
        path.join(ctx.cwd, ".claude", "skills", "skill-creator", "SKILL.md"),
        path.join(homedir, ".claude", "skills", "skill-creator", "SKILL.md"),
    ];
    for (const candidatePath of candidates) {
        if (existsSync(candidatePath)) {
            return {
                status: "PASS",
                category: "runtime",
                message: `skill-creator found at ${candidatePath}`,
            };
        }
    }
    return {
        status: "WARN",
        category: "runtime",
        message: "skill-creator plugin missing — /evolve step 6 Generate will fail. Install via Claude Code plugin marketplace.",
    };
}
