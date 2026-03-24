// Shared stdin JSON parser for hooks.
// Handles unescaped Windows backslashes in paths sent by Claude Code.
import fs from 'node:fs';

export function parseStdin() {
  const raw = fs.readFileSync(0, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    // Claude Code on Windows may send unescaped backslashes in paths.
    // Double all lone backslashes and retry.
    const sanitized = raw.replace(/\\(?!["\\])/g, '\\\\');
    return JSON.parse(sanitized);
  }
}
