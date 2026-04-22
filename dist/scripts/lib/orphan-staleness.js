// ADR-022: orphan recovery staleness guard.
//
// A "live" session in another terminal continuously updates its
// observations.jsonl via observe-pre/observe-post hooks — de-facto heartbeat.
// A genuinely abandoned session (crash, killed process, compaction error) has
// no such updates. The `isOrphanStale` check distinguishes the two before the
// session-start orphan recovery path calls endSession on a candidate.
//
// Default stale threshold: 5 minutes, tunable via KADMON_ORPHAN_STALE_MS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const DEFAULT_STALE_MS = 5 * 60 * 1000;
// Upper bound on KADMON_ORPHAN_STALE_MS to prevent a typo (`9999999...`) from
// blocking orphan recovery indefinitely. 24h is already well past any
// legitimate crash-recovery window (spektr 2026-04-22 MEDIUM).
const MAX_STALE_MS = 24 * 60 * 60 * 1000;
// Claude Code session ids are UUIDs (hyphens + hex). Reject anything else so
// a corrupted or malicious DB row cannot drive `fs.statSync` toward an
// arbitrary filesystem path via `../` segments (spektr 2026-04-22 MEDIUM).
const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
/**
 * Return true when a candidate orphan session is safe to close — either its
 * observations.jsonl has not been touched in the stale window, or it has no
 * observations.jsonl at all and its startedAt is older than the stale window.
 *
 * Return false when the session shows signs of life: observations.jsonl
 * recently updated (indicating live tool activity in another terminal), or
 * the session started very recently and has no observations yet.
 */
export function isOrphanStale(sessionId, options) {
    // Defensive: reject ids that could path-traverse if the DB row is
    // corrupted. A rejected id is treated as stale — the orphan can still be
    // closed by endSession, the only thing we skip is the mtime read.
    if (!SESSION_ID_PATTERN.test(sessionId)) {
        return true;
    }
    const staleMs = resolveStaleMs();
    const now = Date.now();
    const tmpRoot = options.tmpRoot ?? os.tmpdir();
    const obsPath = path.join(tmpRoot, "kadmon", sessionId, "observations.jsonl");
    if (fs.existsSync(obsPath)) {
        const mtimeMs = fs.statSync(obsPath).mtimeMs;
        return now - mtimeMs >= staleMs;
    }
    // No observations.jsonl — fall back to startedAt age
    const startedMs = new Date(options.startedAt).getTime();
    if (Number.isNaN(startedMs)) {
        // Invalid timestamp — treat as stale so recovery proceeds rather than
        // indefinitely blocking. Better to accidentally close a truly-dead
        // session than to leave a garbage row forever.
        return true;
    }
    return now - startedMs >= staleMs;
}
function resolveStaleMs() {
    const raw = process.env.KADMON_ORPHAN_STALE_MS;
    if (!raw)
        return DEFAULT_STALE_MS;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return DEFAULT_STALE_MS;
    // Cap at MAX_STALE_MS so a runaway value doesn't block orphan recovery
    // forever.
    return Math.min(parsed, MAX_STALE_MS);
}
