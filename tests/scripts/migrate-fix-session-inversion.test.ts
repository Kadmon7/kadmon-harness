// TDD [feniks] — Phase 3 RED
// migrate-fix-session-inversion.test.ts
// Tests for the one-shot migration that repairs historical inverted sessions
// (ended_at < started_at) produced by the COALESCE resume bug (ADR-007, Bug B).
//
// Approach: direct module import of runMigration({ apply, dbPath }) — cleaner
// than subprocess invocation and consistent with migrate-archive-hygiene-instincts
// pattern already established in this repo.
//
// RED strategy: write test first. The script does not exist yet, so the import
// at line ~14 fails with module-not-found — a valid RED state.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, getDb } from "../../scripts/lib/state-store.js";
import { runMigration } from "../../scripts/migrate-fix-session-inversion.js";

// ─── Seed helpers ───

const PROJECT_HASH = "proj-migration-inversion-test";

function seedSession(
  id: string,
  startedAt: string,
  endedAt: string | null,
  durationMs: number | null,
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO sessions (id, project_hash, started_at, ended_at, duration_ms)
     VALUES (@id, @project_hash, @started_at, @ended_at, @duration_ms)`,
  ).run({
    id,
    project_hash: PROJECT_HASH,
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: durationMs,
  });
}

function getSessionRaw(
  id: string,
): { ended_at: string | null; duration_ms: number | null } | null {
  const db = getDb();
  const row = db
    .prepare("SELECT ended_at, duration_ms FROM sessions WHERE id = ?")
    .get(id);
  if (!row) return null;
  return {
    ended_at: row.ended_at != null ? String(row.ended_at) : null,
    duration_ms: row.duration_ms != null ? Number(row.duration_ms) : null,
  };
}

// ─── Suite ───

describe("migrate-fix-session-inversion", () => {
  beforeEach(async () => {
    await openDb(":memory:");

    // Seed 3 rows:
    //   inv-1: inverted (ended_at < started_at) with duration_ms set
    //   inv-2: inverted (ended_at < started_at) with duration_ms set
    //   ok-1:  normal   (ended_at > started_at) — must survive untouched
    seedSession(
      "inv-1",
      "2026-04-10T12:00:00.000Z", // started_at = T3 (resume time)
      "2026-04-10T11:00:00.000Z", // ended_at   = T2 (previous end, before T3) → INVERTED
      3600000, // 1 hour — stale duration from previous lifecycle
    );
    seedSession(
      "inv-2",
      "2026-04-11T15:00:00.000Z",
      "2026-04-11T14:30:00.000Z", // ended_at < started_at → INVERTED
      1800000,
    );
    seedSession(
      "ok-1",
      "2026-04-12T09:00:00.000Z",
      "2026-04-12T10:00:00.000Z", // ended_at > started_at → NORMAL
      3600000,
    );
  });

  afterEach(() => {
    closeDb();
  });

  // ─── Test 1: dry-run (default) ───

  it("dry-run reports 2 inverted rows without mutating the DB", () => {
    // Act
    const result = runMigration({ apply: false });

    // Assert: count
    expect(result.invertedCount).toBe(2);
    expect(result.repairedCount).toBe(0);
    expect(result.dryRun).toBe(true);

    // Assert: DB unchanged
    const inv1 = getSessionRaw("inv-1");
    expect(inv1?.ended_at).toBe("2026-04-10T11:00:00.000Z");
    expect(inv1?.duration_ms).toBe(3600000);

    const inv2 = getSessionRaw("inv-2");
    expect(inv2?.ended_at).toBe("2026-04-11T14:30:00.000Z");
    expect(inv2?.duration_ms).toBe(1800000);

    const ok1 = getSessionRaw("ok-1");
    expect(ok1?.ended_at).toBe("2026-04-12T10:00:00.000Z");
    expect(ok1?.duration_ms).toBe(3600000);
  });

  // ─── Test 2: --apply mutates exactly the 2 inverted rows ───

  it("apply NULLs ended_at and duration_ms on inverted rows only", () => {
    // Act
    const result = runMigration({ apply: true });

    // Assert: result shape
    expect(result.invertedCount).toBe(2);
    expect(result.repairedCount).toBe(2);
    expect(result.dryRun).toBe(false);

    // Assert: inverted rows are now NULL
    const inv1 = getSessionRaw("inv-1");
    expect(inv1?.ended_at).toBeNull();
    expect(inv1?.duration_ms).toBeNull();

    const inv2 = getSessionRaw("inv-2");
    expect(inv2?.ended_at).toBeNull();
    expect(inv2?.duration_ms).toBeNull();

    // Assert: normal row is untouched
    const ok1 = getSessionRaw("ok-1");
    expect(ok1?.ended_at).toBe("2026-04-12T10:00:00.000Z");
    expect(ok1?.duration_ms).toBe(3600000);
  });

  // ─── Test 3: idempotency — second apply reports 0 rows ───

  it("is idempotent — second apply finds 0 inverted rows", () => {
    // Act: first apply
    const first = runMigration({ apply: true });
    expect(first.repairedCount).toBe(2);

    // Act: second apply
    const second = runMigration({ apply: true });
    expect(second.invertedCount).toBe(0);
    expect(second.repairedCount).toBe(0);
    expect(second.dryRun).toBe(false);
  });
});
