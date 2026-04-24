// Shared module: timestamped backup rotation for kadmon.db.
// Replaces the single kadmon.db.bak with up to N timestamped backups.
import fs from "node:fs";
import path from "node:path";
import { logHookError } from "./hook-logger.js";

// Backoff schedule for EBUSY retries: 100ms → 250ms → 500ms
const EBUSY_DELAYS_MS = [100, 250, 500];

/**
 * Retry a synchronous function on EBUSY / EPERM (Windows file-lock race).
 * Uses Atomics.wait for synchronous sleep — safe in hook context (no event loop).
 *
 * Attempt schedule: initial call + up to EBUSY_DELAYS_MS.length retries.
 * Non-EBUSY/non-EPERM errors propagate immediately (no retry).
 *
 * @param {() => void} fn - Synchronous function to retry
 * @returns {{ ok: true } | { ok: false; err: unknown }}
 */
function retrySyncOnEbusy(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= EBUSY_DELAYS_MS.length; attempt++) {
    try {
      fn();
      return { ok: true };
    } catch (err) {
      const code =
        err != null && typeof err === "object" && "code" in err
          ? /** @type {{ code?: string }} */ (err).code
          : undefined;
      if (code !== "EBUSY" && code !== "EPERM") throw err;
      lastErr = err;
      const delayMs = EBUSY_DELAYS_MS[attempt];
      if (delayMs !== undefined) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
      }
    }
  }
  return { ok: false, err: lastErr };
}

/**
 * Create a timestamped backup and remove old backups beyond maxBackups.
 * Never throws — wraps in try/catch.
 * @param {string} dbPath - Path to the database file
 * @param {number} [maxBackups=3] - Maximum number of backups to keep
 * @returns {{ backupPath: string, removed: string[] }}
 */
export function rotateBackup(dbPath, maxBackups = 3) {
  try {
    const dir = path.dirname(dbPath);
    const baseName = path.basename(dbPath);

    // Migrate old-format .bak to timestamped format
    const oldBak = path.join(dir, `${baseName}.bak`);
    if (fs.existsSync(oldBak)) {
      const stat = fs.statSync(oldBak);
      const ts = formatTimestamp(stat.mtimeMs);
      const migratedPath = path.join(dir, `${baseName}.bak.${ts}`);
      fs.renameSync(oldBak, migratedPath);
    }

    // Create new timestamped backup
    const timestamp = formatTimestamp(Date.now());
    const backupPath = path.join(dir, `${baseName}.bak.${timestamp}`);

    // Copy via temp file for atomic-ish write (retry on EBUSY — Windows parallel sessions)
    const tmpPath = backupPath + ".tmp";
    const copyResult = retrySyncOnEbusy(() => fs.copyFileSync(dbPath, tmpPath));
    if (!copyResult.ok) {
      // EBUSY exhausted — expected Windows race, not a real error
      return { backupPath: "", removed: [] };
    }
    const renameResult = retrySyncOnEbusy(() => fs.renameSync(tmpPath, backupPath));
    if (!renameResult.ok) {
      // EBUSY exhausted on rename — clean up tmp and bail silently
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return { backupPath: "", removed: [] };
    }

    // Discover all timestamped backups and prune
    const allBackups = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(`${baseName}.bak.`) && !f.endsWith(".tmp"))
      .sort();

    const removed = [];
    while (allBackups.length > maxBackups) {
      const oldest = allBackups.shift();
      const oldestPath = path.join(dir, oldest);
      try {
        fs.unlinkSync(oldestPath);
        removed.push(oldestPath);
      } catch {
        // Skip if can't remove
      }
    }

    return { backupPath, removed };
  } catch (err) {
    logHookError("backup-rotate", err, { dbPath });
    return { backupPath: "", removed: [] };
  }
}

/**
 * @param {number} ms - Milliseconds since epoch
 * @returns {string} Formatted as YYYYMMDD-HHmmss
 */
function formatTimestamp(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}
