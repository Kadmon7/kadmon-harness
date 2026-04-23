export interface RotationOptions {
    readonly maxSizeBytes?: number;
    readonly keepLines?: number;
}
/**
 * Append a JSON-serializable entry as a single line to `logPath`. If the
 * file exceeds `maxSizeBytes` BEFORE appending, truncate to the last
 * `keepLines` lines first, then append. Never throws.
 */
export declare function writeRotatingJsonlLog(logPath: string, entry: unknown, opts?: RotationOptions): void;
/**
 * Read and parse all JSON lines from `logPath`. Corrupted lines are skipped
 * silently so one bad entry does not invalidate the whole log. Returns the
 * last `limit` entries when `limit` is provided.
 */
export declare function readRotatingJsonlLog(logPath: string, limit?: number): Array<Record<string, unknown>>;
