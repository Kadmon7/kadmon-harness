// Shared append-only JSONL log with size-based rotation.
// Extracted from .claude/hooks/scripts/hook-logger.js (ADR-024) to keep a
// single source of truth for rotation policy. Consumers: hook-logger.js and
// .claude/hooks/scripts/install-diagnostic.js.
import fs from "node:fs";
import path from "node:path";
const DEFAULT_MAX_SIZE_BYTES = 100_000;
const DEFAULT_KEEP_LINES = 50;
/**
 * Append a JSON-serializable entry as a single line to `logPath`. If the
 * file exceeds `maxSizeBytes` BEFORE appending, truncate to the last
 * `keepLines` lines first, then append. Never throws.
 */
export function writeRotatingJsonlLog(logPath, entry, opts = {}) {
    try {
        const maxSizeBytes = opts.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
        const keepLines = opts.keepLines ?? DEFAULT_KEEP_LINES;
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        if (fs.existsSync(logPath)) {
            const stat = fs.statSync(logPath);
            if (stat.size > maxSizeBytes) {
                const content = fs.readFileSync(logPath, "utf8");
                const lines = content.trim().split("\n");
                const truncated = lines.slice(-keepLines).join("\n") + "\n";
                fs.writeFileSync(logPath, truncated);
            }
        }
        fs.appendFileSync(logPath, JSON.stringify(entry) + "\n");
    }
    catch {
        // Never throw — telemetry failures must not crash the caller.
    }
}
/**
 * Read and parse all JSON lines from `logPath`. Corrupted lines are skipped
 * silently so one bad entry does not invalidate the whole log. Returns the
 * last `limit` entries when `limit` is provided.
 */
export function readRotatingJsonlLog(logPath, limit) {
    try {
        if (!fs.existsSync(logPath))
            return [];
        const lines = fs
            .readFileSync(logPath, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean);
        const entries = [];
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                if (parsed !== null && typeof parsed === "object") {
                    entries.push(parsed);
                }
            }
            catch {
                // Skip corrupted lines — preserve valid entries.
            }
        }
        if (limit !== undefined && limit < entries.length) {
            return entries.slice(-limit);
        }
        return entries;
    }
    catch {
        return [];
    }
}
