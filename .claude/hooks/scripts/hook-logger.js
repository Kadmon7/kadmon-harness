// Shared module: hook error logging to persistent file.
// Logs hook errors to ~/.kadmon/hook-errors.log instead of losing them to stderr.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOG_FILENAME = "hook-errors.log";
const MAX_LOG_SIZE = 100_000; // 100KB
const TRUNCATE_TO_LINES = 50;

/**
 * Log a hook error to the persistent error log.
 * Never throws — wraps in try/catch.
 * @param {string} hookName - Name of the hook that failed
 * @param {unknown} error - The error object or value
 * @param {Record<string, unknown>} [context] - Optional context data
 * @param {string} [logDir] - Override log directory (for testing)
 */
export function logHookError(hookName, error, context, logDir) {
  try {
    // In test mode with no logDir override, redirect to stderr to avoid
    // polluting the production error log. When logDir is explicitly provided
    // (e.g. hook-logger.test.ts), honour it so those tests still work.
    if (process.env.KADMON_TEST_DB !== undefined && logDir === undefined) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      process.stderr.write(
        JSON.stringify({ hook: hookName, error: errorMessage, context }) + "\n",
      );
      return;
    }

    const dir = logDir ?? path.join(os.homedir(), ".kadmon");
    fs.mkdirSync(dir, { recursive: true });
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

    // Truncate if file exceeds max size
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      if (stat.size > MAX_LOG_SIZE) {
        const content = fs.readFileSync(logPath, "utf8");
        const lines = content.trim().split("\n");
        const truncated = lines.slice(-TRUNCATE_TO_LINES).join("\n") + "\n";
        fs.writeFileSync(logPath, truncated);
      }
    }

    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
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

    if (!fs.existsSync(logPath)) return [];

    const lines = fs
      .readFileSync(logPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean);

    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip corrupted lines — don't lose valid entries
      }
    }

    if (limit && limit < entries.length) {
      return entries.slice(-limit);
    }

    return entries;
  } catch {
    return [];
  }
}
