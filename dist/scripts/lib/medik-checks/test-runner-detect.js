// Kadmon Harness — /medik test-runner detection (audit item #4).
//
// Check #3 (Tests) and the Phase 3 regression gate previously hardcoded
// `npx vitest run` for every TypeScript project, even ones whose actual
// test runner is Jest. detectTestCommand() reads package.json signals to
// pick a one-shot (non-watch) command instead of assuming Vitest.
//
// Scope: TypeScript/JavaScript projects only. Python's `pytest` is resolved
// separately via detect-project-language.ts's Toolchain.test — this module
// is not consulted for Python repos.
//
// Pure filesystem read, no execution — safe to call from medik.md's Phase 1
// preamble the same way Check #9 calls checkInstallHealth().
import fs from "node:fs";
import path from "node:path";
const JEST_RESULT = (source) => ({
    command: "npx jest",
    runner: "jest",
    source,
});
const VITEST_RESULT = (source) => ({
    command: "npx vitest run",
    runner: "vitest",
    source,
});
function readPackageJson(cwd) {
    const pkgPath = path.join(cwd, "package.json");
    try {
        const raw = fs.readFileSync(pkgPath, "utf8");
        return JSON.parse(raw);
    }
    catch {
        // Missing file or malformed JSON — non-authoritative, fall through to default.
        return null;
    }
}
/**
 * Detects the one-shot (non-watch) test command for a TS/JS project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `scripts.test` content — the command that actually runs wins: if it
 *     names jest or vitest explicitly, mirror that runner. Built as an
 *     explicit one-shot invocation (never a bare `npm test`, which could
 *     resolve to a watch-mode script and hang /medik).
 *  2. dependencies/devDependencies — jest present (vitest absent) -> jest;
 *     vitest present (jest absent) -> vitest.
 *  3. Fallback -> vitest (existing harness convention, matches TS_BASE.test
 *     in detect-project-language.ts). Also the outcome when both jest and
 *     vitest signals are present with no way to disambiguate.
 */
export function detectTestCommand(cwd) {
    const pkg = readPackageJson(cwd);
    if (!pkg) {
        return VITEST_RESULT("default (no package.json)");
    }
    const scriptTest = pkg.scripts?.test ?? "";
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const scriptMentionsJest = /\bjest\b/.test(scriptTest);
    const scriptMentionsVitest = /\bvitest\b/.test(scriptTest);
    if (scriptMentionsJest && !scriptMentionsVitest) {
        return JEST_RESULT(`package.json scripts.test: "${scriptTest}"`);
    }
    if (scriptMentionsVitest && !scriptMentionsJest) {
        return VITEST_RESULT(`package.json scripts.test: "${scriptTest}"`);
    }
    const hasJestDep = "jest" in deps;
    const hasVitestDep = "vitest" in deps;
    if (hasJestDep && !hasVitestDep) {
        return JEST_RESULT("package.json dependency: jest");
    }
    if (hasVitestDep && !hasJestDep) {
        return VITEST_RESULT("package.json dependency: vitest");
    }
    return VITEST_RESULT("default (no jest/vitest signal found)");
}
