// TDD [feniks] — /release ADR-037 D7 amendment: upgrade-advisory.ts
// classifyPath/advisoryFromPaths/renderUpgradeAdvisory are pure — no git, no fs.
// computeUpgradeAdvisory is DI-tested with a fake runDiff (mirrors tag.test.ts /
// preflight.test.ts's ReleaseDeps injection pattern), PLUS one real tmp-git fixture
// test (e) exercising the un-injected default execFileSync path — never MOCKS child_process.
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  classifyPath,
  advisoryFromPaths,
  computeUpgradeAdvisory,
  renderUpgradeAdvisory,
} from "../../../scripts/lib/release/upgrade-advisory.js";
import type { UpgradeAdvisoryDeps, UpgradeAdvisory } from "../../../scripts/lib/release/upgrade-advisory.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("release/upgrade-advisory — classifyPath", () => {
  it("(a) plugin — .claude/agents/*", () => {
    expect(classifyPath(".claude/agents/feniks.md")).toBe("plugin");
  });

  it("(b) plugin — .claude/skills/*", () => {
    expect(classifyPath(".claude/skills/tdd-workflow/SKILL.md")).toBe("plugin");
  });

  it("(c) plugin — .claude/commands/*", () => {
    expect(classifyPath(".claude/commands/release.md")).toBe("plugin");
  });

  it("(d) plugin — .claude/hooks/*", () => {
    expect(classifyPath(".claude/hooks/scripts/observe-pre.js")).toBe("plugin");
  });

  it("(e) plugin — .claude-plugin/* (hyphen variant, distinct from .claude/)", () => {
    expect(classifyPath(".claude-plugin/plugin.json")).toBe("plugin");
  });

  it("(f) install — .claude/rules/*", () => {
    expect(classifyPath(".claude/rules/common/testing.md")).toBe("install");
  });

  it("(g) install — .claude/settings.json (exact)", () => {
    expect(classifyPath(".claude/settings.json")).toBe("install");
  });

  it("(h) install — install.sh (exact)", () => {
    expect(classifyPath("install.sh")).toBe("install");
  });

  it("(i) install — install.ps1 (exact)", () => {
    expect(classifyPath("install.ps1")).toBe("install");
  });

  it("(j) install — scripts/lib/install-apply.ts (installer lib prefix)", () => {
    expect(classifyPath("scripts/lib/install-apply.ts")).toBe("install");
  });

  it("(k) memoryRef — docs/onboarding/reference_kadmon_harness.md (exact)", () => {
    expect(classifyPath("docs/onboarding/reference_kadmon_harness.md")).toBe("memoryRef");
  });

  it("(l) memoryRef — docs/onboarding/CLAUDE.template.md (exact)", () => {
    expect(classifyPath("docs/onboarding/CLAUDE.template.md")).toBe("memoryRef");
  });

  it("(m) neutral — CHANGELOG.md", () => {
    expect(classifyPath("CHANGELOG.md")).toBe("neutral");
  });

  it("(n) neutral — README.md", () => {
    expect(classifyPath("README.md")).toBe("neutral");
  });

  it("(o) neutral — CLAUDE.md", () => {
    expect(classifyPath("CLAUDE.md")).toBe("neutral");
  });

  it("(p) neutral — scripts/lib/release/tag.ts (release lib itself)", () => {
    expect(classifyPath("scripts/lib/release/tag.ts")).toBe("neutral");
  });

  it("(q) neutral — tests/lib/release/tag.test.ts", () => {
    expect(classifyPath("tests/lib/release/tag.test.ts")).toBe("neutral");
  });

  it("(r) neutral — other docs/* (not the two memoryRef exact matches)", () => {
    expect(classifyPath("docs/decisions/adr-037.md")).toBe("neutral");
  });

  it("(s) Windows-backslash path normalizes to plugin (.claude\\agents\\x.md)", () => {
    expect(classifyPath(".claude\\agents\\feniks.md")).toBe("plugin");
  });

  it("(t) Windows-backslash path normalizes to install (.claude\\rules\\common\\testing.md)", () => {
    expect(classifyPath(".claude\\rules\\common\\testing.md")).toBe("install");
  });

  it("(u) boundary — .claude-plugin/ vs .claude/: .claude/agents/x.md is plugin via agents/ prefix, not the hyphen variant", () => {
    expect(classifyPath(".claude/agents/x.md")).toBe("plugin");
    expect(classifyPath(".claude-plugin/marketplace.json")).toBe("plugin");
  });

  it("(v) boundary — .claude/settings.json is install, .claude/commands/x.md is plugin (same .claude/ root, different territory)", () => {
    expect(classifyPath(".claude/settings.json")).toBe("install");
    expect(classifyPath(".claude/commands/x.md")).toBe("plugin");
  });

  it("(w) neutral — a .claude/ path that matches no explicit prefix (e.g. .claude/plugin.json is not .claude-plugin/)", () => {
    expect(classifyPath(".claude/plugin.json")).toBe("neutral");
  });
});

describe("release/upgrade-advisory — advisoryFromPaths (pure)", () => {
  it("(a) mixed multi-territory input groups correctly and sets all matching flags true", () => {
    const paths = [
      ".claude/agents/feniks.md",
      ".claude/rules/common/testing.md",
      "docs/onboarding/reference_kadmon_harness.md",
      "CHANGELOG.md",
    ];

    const advisory = advisoryFromPaths(paths);

    expect(advisory.needsPluginUpdate).toBe(true);
    expect(advisory.needsInstallRerun).toBe(true);
    expect(advisory.needsMemoryRefRedrop).toBe(true);
    expect(advisory.changedPaths.plugin).toEqual([".claude/agents/feniks.md"]);
    expect(advisory.changedPaths.install).toEqual([".claude/rules/common/testing.md"]);
    expect(advisory.changedPaths.memoryRef).toEqual(["docs/onboarding/reference_kadmon_harness.md"]);
  });

  it("(b) empty input -> all flags false, all arrays empty", () => {
    const advisory = advisoryFromPaths([]);

    expect(advisory.needsPluginUpdate).toBe(false);
    expect(advisory.needsInstallRerun).toBe(false);
    expect(advisory.needsMemoryRefRedrop).toBe(false);
    expect(advisory.changedPaths.plugin).toEqual([]);
    expect(advisory.changedPaths.install).toEqual([]);
    expect(advisory.changedPaths.memoryRef).toEqual([]);
  });

  it("(c) all-neutral input -> all flags false, all arrays empty (neutral paths dropped, not stored)", () => {
    const advisory = advisoryFromPaths(["CHANGELOG.md", "README.md", "scripts/lib/release/tag.ts"]);

    expect(advisory.needsPluginUpdate).toBe(false);
    expect(advisory.needsInstallRerun).toBe(false);
    expect(advisory.needsMemoryRefRedrop).toBe(false);
    expect(advisory.changedPaths.plugin).toEqual([]);
    expect(advisory.changedPaths.install).toEqual([]);
    expect(advisory.changedPaths.memoryRef).toEqual([]);
  });

  it("(d) multiple paths in the same territory are all preserved", () => {
    const advisory = advisoryFromPaths([".claude/agents/a.md", ".claude/skills/b/SKILL.md"]);

    expect(advisory.changedPaths.plugin).toEqual([".claude/agents/a.md", ".claude/skills/b/SKILL.md"]);
  });
});

describe("release/upgrade-advisory — computeUpgradeAdvisory (DI)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("(a) injects a fake runDiff and derives flags from the returned paths", () => {
    const calls: Array<{ cwd: string; range: string }> = [];
    const deps: UpgradeAdvisoryDeps = {
      runDiff: (cwd, range) => {
        calls.push({ cwd, range });
        return [".claude/agents/feniks.md", "CHANGELOG.md"];
      },
    };

    const advisory = computeUpgradeAdvisory("/fake/repo", "v1.3.0", undefined, deps);

    expect(advisory.needsPluginUpdate).toBe(true);
    expect(advisory.needsInstallRerun).toBe(false);
    expect(advisory.needsMemoryRefRedrop).toBe(false);
    expect(calls).toEqual([{ cwd: "/fake/repo", range: "v1.3.0..HEAD" }]);
  });

  it("(b) headRef override is threaded into the diff range", () => {
    const deps: UpgradeAdvisoryDeps = { runDiff: () => [] };
    let capturedRange = "";
    const spyDeps: UpgradeAdvisoryDeps = {
      runDiff: (cwd, range) => {
        capturedRange = range;
        return deps.runDiff(cwd, range);
      },
    };

    computeUpgradeAdvisory("/fake/repo", "v1.2.0", "release/next", spyDeps);

    expect(capturedRange).toBe("v1.2.0..release/next");
  });

  it("(c) empty diff (no changed paths) -> all flags false", () => {
    const deps: UpgradeAdvisoryDeps = { runDiff: () => [] };

    const advisory = computeUpgradeAdvisory("/fake/repo", "v1.3.0", undefined, deps);

    expect(advisory.needsPluginUpdate).toBe(false);
    expect(advisory.needsInstallRerun).toBe(false);
    expect(advisory.needsMemoryRefRedrop).toBe(false);
  });

  it("(d) default deps tolerate a git failure gracefully — never throws, returns a best-effort neutral advisory", () => {
    // No deps injected: the real default execFileSync git path runs against a cwd
    // that is not a git repo (or has no such tag), so git exits non-zero. The
    // contract requires this to be swallowed (return []) rather than throw.
    // Muted: the silent-swallow fix now logs a real warn line to stderr on this
    // path — this test predates that logging and asserts only the return-value
    // contract, so keep it silent rather than leaking JSON into test output.
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    let advisory: UpgradeAdvisory | undefined;

    expect(() => {
      advisory = computeUpgradeAdvisory("C:\\Command-Center\\Kadmon-Harness", "v999.999.999-does-not-exist");
    }).not.toThrow();

    expect(advisory?.needsPluginUpdate).toBe(false);
    expect(advisory?.needsInstallRerun).toBe(false);
    expect(advisory?.needsMemoryRefRedrop).toBe(false);
  });

  it("(e) default deps run real `git diff` against a tmp repo and classify a plugin-territory change", () => {
    // Exercises the un-injected defaultRunDiff (execFileSync + split/filter) end-to-end
    // against an ISOLATED tmp repo — never the live tree (project memory:
    // project_release_e2e_live_state_gotcha).
    const dir = mkdtempSync(join(tmpdir(), "kadmon-adv-"));
    const git = (args: readonly string[]): void => {
      execFileSync("git", [...args], { cwd: dir, stdio: "ignore" });
    };
    try {
      git(["init"]);
      git(["config", "user.email", "test@kadmon.dev"]);
      git(["config", "user.name", "kadmon-test"]);
      mkdirSync(join(dir, ".claude", "agents"), { recursive: true });
      writeFileSync(join(dir, ".claude", "agents", "feniks.md"), "seed\n");
      git(["add", "-A"]);
      git(["commit", "-m", "seed"]);
      git(["tag", "v0.0.1"]);
      // Second commit: a plugin-territory change + a neutral change.
      writeFileSync(join(dir, ".claude", "agents", "feniks.md"), "changed\n");
      writeFileSync(join(dir, "CHANGELOG.md"), "neutral\n");
      git(["add", "-A"]);
      git(["commit", "-m", "change plugin file"]);

      const advisory = computeUpgradeAdvisory(dir, "v0.0.1"); // no deps override -> real path

      expect(advisory.needsPluginUpdate).toBe(true);
      expect(advisory.needsInstallRerun).toBe(false);
      expect(advisory.needsMemoryRefRedrop).toBe(false);
      expect(advisory.changedPaths.plugin).toContain(".claude/agents/feniks.md");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(f) defaultRunDiff logs a warn when git diff fails, and computeUpgradeAdvisory still falls back to a no-op advisory (silent-swallow fix)", () => {
    // Isolated tmp dir with NO git init at all (mirrors test (e)'s mkdtempSync
    // convention — project memory project_release_e2e_live_state_gotcha bars
    // coupling this assertion to the live repo tree). A non-repo cwd is enough
    // to make the real `git diff` call fail without mocking child_process.
    const dir = mkdtempSync(join(tmpdir(), "kadmon-adv-fail-"));
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      let advisory: UpgradeAdvisory | undefined;
      expect(() => {
        advisory = computeUpgradeAdvisory(dir, "v999.999.999-does-not-exist");
      }).not.toThrow();

      expect(advisory?.needsPluginUpdate).toBe(false);
      expect(advisory?.needsInstallRerun).toBe(false);
      expect(advisory?.needsMemoryRefRedrop).toBe(false);

      expect(stderrSpy).toHaveBeenCalled();
      const entry = JSON.parse(String(stderrSpy.mock.calls[0][0]).trim());
      expect(entry.level).toBe("warn");
      expect(entry.operation).toBe("defaultRunDiff");
      expect(entry.fallback).toMatch(/empty/i);
      expect(typeof entry.error).toBe("string");
      expect(entry.error.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("release/upgrade-advisory — renderUpgradeAdvisory (pure)", () => {
  function baseAdvisory(overrides: Partial<UpgradeAdvisory> = {}): UpgradeAdvisory {
    return {
      needsPluginUpdate: false,
      needsInstallRerun: false,
      needsMemoryRefRedrop: false,
      changedPaths: { plugin: [], install: [], memoryRef: [] },
      ...overrides,
    };
  }

  it("(a) header line names the release via tagName", () => {
    const text = renderUpgradeAdvisory(baseAdvisory(), "v1.4.0");
    expect(text).toContain("v1.4.0");
  });

  it("(b) plugin-only advisory includes the exact plugin commands", () => {
    const text = renderUpgradeAdvisory(baseAdvisory({ needsPluginUpdate: true }), "v1.4.0");

    expect(text).toContain("/plugin marketplace update kadmon-harness");
    expect(text).toContain("/plugin update kadmon-harness@kadmon-harness");
    expect(text).toContain("/reload-plugins");
    expect(text).not.toContain("install.sh");
    expect(text).not.toContain("reference_kadmon_harness.md");
  });

  it("(c) install-only advisory includes the exact install commands (Windows + POSIX)", () => {
    const text = renderUpgradeAdvisory(baseAdvisory({ needsInstallRerun: true }), "v1.4.0");

    expect(text).toContain("install.ps1 -ForcePermissionsSync");
    expect(text).toContain("./install.sh");
    expect(text).not.toContain("/plugin marketplace update");
    expect(text).not.toContain("reference_kadmon_harness.md");
  });

  it("(d) memoryRef-only advisory names the file to re-drop and the memory/ target", () => {
    const text = renderUpgradeAdvisory(baseAdvisory({ needsMemoryRefRedrop: true }), "v1.4.0");

    expect(text).toContain("docs/onboarding/reference_kadmon_harness.md");
    expect(text).toContain("memory/");
    expect(text).not.toContain("/plugin marketplace update");
    expect(text).not.toContain("install.ps1");
  });

  it("(e) all-false advisory renders a single 'no consumer action needed' line, no command sections", () => {
    const text = renderUpgradeAdvisory(baseAdvisory(), "v1.4.0");

    expect(text.toLowerCase()).toContain("no consumer action needed");
    expect(text).not.toContain("/plugin marketplace update");
    expect(text).not.toContain("install.ps1");
    expect(text).not.toContain("reference_kadmon_harness.md");
  });

  it("(f) multi-flag advisory renders every applicable section", () => {
    const text = renderUpgradeAdvisory(
      baseAdvisory({ needsPluginUpdate: true, needsInstallRerun: true, needsMemoryRefRedrop: true }),
      "v2.0.0",
    );

    expect(text).toContain("v2.0.0");
    expect(text).toContain("/plugin marketplace update kadmon-harness");
    expect(text).toContain("install.ps1 -ForcePermissionsSync");
    expect(text).toContain("docs/onboarding/reference_kadmon_harness.md");
    expect(text.toLowerCase()).not.toContain("no consumer action needed");
  });

  it("(g) output is plain text (no markdown heading markers)", () => {
    const text = renderUpgradeAdvisory(baseAdvisory({ needsPluginUpdate: true }), "v1.4.0");
    expect(text).not.toMatch(/^#/m);
  });
});
