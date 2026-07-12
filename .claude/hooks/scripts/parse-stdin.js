// Shared stdin JSON parser for hooks.
// Handles unescaped Windows backslashes in paths sent by Claude Code.
import fs from "node:fs";

const MAX_STDIN = 1_000_000; // 1MB — inputs beyond this are truncated

// AUD-15 (2026-07-12 audit) — defense-in-depth prototype-pollution guard.
// JSON.parse() does not itself pollute Object.prototype: a `"__proto__"` key
// in the source becomes a normal OWN data property (via [[DefineOwnProperty]]),
// not the accessor — so nothing is exploitable from parseStdin() alone today.
// But this module is the single shared chokepoint every hook (22) routes
// stdin through, and a future consumer that does `Object.assign(target,
// parsed)` or a naive `for (k in parsed) target[k] = parsed[k]` merge WOULD
// trigger the real prototype setter for these own property names. Strip them
// here, once, so every current and future consumer is covered. Top-level
// only — parseStdin() itself never walks the object, and no consumer today
// deep-merges stdin, so a shallow guard matches the actual risk surface.
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];

function stripDangerousKeys(obj) {
  // Guard against non-object top-level JSON values (null, number, string,
  // boolean). `null` in particular crashes hasOwnProperty.call() below —
  // ToObject(null) throws "Cannot convert undefined or null to object".
  // Numbers/strings/booleans autobox safely through .call() and don't throw,
  // but there's nothing to strip on a primitive either way — no-op is correct.
  if (!obj || typeof obj !== "object") return obj;
  for (const key of DANGEROUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      delete obj[key];
    }
  }
  return obj;
}

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
  // Every valid top-level JSON value (object, array, string, number,
  // boolean, null) can legally arrive on stdin. This module is the single
  // chokepoint every hook routes through, and callers dereference the
  // result as `input.tool_input?.file_path` / `input.session_id` — i.e.
  // they optional-chain the NESTED property, not `input` itself. A `null`
  // or primitive top-level value would make that first access throw (or,
  // for `null`, crash inside stripDangerousKeys below). Normalize every
  // non-object (and null) top-level value to {} so every consumer stays
  // safe without having to special-case the shape itself.
  if (typeof parsed !== "object" || parsed === null) {
    parsed = {};
  }
  stripDangerousKeys(parsed);
  // Track truncation for security hooks
  if (raw.length >= MAX_STDIN) parsed._truncated = true;
  return parsed;
}

export function wasTruncated(input) {
  return input?._truncated === true;
}

// Security-critical hooks that must never be disabled via env var
const NEVER_DISABLE = new Set([
  "block-no-verify",
  "config-protection",
  "commit-quality",
]);

export function isDisabled(hookName) {
  if (NEVER_DISABLE.has(hookName)) return false;
  const disabled = (process.env.KADMON_DISABLED_HOOKS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return disabled.includes(hookName);
}
