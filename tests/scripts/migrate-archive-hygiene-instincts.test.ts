// TDD [feniks] — Phase 5 RED
// migrate-archive-hygiene-instincts.test.ts
// Tests for the one-shot migration script that archives redundant hygiene instincts.
// The script does NOT exist yet — all 4 tests must fail RED on import.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertInstinct,
  getInstinct,
  getActiveInstincts,
} from "../../scripts/lib/state-store.js";
import type { Instinct } from "../../scripts/lib/types.js";
import { runArchiveMigration } from "../../scripts/migrate-archive-hygiene-instincts.js";

// ─── Constants ───

const DELETED_HYGIENE_PATTERN_NAMES = [
  "Read files before editing them",
  "Verify before committing code",
  "Explore multiple files before taking action",
  "Search before writing new code",
  "Test after implementing changes",
  "Check dashboard for system health",
  "Plan before implementing changes",
  "Read tests alongside source code",
  "Commit before pushing",
  "Re-run tests after fixing failures",
  "Multi-file refactor pattern",
  "Glob search before editing",
  "Build after editing TypeScript",
] as const;

const PROJECT_HASH = "proj-migration-test";

// ─── Fixture builder ───

function makeInstinct(
  overrides: Partial<Instinct> & { id: string },
): Instinct {
  const now = "2026-04-12T00:00:00.000Z";
  return {
    id: overrides.id,
    projectHash: overrides.projectHash ?? PROJECT_HASH,
    pattern: overrides.pattern ?? "Default pattern",
    action: overrides.action ?? "Default action",
    confidence: overrides.confidence ?? 0.9,
    occurrences: overrides.occurrences ?? 10,
    contradictions: overrides.contradictions ?? 0,
    sourceSessions: overrides.sourceSessions ?? ["sess-seed"],
    status: overrides.status ?? "active",
    scope: overrides.scope ?? "project",
    domain: overrides.domain,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    promotedTo: overrides.promotedTo,
  };
}

// ─── Suite ───

describe("migrate-archive-hygiene-instincts", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  // ─── Test 1: archives matching active instincts, leaves others untouched ───

  it("archives all active instincts whose pattern matches a deleted hygiene name", async () => {
    // Arrange: 10 active hygiene instincts (first 10 of 13)
    for (let i = 0; i < 10; i++) {
      upsertInstinct(
        makeInstinct({
          id: `hyg-active-${i}`,
          pattern: DELETED_HYGIENE_PATTERN_NAMES[i],
          status: "active",
        }),
      );
    }

    // 1 active instinct with an unrelated pattern — must survive untouched
    upsertInstinct(
      makeInstinct({
        id: "unrelated-1",
        pattern: "unrelated-domain-pattern",
        status: "active",
      }),
    );

    // 1 pre-archived instinct matching a hygiene name — must NOT be re-archived
    const preArchivedUpdatedAt = "2026-04-10T00:00:00.000Z";
    upsertInstinct(
      makeInstinct({
        id: "pre-archived-1",
        // DELETED_HYGIENE_PATTERN_NAMES[11] = "Glob search before editing"
        pattern: DELETED_HYGIENE_PATTERN_NAMES[11],
        status: "archived",
        updatedAt: preArchivedUpdatedAt,
      }),
    );

    // Act
    const result = runArchiveMigration();

    // Assert: shape and count
    expect(result).toHaveProperty("archivedIds");
    expect(Array.isArray(result.archivedIds)).toBe(true);
    expect(result.archivedIds.length).toBe(10);

    // Assert: all 10 active hygiene instincts are now archived
    for (let i = 0; i < 10; i++) {
      const inst = getInstinct(`hyg-active-${i}`);
      expect(inst).not.toBeNull();
      expect(inst!.status).toBe("archived");
    }

    // Assert: unrelated instinct is still active
    const unrelated = getInstinct("unrelated-1");
    expect(unrelated).not.toBeNull();
    expect(unrelated!.status).toBe("active");

    // Assert: pre-archived instinct is still archived and updatedAt is unchanged
    const preArchived = getInstinct("pre-archived-1");
    expect(preArchived).not.toBeNull();
    expect(preArchived!.status).toBe("archived");
    expect(preArchived!.updatedAt).toBe(preArchivedUpdatedAt);
  });

  // ─── Test 2: idempotency ───

  it("is idempotent — running twice is a no-op on the second pass", async () => {
    // Arrange: 10 active hygiene instincts
    for (let i = 0; i < 10; i++) {
      upsertInstinct(
        makeInstinct({
          id: `hyg-idem-${i}`,
          pattern: DELETED_HYGIENE_PATTERN_NAMES[i],
          status: "active",
        }),
      );
    }

    // Act: first run
    const first = runArchiveMigration();
    expect(first.archivedIds.length).toBe(10);

    // Act: second run — must be a no-op
    const second = runArchiveMigration();
    expect(second.archivedIds.length).toBe(0);

    // Assert: row counts unchanged after second run — still 10 archived, 0 active hygiene
    const activeAfter = getActiveInstincts(PROJECT_HASH);
    expect(activeAfter.length).toBe(0);

    for (let i = 0; i < 10; i++) {
      const inst = getInstinct(`hyg-idem-${i}`);
      expect(inst!.status).toBe("archived");
    }
  });

  // ─── Test 3: returns deterministic list of IDs ───

  it("returns the list of archived instinct IDs from the first run", async () => {
    // Arrange: 10 active hygiene instincts with deterministic IDs hyg-0 through hyg-9
    for (let i = 0; i < 10; i++) {
      upsertInstinct(
        makeInstinct({
          id: `hyg-${i}`,
          pattern: DELETED_HYGIENE_PATTERN_NAMES[i],
          status: "active",
        }),
      );
    }

    // Act
    const result = runArchiveMigration();

    // Assert: the returned IDs match the seeded IDs exactly (order-independent)
    const expected = ["hyg-0", "hyg-1", "hyg-2", "hyg-3", "hyg-4",
                      "hyg-5", "hyg-6", "hyg-7", "hyg-8", "hyg-9"];
    expect(result.archivedIds.sort()).toEqual(expected.sort());
  });

  // ─── Test 4: no matching instincts — returns empty ───

  it("does nothing when no matching active instincts exist", async () => {
    // Arrange: only the unrelated instinct
    upsertInstinct(
      makeInstinct({
        id: "only-unrelated-1",
        pattern: "unrelated-domain-pattern",
        status: "active",
      }),
    );

    // Act
    const result = runArchiveMigration();

    // Assert: nothing archived
    expect(result.archivedIds.length).toBe(0);

    // Assert: unrelated instinct is still active
    const inst = getInstinct("only-unrelated-1");
    expect(inst).not.toBeNull();
    expect(inst!.status).toBe("active");
  });
});
