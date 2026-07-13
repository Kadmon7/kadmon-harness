// Kadmon Harness — /medik module-based checks CLI runner (AUD-04/AUD-05).
//
// Single entry point for /medik checks #10-#14 so medik.md can invoke them
// from ANY consumer cwd once RUNTIME_ROOT is resolved:
//
//   npx tsx "$RUNTIME_ROOT/scripts/lib/medik-checks-cli.ts" --cwd "$(pwd)" [--checks 10,11]
//
// Replaces the per-check CLI shim pattern: the old capability-alignment shim
// hardcoded projectHash: "cli", which on DB-filtered checks (#11, #12) matches
// zero rows and silently produces false PASS. This runner computes the REAL
// projectHash from the target cwd via detectProject() — sha256(remote url),
// sliced to 16 hex chars, the exact recipe the hooks persist with.
//
// Output: ONE JSON array on stdout. Per-check crashes are captured as NOTE
// results inside the array — the runner itself never crashes on a check.
// Exit codes: 0 = no FAIL, 1 = at least one FAIL, 2 = usage error.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { detectProject } from "./project-detect.js";
import { hashString } from "./utils.js";
import { openDb, closeDb, getDb } from "./state-store.js";
import { runCheck as runStalePlans } from "./medik-checks/stale-plans.js";
import { runCheck as runHookHealth } from "./medik-checks/hook-health-24h.js";
import { runCheck as runInstinctDecay } from "./medik-checks/instinct-decay-candidates.js";
import { runCheck as runSkillCreatorProbe } from "./medik-checks/skill-creator-probe.js";
import { runCheck as runCapabilityAlignment } from "./medik-checks/capability-alignment.js";
export const DEFAULT_REGISTRY = new Map([
    [10, { name: "stale-plans", needsDb: false, run: runStalePlans }],
    [11, { name: "hook-health-24h", needsDb: true, run: runHookHealth }],
    [12, { name: "instinct-decay-candidates", needsDb: true, run: runInstinctDecay }],
    [13, { name: "skill-creator-probe", needsDb: false, run: runSkillCreatorProbe }],
    [14, { name: "capability-alignment", needsDb: false, run: runCapabilityAlignment }],
]);
const cliOptionsSchema = z.object({
    cwd: z.string().min(1),
    checks: z.array(z.number().int()).min(1),
});
export function parseCliArgs(argv, registry = DEFAULT_REGISTRY) {
    let cwd = process.cwd();
    let checks = [...registry.keys()].sort((a, b) => a - b);
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const value = argv[i + 1];
        if (arg === "--cwd" || arg === "--checks") {
            if (value === undefined || value.startsWith("--")) {
                throw new Error(`${arg} requires a value`);
            }
            if (arg === "--cwd") {
                cwd = value;
            }
            else {
                const parsed = value.split(",").map((s) => Number(s.trim()));
                if (parsed.some((n) => Number.isNaN(n))) {
                    // Fail with a human-readable message here — letting a NaN reach
                    // cliOptionsSchema.parse() below surfaces a raw Zod issue array
                    // instead ("Expected number, received nan"), which is useless to
                    // whoever typed `--checks foo` by mistake.
                    throw new Error(`--checks expects a comma-separated list of check numbers, got: ${value}`);
                }
                checks = [...new Set(parsed)].sort((a, b) => a - b);
            }
            i++;
        }
        else {
            throw new Error(`unknown argument: ${arg} (usage: --cwd <path> [--checks 10,11,12,13,14])`);
        }
    }
    // Zod at the boundary: argv is external input.
    const validated = cliOptionsSchema.parse({ cwd, checks });
    const validIds = [...registry.keys()].sort((a, b) => a - b);
    const invalid = validated.checks.filter((n) => !registry.has(n));
    if (invalid.length > 0) {
        throw new Error(`invalid check id(s): ${invalid.join(", ")} (valid: ${validIds.join(", ")})`);
    }
    const resolvedCwd = path.resolve(validated.cwd);
    if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
        throw new Error(`--cwd is not a directory: ${resolvedCwd}`);
    }
    return { cwd: resolvedCwd, checks: validated.checks };
}
export function resolveProjectHash(cwd) {
    const info = detectProject(cwd);
    if (info)
        return info.projectHash;
    // No git remote → hooks never persist sessions for this project
    // (session-start exits early), so a cwd-derived hash keeps the DB-filtered
    // checks truthfully empty instead of borrowing another project's rows.
    // NEVER a shared sentinel like "cli" — that made false PASS undetectable.
    return hashString(`no-remote:${cwd}`);
}
function isDbOpen() {
    try {
        getDb();
        return true;
    }
    catch {
        return false;
    }
}
export async function runChecks(options, registry = DEFAULT_REGISTRY) {
    const ctx = {
        projectHash: resolveProjectHash(options.cwd),
        cwd: options.cwd,
    };
    const needsDb = options.checks.some((n) => registry.get(n)?.needsDb === true);
    let openedDb = false;
    if (needsDb && !isDbOpen()) {
        try {
            await openDb(process.env.KADMON_TEST_DB);
            openedDb = true;
        }
        catch {
            // DB checks surface their own NOTE via getDb() throwing — do not crash the runner.
        }
    }
    try {
        return options.checks.map((n) => {
            const mod = registry.get(n);
            if (!mod) {
                // Unreachable via parseCliArgs (validated) — defensive for direct callers.
                return {
                    check: n,
                    name: "unknown",
                    status: "NOTE",
                    category: "runtime",
                    message: `unknown check #${n} — not in registry`,
                };
            }
            try {
                return { check: n, name: mod.name, ...mod.run(ctx) };
            }
            catch (e) {
                return {
                    check: n,
                    name: mod.name,
                    status: "NOTE",
                    category: "runtime",
                    message: `check crashed: ${e instanceof Error ? e.message : String(e)}`,
                };
            }
        });
    }
    finally {
        if (openedDb)
            closeDb();
    }
}
export async function main(argv) {
    const options = parseCliArgs(argv);
    const results = await runChecks(options);
    console.log(JSON.stringify(results, null, 2));
    return results.some((r) => r.status === "FAIL") ? 1 : 0;
}
// CLI entry guard — only runs when executed directly (npx tsx), not on import.
const entry = process.argv[1];
if (entry && pathToFileURL(entry).href === import.meta.url) {
    main(process.argv.slice(2))
        .then((code) => process.exit(code))
        .catch((e) => {
        console.error(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
        process.exit(2);
    });
}
