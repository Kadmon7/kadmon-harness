// Shared module: hook error logging to persistent file.
// Logs hook errors to ~/.kadmon/hook-errors.log instead of losing them to stderr.
// Rotation policy is delegated to scripts/lib/rotating-jsonl-log.ts (ADR-024)
// so a single source of truth governs all rotating JSONL logs in the harness.
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const LOG_FILENAME = "hook-errors.log";

// Resolve the compiled rotating-jsonl-log module once at module load via
// top-level await. Plain `require()` would throw ERR_REQUIRE_ESM on Node
// 18/20 because dist/ output is ESM ("type": "module" + Node16). Dynamic
// import() via pathToFileURL works on every supported runtime.
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
 * Log a hook error to the persistent error log.
 * Never throws — wraps in try/catch.
 * @param {string} hookName - Name of the hook that failed
 * @param {unknown} error - The error object or value
 * @param {Record<string, unknown>} [context] - Optional context data
 * @param {string} [logDir] - Override log directory. When provided, the
 *   test-env guard is bypassed (honoured by hook-logger.test.ts which
 *   intentionally exercises the log-writing path).
 */
export function logHookError(hookName, error, context, logDir) {
  try {
    // In test mode with no logDir override, redirect to stderr to avoid
    // polluting the production error log. Defense in depth: accept any
    // of 3 signals (KADMON_TEST_DB, VITEST, NODE_ENV=test) since the
    // first alone didn't suppress a top-level dynamic-import edge case.
    const inTestEnv =
      process.env.KADMON_TEST_DB !== undefined ||
      process.env.VITEST !== undefined ||
      process.env.NODE_ENV === "test";
    if (inTestEnv && logDir === undefined) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(
        JSON.stringify({ hook: hookName, error: errorMessage, context }) + "\n",
      );
      return;
    }

    const dir = logDir ?? path.join(os.homedir(), ".kadmon");
    const logPath = path.join(dir, LOG_FILENAME);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack =
      error instanceof Error && error.stack
        ? error.stack.split("\n").slice(0, 3).join("\n")
        : undefined;

    const entry = {
      timestamp: new Date().toISOString(),
      hook: hookName,
      error: errorMessage,
      ...(stack ? { stack } : {}),
      ...(context ? { context } : {}),
    };

    _rotatingLog.writeRotatingJsonlLog(logPath, entry);
  } catch {
    // Never throw from the logger — that would mask the original error
  }
}

/**
 * Read hook error entries from the log.
 * @param {string} [logDir] - Override log directory (for testing)
 * @param {number} [limit] - Return only the last N entries
 * @returns {Array<Record<string, unknown>>}
 */
export function getHookErrors(logDir, limit) {
  try {
    const dir = logDir ?? path.join(os.homedir(), ".kadmon");
    const logPath = path.join(dir, LOG_FILENAME);
    return _rotatingLog.readRotatingJsonlLog(logPath, limit);
  } catch {
    return [];
  }
}
