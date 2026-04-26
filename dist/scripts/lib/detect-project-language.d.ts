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
 * The three runtime profiles for /skanner, kartograf, and arkonte.
 * - harness: Kadmon Harness codebase (hook lifecycle, sql.js, session/instinct)
 * - web:     React/Next/Vite/FastAPI/Django consumer project
 * - cli:     CLI/library package (bin field, no UI deps)
 */
export type SkannerProfile = "harness" | "web" | "cli";
/**
 * Detects the /skanner runtime profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against whitelist ['harness','web','cli']
 *  2. `KADMON_SKANNER_PROFILE` env var — trim + lowercase + whitelist
 *  3. Harness markers — presence of any of:
 *       scripts/lib/state-store.ts  |  hooks/observe-pre.ts  |  data/observations.jsonl
 *  4. Web markers — package.json deps include react|next|vite,
 *                   OR pyproject.toml text includes 'fastapi'|'django'
 *  5. CLI markers — package.json has a `bin` field AND no web deps matched
 *  6. Fallback — 'web' (most common consumer scenario, per ADR-031)
 *
 * Always writes one stderr diagnostic JSON line: { source, profile, markers }.
 * source ∈ { 'arg', 'env', 'markers' }
 *
 * @param cwd         Root of the consumer project (defaults to process.cwd())
 * @param explicitArg Profile override passed directly by the caller (e.g. /skanner arg)
 */
export declare function detectSkannerProfile(cwd?: string, explicitArg?: string): SkannerProfile;
/**
 * Returns the toolchain configuration for the project at `cwd`.
 * mixed and unknown fall back to the TypeScript toolchain (conservative default).
 */
export declare function getToolchain(cwd?: string): Toolchain;
