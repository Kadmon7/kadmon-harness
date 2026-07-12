export type TestRunner = "jest" | "vitest";
export interface TestCommandResult {
    readonly command: string;
    readonly runner: TestRunner;
    readonly source: string;
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
export declare function detectTestCommand(cwd: string): TestCommandResult;
