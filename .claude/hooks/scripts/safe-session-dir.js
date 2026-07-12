// Shared module: validate a session_id read from stdin before it is used to
// build a filesystem path (AUD-15). Claude Code generates session_id itself,
// so this is defense-in-depth rather than an actively exploited path — but a
// malformed or malicious value (e.g. containing "../" or a path separator)
// must never reach path.join() unvalidated.
//
// Single canonical implementation — every hook and shared module that turns
// session_id into a directory under os.tmpdir() must route through this
// function instead of carrying its own copy of the regex.
import path from "node:path";

export const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate sessionId and join it onto baseDir.
 * Returns null (never throws) on invalid input, matching the existing
 * early-return convention used across the hooks (process.exit(0) / return).
 * @param {string} baseDir - Directory the session directory lives under (e.g. path.join(os.tmpdir(), "kadmon"))
 * @param {unknown} sessionId - The raw session_id value from stdin (untrusted)
 * @returns {string | null} The joined, validated path, or null if sessionId is invalid
 */
export function safeSessionDir(baseDir, sessionId) {
  if (typeof sessionId !== "string" || !SESSION_ID_RE.test(sessionId)) {
    return null;
  }
  return path.join(baseDir, sessionId);
}
