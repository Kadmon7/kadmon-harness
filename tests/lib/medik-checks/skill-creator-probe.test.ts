// TDD [feniks] — Check #13 skill-creator-probe (plan-028 Phase 5.1)
// Updated 2026-04-27 — plugin cache v2 layout: probe now derives the first
// candidate from `~/.claude/plugins/installed_plugins.json` registry rather
// than the legacy hardcoded `cache/skill-creator/SKILL.md` path.
import { describe, it, expect, vi, afterEach } from "vitest";
import { runCheck } from "../../../scripts/lib/medik-checks/skill-creator-probe.js";

// Mock node:fs so existsSync + readFileSync are controllable in tests
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn(),
  };
});

import * as fs from "node:fs";
const mockExistsSync = vi.mocked(fs.existsSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

const REGISTRY_JSON_OK = JSON.stringify({
  plugins: {
    "skill-creator@claude-plugins-official": [
      { installPath: "C:/fake/cache/claude-plugins-official/skill-creator/unknown" },
    ],
  },
});

const REGISTRY_JSON_NO_ENTRY = JSON.stringify({ plugins: {} });

describe("skill-creator-probe check (#13)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns PASS when registry candidate exists (plugin registry)", () => {
    mockReadFileSync.mockReturnValue(REGISTRY_JSON_OK);
    mockExistsSync.mockReturnValue(true);

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.category).toBe("runtime");
    expect(result.message).toMatch(/skill-creator found \(plugin registry\)/i);
  });

  it("returns PASS when only the project-skills candidate exists", () => {
    // Registry entry missing → only [project, global] candidates remain
    mockReadFileSync.mockReturnValue(REGISTRY_JSON_NO_ENTRY);
    mockExistsSync
      .mockReturnValueOnce(true); // candidate 1 = project skills

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/project skills/i);
  });

  it("returns PASS when only the global-skills candidate exists", () => {
    mockReadFileSync.mockReturnValue(REGISTRY_JSON_NO_ENTRY);
    mockExistsSync
      .mockReturnValueOnce(false) // project skills
      .mockReturnValueOnce(true); // global skills

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("PASS");
    expect(result.message).toMatch(/global skills/i);
  });

  it("returns WARN when registry missing and no fallback paths exist", () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockExistsSync.mockReturnValue(false);

    const result = runCheck({ projectHash: "test-proj", cwd: "/some/project" });

    expect(result.status).toBe("WARN");
    expect(result.message).toMatch(/skill-creator plugin missing/i);
    expect(result.message).toMatch(/\/evolve/i);
    expect(result.message).toMatch(/marketplace/i);
  });

  it("checks 3 candidates when registry resolves, 2 when it does not", () => {
    // Case A: registry resolves → 3 candidates checked
    mockReadFileSync.mockReturnValue(REGISTRY_JSON_OK);
    mockExistsSync.mockReturnValue(false);
    runCheck({ projectHash: "test-proj", cwd: "/test/cwd" });
    expect(mockExistsSync).toHaveBeenCalledTimes(3);

    const calls = mockExistsSync.mock.calls.map((c) => c[0] as string);
    expect(calls[0]).toMatch(/skills[/\\]skill-creator[/\\]SKILL\.md$/);
    expect(calls[1]).toContain("test");
    expect(calls[2]).toMatch(/\.claude[/\\]skills[/\\]skill-creator[/\\]SKILL\.md$/);

    // Case B: registry parse fails → only 2 fallback candidates
    vi.clearAllMocks();
    mockReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT");
    });
    mockExistsSync.mockReturnValue(false);
    runCheck({ projectHash: "test-proj", cwd: "/test/cwd" });
    expect(mockExistsSync).toHaveBeenCalledTimes(2);
  });
});
