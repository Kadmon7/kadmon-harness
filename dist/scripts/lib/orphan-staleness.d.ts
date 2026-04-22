export interface OrphanStalenessOptions {
    /** ISO timestamp — fallback when observations.jsonl is absent */
    startedAt: string;
    /** Override tmpdir root (tests only) — defaults to os.tmpdir() */
    tmpRoot?: string;
}
/**
 * Return true when a candidate orphan session is safe to close — either its
 * observations.jsonl has not been touched in the stale window, or it has no
 * observations.jsonl at all and its startedAt is older than the stale window.
 *
 * Return false when the session shows signs of life: observations.jsonl
 * recently updated (indicating live tool activity in another terminal), or
 * the session started very recently and has no observations yet.
 */
export declare function isOrphanStale(sessionId: string, options: OrphanStalenessOptions): boolean;
