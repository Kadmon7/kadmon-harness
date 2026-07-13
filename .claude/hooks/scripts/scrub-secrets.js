// Shared module: secret scrubbing for observation persistence.
// Single source of truth used by observe-pre.js and observe-post.js so both
// hooks redact the same credential shapes before anything lands in
// observations.jsonl (AUD-02, 2026-07-12 audit §3).
// Pure regex work — safe within the <50ms observe hook latency budget for
// normal-sized inputs. AUD-30 item 1 (2026-07-13): both callers already
// slice their final persisted value to 200 chars (observe-pre.js /
// observe-post.js), so anything beyond a few KB of head is discarded
// downstream anyway. Without a cap here, a pathologically long Bash command
// or tool result would still force every regex pass below to scan the FULL
// string, which can blow the <50ms budget. 16 KB is a defensible cap: it is
// two orders of magnitude larger than the 200-char output any caller keeps,
// so no realistic credential-bearing prefix is ever cut short.

/** Regex work above this input length is capped — see comment above. */
export const MAX_SCRUB_INPUT_LENGTH = 16 * 1024;

/** Appended when input exceeds MAX_SCRUB_INPUT_LENGTH; the untouched tail is discarded, not scrubbed. */
export const TRUNCATION_MARKER = "…[truncated]";

/**
 * Redact known credential patterns from a string.
 * Applied to all fields that may contain credentials (commands, results, errors).
 * Inputs longer than MAX_SCRUB_INPUT_LENGTH are scrubbed only up to the cap;
 * the remainder is hard-truncated (never scanned, never emitted) so no
 * unscrubbed secret in the tail can leak past the cap.
 * @param {string} str
 * @returns {string}
 */
export function scrubSecrets(str) {
  const isOverCap = str.length > MAX_SCRUB_INPUT_LENGTH;
  const head = isOverCap ? str.slice(0, MAX_SCRUB_INPUT_LENGTH) : str;
  const scrubbed = head
    .replace(/(?:sk|pk)[-_](?:live|test)[-_][A-Za-z0-9]{20,}/g, "[REDACTED]")
    .replace(/ghp_[A-Za-z0-9]{36,}/g, "[REDACTED]")
    .replace(/xox[bpas]-[A-Za-z0-9-]{10,}/g, "[REDACTED]")
    .replace(
      /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^\s"',]{8,}/gi,
      "[REDACTED]",
    )
    .replace(/sk-ant-[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
    .replace(/AKIA[0-9A-Z]{16}/g, "[REDACTED]")
    .replace(/sbp_[a-f0-9]{40,}/g, "[REDACTED]");
  return isOverCap ? scrubbed + TRUNCATION_MARKER : scrubbed;
}
