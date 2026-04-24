import type { InstallHealthReport } from "./install-health.js";
export interface VersionedInstallReport extends InstallHealthReport {
    readonly _v: number;
}
/**
 * Read install-diagnostic log entries and return them as typed
 * VersionedInstallReport objects.
 *
 * - v1.3+ entries (have `_v` key): returned as-is.
 * - Legacy entries (no `_v`): cast as `{ _v: 0, ...entry }`.
 * - Corrupt entries (missing rootDir | symlinks | timestamp): dropped with a
 *   stderr warning. Never throws on individual failures.
 * - Returns [] on outer / IO failure.
 *
 * NOTE: validation checks only field PRESENCE, not runtime shape. Consumers
 * should treat nested fields (e.g. `symlinks[i].status`) as `unknown` until a
 * Zod schema lands (deferred per ADR-028 Out of Scope).
 *
 * @param logDir - Override log directory (defaults to ~/.kadmon)
 * @param limit  - Return last N entries
 */
export declare function readTypedInstallDiagnostics(logDir?: string, limit?: number): VersionedInstallReport[];
