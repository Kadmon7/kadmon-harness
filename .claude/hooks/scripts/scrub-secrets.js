// Shared module: secret scrubbing for observation persistence.
// Single source of truth used by observe-pre.js and observe-post.js so both
// hooks redact the same credential shapes before anything lands in
// observations.jsonl (AUD-02, 2026-07-12 audit §3).
// Pure regex work — safe within the <50ms observe hook latency budget.

/**
 * Redact known credential patterns from a string.
 * Applied to all fields that may contain credentials (commands, results, errors).
 * @param {string} str
 * @returns {string}
 */
export function scrubSecrets(str) {
  return str
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
}
