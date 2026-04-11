// Shared module: timestamped backup rotation for kadmon.db.
// Replaces the single kadmon.db.bak with up to N timestamped backups.
import fs from "node:fs";
import path from "node:path";
import { logHookError } from "./hook-logger.js";

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

    // Copy via temp file for atomic-ish write
    const tmpPath = backupPath + ".tmp";
    fs.copyFileSync(dbPath, tmpPath);
    fs.renameSync(tmpPath, backupPath);

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
