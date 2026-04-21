export type ProjectLanguage = "typescript" | "python" | "mixed" | "unknown";
export interface Toolchain {
    language: ProjectLanguage;
    build: string | null;
    typecheck: string | null;
    test: string;
    lint: string;
    audit: string | null;
    depsFile: string;
    testFilePattern: RegExp;
    codeExtensions: readonly string[];
}
/**
 * Detects the primary language of the project at `cwd`.
 *
 * Priority:
 *  1. KADMON_PROJECT_LANGUAGE env var (valid values only).
 *  2. Filesystem marker scan (package.json / pyproject.toml / requirements.txt).
 *
 * Always writes one stderr diagnostic JSON line per call.
 */
export declare function detectProjectLanguage(cwd?: string): ProjectLanguage;
/**
 * Returns the toolchain configuration for the project at `cwd`.
 * mixed and unknown fall back to the TypeScript toolchain (conservative default).
 */
export declare function getToolchain(cwd?: string): Toolchain;
