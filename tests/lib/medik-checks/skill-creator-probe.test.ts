// TDD [feniks] — Check #13 skill-creator-probe (plan-028 Phase 5.1)
import { describe, it, expect, vi, afterEach } from "vitest";
import { runCheck } from "../../../scripts/lib/medik-checks/skill-creator-probe.js";

// Mock node:fs so existsSync is controllable in tests
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn().mockReturnValue(false) };
});

import * as fs from "node:fs";
const mockExistsSync = vi.mocked(fs.existsSync);

describe("skill-creator-probe check (#13)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns PASS when first candidate path exists (plugin cache)", () => {
    // First candidate found — short-circuits
    mockExistsSync.mockReturnValue(true);

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/skill-creator.*found/i);
  });

  it("returns PASS when only the second candidate path exists (project local)", () => {
    // First path: not found; second: found; third: not checked
    mockExistsSync
      .mockReturnValueOnce(false) // candidate 1
      .mockReturnValueOnce(true); // candidate 2

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
  });

  it("returns PASS when only the third candidate path exists (global skills)", () => {
    mockExistsSync
      .mockReturnValueOnce(false) // candidate 1
      .mockReturnValueOnce(false) // candidate 2
      .mockReturnValueOnce(true); // candidate 3

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
  });

  it("returns WARN when none of the 3 candidate paths exist", () => {
    mockExistsSync.mockReturnValue(false);

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("WARN");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/skill-creator plugin missing/i);
    expect(result.message).toMatch(/\/evolve/i);
    expect(result.message).toMatch(/marketplace/i);
  });

  it("checks exactly 3 candidate paths in order", () => {
    mockExistsSync.mockReturnValue(false);

    runCheck({ projectHash: "test-proj", cwd: "/test/cwd" });

    // Should have called existsSync exactly 3 times
    expect(mockExistsSync).toHaveBeenCalledTimes(3);

    const calls = mockExistsSync.mock.calls.map((c) => c[0] as string);
    // Verify the paths follow expected pattern
    expect(calls[0]).toMatch(/plugins[/\\]cache[/\\]skill-creator[/\\]SKILL\.md$/);
    expect(calls[1]).toMatch(/\.claude[/\\]skills[/\\]skill-creator[/\\]SKILL\.md$/);
    expect(calls[2]).toMatch(/\.claude[/\\]skills[/\\]skill-creator[/\\]SKILL\.md$/);
    // Call 1 is homedir-based, call 2 is cwd-based, call 3 is homedir-based skills
    // Call 2 must include the cwd
    expect(calls[1]).toContain("test");
  });
});
