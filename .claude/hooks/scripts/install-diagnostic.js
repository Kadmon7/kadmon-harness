// Hook module: install health diagnostic log (ADR-024).
// Writes the full InstallHealthReport to ~/.kadmon/install-diagnostic.log on
// every session-start. Bounded by the shared rotation policy in
// scripts/lib/rotating-jsonl-log.ts. Test-env guard redirects to stderr so
// vitest never pollutes the production log.
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LOG_FILENAME = "install-diagnostic.log";

// Resolve the compiled rotating-jsonl-log module once at module load via
// top-level await. require() of the compiled dist/*.js fails with
// ERR_REQUIRE_ESM on Node 18/20; pathToFileURL+import works everywhere.
const _rotatingLog = await (async () => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const modPath = path.resolve(
      here,
      "..",
      "..",
      "..",
      "dist",
      "scripts",
      "lib",
      "rotating-jsonl-log.js",
    );
    return await import(pathToFileURL(modPath).href);
  } catch {
    return {
      writeRotatingJsonlLog: () => {},
      readRotatingJsonlLog: () => [],
    };
  }
})();

/**
 * Persist an InstallHealthReport to the diagnostic log. Never throws.
 * When logDir is omitted and the process looks like a test environment,
 * the report is redirected to stderr to avoid polluting the production log.
 * @param {unknown} report - InstallHealthReport from checkInstallHealth()
 * @param {string} [logDir] - Override log directory (bypasses test-env guard)
 */
export function logInstallDiagnostic(report, logDir) {
  try {
    const inTestEnv =
      process.env.KADMON_TEST_DB !== undefined ||
      process.env.VITEST !== undefined ||
      process.env.NODE_ENV === "test";
    if (inTestEnv && logDir === undefined) {
      process.stderr.write(JSON.stringify(report) + "\n");
      return;
    }

    const dir = logDir ?? path.join(os.homedir(), ".kadmon");
    const logPath = path.join(dir, LOG_FILENAME);
    _rotatingLog.writeRotatingJsonlLog(logPath, { _v: 1, ...report });
  } catch {
    // Never throw from the logger — telemetry failures are non-fatal.
  }
}

/**
 * Read recent install-diagnostic entries. Returns empty array on any error.
 * Consumed by /medik Check #9.
 * @param {string} [logDir] - Override log directory
 * @param {number} [limit] - Return last N entries
 * @returns {Array<Record<string, unknown>>}
 */
export function readInstallDiagnostics(logDir, limit) {
  try {
    const dir = logDir ?? path.join(os.homedir(), ".kadmon");
    const logPath = path.join(dir, LOG_FILENAME);
    return _rotatingLog.readRotatingJsonlLog(logPath, limit);
  } catch {
    return [];
  }
}
