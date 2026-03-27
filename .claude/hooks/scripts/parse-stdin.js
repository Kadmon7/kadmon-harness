// Shared stdin JSON parser for hooks.
// Handles unescaped Windows backslashes in paths sent by Claude Code.
import fs from "node:fs";

const MAX_STDIN = 1_000_000; // 1MB — inputs beyond this are truncated

export function parseStdin() {
  const raw = fs.readFileSync(0, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Claude Code on Windows may send unescaped backslashes in paths.
    const sanitized = raw.replace(/\\(?!["\\])/g, "\\\\");
    parsed = JSON.parse(sanitized);
  }
  // Track truncation for security hooks
  if (raw.length >= MAX_STDIN) parsed._truncated = true;
  return parsed;
}

export function wasTruncated(input) {
  return input?._truncated === true;
}

export function isDisabled(hookName) {
  const disabled = (process.env.KADMON_DISABLED_HOOKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return disabled.includes(hookName);
}
