/**
 * Redact sensitive path segments from `text`.
 *
 * REDACTION ORDER IS LOAD-BEARING. Do not reorder rules 1-6.
 * Rule 6 is the most permissive; it MUST run last so specific rules win.
 *
 * 1. homedir → `~`  (handles raw, JSON 1x, JSON 2x forms)
 * 2. additionalPaths (cross-project rootDirs, KADMON_RUNTIME_ROOT) → `<project-root>`
 * 3. Windows: `C:\Users\<segment>` → `C:\Users\<user>`  (1-4 backslash forms)
 * 4. macOS:   `/Users/<name>` → `/Users/<user>`
 * 5. Linux:   `/home/<name>` → `/home/<user>`
 * 6. cwd → `.`  (handles raw, JSON 1x, JSON 2x forms)
 * 7. catch-all absolute paths (>=3 segments, Windows or POSIX) → `<path>`
 */
export declare function redactSensitivePaths(text: string, cwd: string, homedir: string, additionalPaths?: readonly string[]): string;
/**
 * Generate a full ALV diagnostic report for `cwd`.
 * All paths are redacted before return — safe to share.
 */
export declare function generateAlvReport(cwd: string): string;
/**
 * Write an ALV report to disk and return the absolute path written.
 *
 * @param cwd       - Project root (health checks + redaction anchor)
 * @param outputDir - Write directory. MUST be inside `cwd` or `os.tmpdir()`.
 *                    Test-only override; production callers should omit and
 *                    accept the default (`cwd`). Throws if outside containment.
 *
 * Filename: `diagnostic-YYYY-MM-DDTHHmm.txt`  |  Mode: 0o600
 * Write is atomic (O_EXCL); a pre-existing file or symlink at the target path
 * triggers a one-shot random suffix retry; a second collision is re-thrown.
 */
export declare function writeAlvReport(cwd: string, outputDir?: string): string;
