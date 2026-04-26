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
 * The three runtime profiles for /skanner, kartograf, arkonte, and /doks.
 * - harness: Kadmon Harness codebase (hook lifecycle, sql.js, session/instinct)
 * - web:     React/Next/Vite/FastAPI/Django consumer project
 * - cli:     CLI/library package (bin field, no UI deps)
 */
export type ProjectProfile = "harness" | "web" | "cli";
/**
 * @deprecated Use ProjectProfile (alias preserved for plan-031 imports).
 */
export type SkannerProfile = ProjectProfile;
/**
 * Detects the runtime profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against whitelist ['harness','web','cli']
 *  2. `KADMON_PROJECT_PROFILE` env var (umbrella, ADR-032) — trim + lowercase + whitelist
 *  3. `KADMON_SKANNER_PROFILE` env var (back-compat, ADR-031) — same normalization
 *  4. Harness markers — presence of any of:
 *       scripts/lib/state-store.ts  |  hooks/observe-pre.ts  |  data/observations.jsonl
 *  5. Web markers — package.json deps include react|next|vite,
 *                   OR pyproject.toml text includes 'fastapi'|'django'
 *  6. CLI markers — package.json has a `bin` field AND no web deps matched
 *  7. Fallback — 'web' (most common consumer scenario, per ADR-031)
 *
 * Always writes one stderr diagnostic JSON line: { source, profile, markers }.
 * source ∈ { 'arg', 'env', 'markers' }
 *
 * @param cwd         Root of the consumer project (defaults to process.cwd())
 * @param explicitArg Profile override passed directly by the caller (e.g. /skanner arg)
 */
export declare function detectProjectProfile(cwd?: string, explicitArg?: string): ProjectProfile;
/**
 * @deprecated Use detectProjectProfile (alias preserved for plan-031 callers).
 * Function reference is identical, so behavior is preserved exactly.
 */
export declare const detectSkannerProfile: typeof detectProjectProfile;
/**
 * Two-value profile for /medik diagnostic banner (ADR-033).
 * Collapses web|cli → consumer; harness stays harness.
 * Used as DIAGNOSTIC HINT only — never as a per-check skip gate.
 */
export type MedikProfile = "harness" | "consumer";
/**
 * Returns the /medik diagnostic-banner profile for the project at `cwd`.
 *
 * Precedence (top wins):
 *  1. `explicitArg` — validated against ['harness','consumer']
 *  2. `KADMON_MEDIK_PROFILE` env var — trim + lowercase + whitelist
 *  3. delegate to detectProjectProfile() and collapse 'web'|'cli' → 'consumer'
 *
 * NOT consumed by any runCheck() as a skip gate — diagnostic only (ADR-033).
 */
export declare function detectMedikProfile(cwd?: string, explicitArg?: string): MedikProfile;
/**
 * Returns the toolchain configuration for the project at `cwd`.
 * mixed and unknown fall back to the TypeScript toolchain (conservative default).
 */
export declare function getToolchain(cwd?: string): Toolchain;
