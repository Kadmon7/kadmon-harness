import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { rotateBackup } = (await import(
  path.resolve(".claude/hooks/scripts/backup-rotate.js")
)) as {
  rotateBackup: (
    dbPath: string,
    maxBackups?: number,
  ) => { backupPath: string; removed: string[] };
};

const TEMP_DIR = path.join(
  os.tmpdir(),
  `kadmon-backup-rotate-test-${Date.now()}`,
);
const DB_FILE = path.join(TEMP_DIR, "kadmon.db");

afterEach(() => {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
});

function setup(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, "test-db-content");
}

describe("rotateBackup", () => {
  it("creates a timestamped backup file that is a valid copy", () => {
    setup();
    const result = rotateBackup(DB_FILE);
    expect(result.backupPath).toMatch(/kadmon\.db\.bak\.\d{8}-\d{6}$/);
    expect(fs.existsSync(result.backupPath)).toBe(true);
    expect(fs.readFileSync(result.backupPath, "utf8")).toBe("test-db-content");
  });

  it("keeps only maxBackups files", () => {
    setup();
    // Create 5 backups with slight delay to get unique timestamps
    const results = [];
    for (let i = 0; i < 5; i++) {
      // Create backups with predictable names
      const bakPath = path.join(TEMP_DIR, `kadmon.db.bak.20260401-00000${i}`);
      fs.writeFileSync(bakPath, `backup-${i}`);
      results.push(bakPath);
    }

    // Now rotate with maxBackups=3
    const result = rotateBackup(DB_FILE, 3);
    expect(fs.existsSync(result.backupPath)).toBe(true);

    // Count remaining backups (including the new one)
    const backups = fs
      .readdirSync(TEMP_DIR)
      .filter((f) => f.startsWith("kadmon.db.bak."));
    expect(backups.length).toBe(3);
  });

  it("removes oldest backups first", () => {
    setup();
    // Create old backups
    fs.writeFileSync(
      path.join(TEMP_DIR, "kadmon.db.bak.20260101-000000"),
      "oldest",
    );
    fs.writeFileSync(
      path.join(TEMP_DIR, "kadmon.db.bak.20260201-000000"),
      "middle",
    );
    fs.writeFileSync(
      path.join(TEMP_DIR, "kadmon.db.bak.20260301-000000"),
      "newest",
    );

    const result = rotateBackup(DB_FILE, 3);
    // Should have removed oldest two (3 existing + 1 new = 4, keep 3)
    expect(result.removed.length).toBeGreaterThanOrEqual(1);
    expect(result.removed[0]).toContain("20260101");
  });

  it("handles first-ever backup with no existing backups", () => {
    setup();
    const result = rotateBackup(DB_FILE);
    expect(result.backupPath).toBeDefined();
    expect(result.removed).toEqual([]);
    expect(fs.existsSync(result.backupPath)).toBe(true);
  });

  it("migrates old-format kadmon.db.bak to timestamped format", () => {
    setup();
    // Create old-format backup with old mtime so it gets a different timestamp
    const oldBak = path.join(TEMP_DIR, "kadmon.db.bak");
    fs.writeFileSync(oldBak, "old-format-backup");
    const oldTime = new Date("2026-01-01T00:00:00Z");
    fs.utimesSync(oldBak, oldTime, oldTime);

    rotateBackup(DB_FILE);
    // Old format should be gone
    expect(fs.existsSync(oldBak)).toBe(false);
    // Should have 2 backups: migrated (from old mtime) + new (from now)
    const backups = fs
      .readdirSync(TEMP_DIR)
      .filter((f) => f.startsWith("kadmon.db.bak."));
    expect(backups.length).toBe(2);
    // The two backups should have different timestamps
    expect(backups[0]).not.toBe(backups[1]);
  });

  it("returns empty removed array when under limit", () => {
    setup();
    const result = rotateBackup(DB_FILE, 5);
    expect(result.removed).toEqual([]);
  });
});
