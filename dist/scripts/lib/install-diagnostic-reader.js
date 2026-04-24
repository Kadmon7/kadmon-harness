// Kadmon Harness — Typed reader for install-diagnostic log entries (ADR-028).
// Wraps the untyped readInstallDiagnostics() from the hook module and applies
// per-entry validation + forward-compat _v versioning.
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const _diagnosticMod = await (async () => {
    try {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const modPath = path.resolve(here, "..", "..", ".claude", "hooks", "scripts", "install-diagnostic.js");
        return (await import(pathToFileURL(modPath).href));
    }
    catch {
        return {
            readInstallDiagnostics: () => [],
        };
    }
})();
// --------------------------------------------------------------------------
// Validation helpers
// --------------------------------------------------------------------------
const REQUIRED_FIELDS = ["rootDir", "symlinks", "timestamp"];
function isValidEntry(entry) {
    return REQUIRED_FIELDS.every((field) => field in entry);
}
function warnDropped(entry) {
    const missing = REQUIRED_FIELDS.filter((f) => !(f in entry));
    process.stderr.write(`[install-diagnostic-reader] warn: dropping entry missing required fields: ${missing.join(", ")} — entry: ${JSON.stringify(entry).slice(0, 120)}\n`);
}
// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
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
export function readTypedInstallDiagnostics(logDir, limit) {
    try {
        const resolvedDir = logDir ?? path.join(os.homedir(), ".kadmon");
        const raw = _diagnosticMod.readInstallDiagnostics(resolvedDir, limit);
        const result = [];
        for (const entry of raw) {
            try {
                if (!isValidEntry(entry)) {
                    warnDropped(entry);
                    continue;
                }
                const versioned = "_v" in entry
                    ? entry
                    : { _v: 0, ...entry };
                result.push(versioned);
            }
            catch (e) {
                process.stderr.write(`[install-diagnostic-reader] warn: per-entry failure (skipped): ${e instanceof Error ? e.message : String(e)}\n`);
            }
        }
        return result;
    }
    catch {
        return [];
    }
}
