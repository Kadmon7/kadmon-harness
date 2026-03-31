import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  openDb,
  closeDb,
  upsertInstinct,
} from "../../scripts/lib/state-store.js";
import {
  startSession,
  endSession,
  getLastSession,
  loadSessionContext,
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

  it("loadSessionContext returns empty string when no sessions", () => {
    expect(loadSessionContext("unknown")).toBe("");
  });

  it("loadSessionContext returns markdown with session and instinct info", () => {
    startSession("sess-1", PROJECT);
    endSession("sess-1", { tasks: ["built feature"] });

    upsertInstinct({
      id: "inst-1",
      projectHash: PROJECT.projectHash,
      pattern: "always run tsc",
      action: "tsc --noEmit",
      confidence: 0.7,
    });

    const ctx = loadSessionContext(PROJECT.projectHash);
    expect(ctx).toContain("## Previous Session Context");
    expect(ctx).toContain("Branch: main");
    expect(ctx).toContain("Active instincts: 1");
    expect(ctx).toContain("[0.7] always run tsc");
  });
});
