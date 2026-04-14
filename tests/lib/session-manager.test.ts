import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, closeDb, getDb } from "../../scripts/lib/state-store.js";
import {
  startSession,
  endSession,
  getLastSession,
} from "../../scripts/lib/session-manager.js";
import type { ProjectInfo } from "../../scripts/lib/types.js";

const PROJECT: ProjectInfo = {
  projectHash: "testproj12345678",
  remoteUrl: "https://github.com/test/repo.git",
  branch: "main",
  rootDir: "/tmp/test",
};

describe("session-manager", () => {
  beforeEach(async () => {
    await openDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("starts a new session", () => {
    const s = startSession("sess-1", PROJECT);
    expect(s.id).toBe("sess-1");
    expect(s.projectHash).toBe(PROJECT.projectHash);
    expect(s.branch).toBe("main");
    expect(s.startedAt).toBeTruthy();
    expect(s.endedAt).toBeFalsy();
  });

  it("ends a session with updates", () => {
    startSession("sess-1", PROJECT);
    const ended = endSession("sess-1", {
      tasks: ["implemented feature X"],
      filesModified: ["src/foo.ts"],
      toolsUsed: ["Edit", "Bash"],
      messageCount: 15,
    });
    expect(ended).not.toBeNull();
    expect(ended!.endedAt).toBeTruthy();
    expect(ended!.durationMs).toBeGreaterThanOrEqual(0);
    expect(ended!.tasks).toEqual(["implemented feature X"]);
    expect(ended!.filesModified).toEqual(["src/foo.ts"]);
  });

  it("merges instead of resetting on duplicate startSession", () => {
    startSession("sess-1", PROJECT);
    endSession("sess-1", {
      tasks: ["task A"],
      filesModified: ["file.ts"],
      messageCount: 42,
      summary: "did work",
    });

    // Simulate /compact → SessionStart with same ID
    const merged = startSession("sess-1", PROJECT);
    expect(merged.compactionCount).toBe(1);
    expect(merged.tasks).toEqual(["task A"]);
    expect(merged.filesModified).toEqual(["file.ts"]);
    expect(merged.summary).toBe("did work");
    expect(merged.messageCount).toBe(42);
  });

  it("returns null when ending nonexistent session", () => {
    expect(endSession("nonexistent", {})).toBeNull();
  });

  it("retrieves last session for a project", () => {
    startSession("sess-1", PROJECT);
    startSession("sess-2", PROJECT);
    const last = getLastSession(PROJECT.projectHash);
    expect(last).not.toBeNull();
    expect(last!.id).toBe("sess-2");
  });

  it("endSession with undefined fields preserves existing data", () => {
    startSession("sess-preserve", PROJECT);
    // First endSession with actual data
    endSession("sess-preserve", {
      filesModified: ["a.ts", "b.ts"],
      toolsUsed: ["Read", "Edit"],
      tasks: ["initial task"],
      messageCount: 50,
    });

    // Call endSession again with undefined values (simulates empty observations)
    const result = endSession("sess-preserve", {
      filesModified: undefined,
      toolsUsed: undefined,
      tasks: undefined,
      messageCount: 5,
    });

    expect(result).not.toBeNull();
    // Existing data should be preserved, not overwritten
    expect(result!.filesModified).toEqual(["a.ts", "b.ts"]);
    expect(result!.toolsUsed).toEqual(["Read", "Edit"]);
    expect(result!.tasks).toEqual(["initial task"]);
  });

  // ─── ADR-007 Bug B: session timestamp inversion on resume ───

  it("(a) fresh session: ended_at >= started_at after endSession", () => {
    // Regression guard — should pass both before and after the fix.
    startSession("inv-a", PROJECT);
    endSession("inv-a", {});

    const row = getDb()
      .prepare("SELECT started_at, ended_at FROM sessions WHERE id = ?")
      .get("inv-a") as { started_at: string; ended_at: string | null } | null;
    expect(row).not.toBeNull();
    expect(row!.ended_at).not.toBeNull();
    expect(row!.ended_at! >= row!.started_at).toBe(true);
  });

  it("(b) resume after end: ended_at and duration_ms are NULL after second startSession", () => {
    // Bug B: without the fix, COALESCE preserves the old ended_at (T1) while
    // started_at is overwritten to T2, producing started_at > ended_at.
    // The fix calls clearSessionEndState before upsertSession so COALESCE
    // no longer sees a stale ended_at.
    startSession("inv-b", PROJECT);
    endSession("inv-b", {}); // sets ended_at = T1

    // Resume (simulate /compact → SessionStart with same ID)
    startSession("inv-b", PROJECT); // sets started_at = T2 > T1

    const row = getDb()
      .prepare(
        "SELECT started_at, ended_at, duration_ms FROM sessions WHERE id = ?",
      )
      .get("inv-b") as {
      started_at: string;
      ended_at: string | null;
      duration_ms: number | null;
    } | null;
    expect(row).not.toBeNull();
    // ADR-007: after resume, end state must be cleared — not retained from previous cycle
    expect(row!.ended_at).toBeNull();
    expect(row!.duration_ms).toBeNull();
  });

  it("(c) full cycle start→end→resume→end: final ended_at >= started_at (T2)", () => {
    // Bug B: without the fix, the final ended_at would be compared against the
    // T3 started_at from resume, but duration_ms still reflects T2 - T1.
    // With the fix, started_at = T2 (resume) and ended_at = T3 (second end),
    // so ended_at >= started_at must hold.
    startSession("inv-c", PROJECT);
    endSession("inv-c", {}); // T1 end

    startSession("inv-c", PROJECT); // T2 resume — started_at moves forward
    const secondEnd = endSession("inv-c", {}); // T3 end

    expect(secondEnd).not.toBeNull();

    const row = getDb()
      .prepare(
        "SELECT started_at, ended_at, duration_ms FROM sessions WHERE id = ?",
      )
      .get("inv-c") as {
      started_at: string;
      ended_at: string | null;
      duration_ms: number | null;
    } | null;
    expect(row).not.toBeNull();
    expect(row!.ended_at).not.toBeNull();
    // The invariant: ended_at must be at or after the resume's started_at
    expect(row!.ended_at! >= row!.started_at).toBe(true);
    // duration_ms must reflect T3 - T2, not T1 - T_original
    expect(row!.duration_ms).not.toBeNull();
    expect(row!.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("(d) invariant scan: no row has ended_at < started_at", () => {
    // Perma-guard: run several session lifecycles and assert the DB is clean.
    startSession("scan-1", PROJECT);
    endSession("scan-1", {});

    startSession("scan-2", PROJECT);
    endSession("scan-2", {});
    startSession("scan-2", PROJECT); // resume
    endSession("scan-2", {});

    startSession("scan-3", PROJECT);
    endSession("scan-3", {});
    startSession("scan-3", PROJECT); // resume, stays open

    const rows = getDb()
      .prepare(
        "SELECT id, started_at, ended_at FROM sessions WHERE ended_at IS NOT NULL AND ended_at < started_at",
      )
      .all() as Array<{ id: string; started_at: string; ended_at: string }>;
    expect(rows).toHaveLength(0);
  });
});
