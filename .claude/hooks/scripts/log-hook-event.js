// Shared module: append hook execution event to session-scoped JSONL.
// Called by blocking/warning hooks to persist structured hook data.
// Budget: <5ms (single appendFileSync). Never throws.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Log a hook execution event to hook-events.jsonl in the session temp dir.
 * @param {string} sessionId - The current session ID
 * @param {object} event - Hook event data
 * @param {string} event.hookName - Name of the hook
 * @param {string} event.eventType - One of: pre_tool, post_tool, post_tool_fail, pre_compact, session_start, stop
 * @param {string} [event.toolName] - Tool that triggered the hook
 * @param {number} event.exitCode - Hook exit code (0=pass, 1=warn, 2=block)
 * @param {boolean} event.blocked - Whether the hook blocked the operation
 * @param {number} event.durationMs - Hook execution time in ms (REQUIRED — caller must capture start = Date.now() and pass Date.now() - start)
 * @param {string} [event.error] - Error or warning message
 */
export function logHookEvent(sessionId, event) {
  try {
    if (!sessionId || !/^[a-zA-Z0-9_-]+$/.test(sessionId)) return;
    const dir = path.join(os.tmpdir(), "kadmon", sessionId);
    fs.mkdirSync(dir, { recursive: true });
    const entry = {
      timestamp: new Date().toISOString(),
      ...event,
    };
    fs.appendFileSync(
      path.join(dir, "hook-events.jsonl"),
      JSON.stringify(entry) + "\n",
    );
  } catch {
    // Never throw from hook event logger
  }
}
