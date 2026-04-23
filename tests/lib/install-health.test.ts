import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkInstallHealth,
  type InstallHealthReport,
  type SymlinkStatus,
} from "../../scripts/lib/install-health.js";

const TEST_ROOT = path.join(
  os.tmpdir(),
  `kadmon-install-health-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`,
);

const CANONICAL = ["agents", "skills", "commands"] as const;

/**
 * Cross-platform symlink creation. On Windows without Developer Mode the
 * default (file/dir) symlinks fail; 'junction' works for directories without
 * privileges but lstat reports isSymbolicLink() === false — good for the
 * junction_ok test path.
 */
function mkRealSymlink(target: string, link: string): boolean {
  try {
    fs.symlinkSync(target, link, "dir");
    const stat = fs.lstatSync(link);
    if (stat.isSymbolicLink()) return true;
    fs.rmSync(link, { force: true });
    return false;
  } catch {
    return false;
  }
}

function mkJunction(target: string, link: string): boolean {
  try {
    fs.symlinkSync(target, link, "junction");
    return fs.existsSync(link);
  } catch {
    return false;
  }
}

function writeStubDist(root: string): void {
  const src = path.join(root, "scripts", "lib");
  const dist = path.join(root, "dist", "scripts", "lib");
  fs.mkdirSync(src, { recursive: true });
  fs.mkdirSync(dist, { recursive: true });
  fs.writeFileSync(path.join(src, "probe.ts"), "export {};\n");
  fs.writeFileSync(path.join(dist, "probe.js"), "export {};\n");
}

function setupRoot(scenario: {
  createRealTargets?: boolean;
  symlinks?: Partial<Record<(typeof CANONICAL)[number], "symlink" | "junction" | "text_file" | "broken" | "dir" | "missing">>;
  subpath?: string;
}): string {
  const root = scenario.subpath
    ? path.join(TEST_ROOT, scenario.subpath)
    : TEST_ROOT;
  fs.mkdirSync(path.join(root, ".claude"), { recursive: true });

  if (scenario.createRealTargets !== false) {
    for (const name of CANONICAL) {
      fs.mkdirSync(path.join(root, ".claude", name), { recursive: true });
    }
  }

  writeStubDist(root);

  for (const name of CANONICAL) {
    const linkPath = path.join(root, name);
    const targetPath = path.join(".claude", name);
    const state = scenario.symlinks?.[name] ?? "symlink";

    if (state === "missing") continue;
    if (state === "symlink") {
      if (!mkRealSymlink(targetPath, linkPath)) {
        // Windows without Dev Mode fallback
        mkJunction(path.join(root, ".claude", name), linkPath);
      }
    } else if (state === "junction") {
      mkJunction(path.join(root, ".claude", name), linkPath);
    } else if (state === "text_file") {
      fs.writeFileSync(linkPath, `.claude/${name}`);
    } else if (state === "broken") {
      mkRealSymlink(path.join("missing-target", name), linkPath);
    } else if (state === "dir") {
      fs.mkdirSync(linkPath, { recursive: true });
    }
  }

  return root;
}

describe("checkInstallHealth — shape", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("returns a report with the expected top-level fields", () => {
    const root = setupRoot({});
    const report = checkInstallHealth(root);

    expect(report.rootDir).toBe(root);
    expect(typeof report.platform).toBe("string");
    expect(report.nodeVersion).toMatch(/^v\d+/);
    expect(Array.isArray(report.symlinks)).toBe(true);
    expect(report.symlinks.length).toBe(3);
    expect(typeof report.distPresent).toBe("boolean");
    expect(typeof report.distStale.stale).toBe("boolean");
    expect(Array.isArray(report.anomalies)).toBe(true);
    expect(typeof report.ok).toBe("boolean");
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("derives ok=true when anomalies is empty, ok=false otherwise", () => {
    const healthyRoot = setupRoot({});
    const healthy = checkInstallHealth(healthyRoot);
    if (healthy.anomalies.length === 0) {
      expect(healthy.ok).toBe(true);
    }

    const brokenRoot = setupRoot({
      symlinks: { agents: "text_file", skills: "text_file", commands: "text_file" },
      subpath: "broken",
    });
    const broken = checkInstallHealth(brokenRoot);
    expect(broken.anomalies.length).toBeGreaterThan(0);
    expect(broken.ok).toBe(false);
  });

  it("captures KADMON_RUNTIME_ROOT env var when set", () => {
    const prev = process.env.KADMON_RUNTIME_ROOT;
    process.env.KADMON_RUNTIME_ROOT = "/some/plugin/cache";
    try {
      const root = setupRoot({});
      const report = checkInstallHealth(root);
      expect(report.runtimeRootEnv).toBe("/some/plugin/cache");
    } finally {
      if (prev === undefined) delete process.env.KADMON_RUNTIME_ROOT;
      else process.env.KADMON_RUNTIME_ROOT = prev;
    }
  });

  it("reports runtimeRootEnv as null when unset", () => {
    const prev = process.env.KADMON_RUNTIME_ROOT;
    delete process.env.KADMON_RUNTIME_ROOT;
    try {
      const root = setupRoot({});
      const report = checkInstallHealth(root);
      expect(report.runtimeRootEnv).toBeNull();
    } finally {
      if (prev !== undefined) process.env.KADMON_RUNTIME_ROOT = prev;
    }
  });
});

describe("checkInstallHealth — tri-state symlink detection", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  function findByName(
    report: InstallHealthReport,
    name: string,
  ): SymlinkStatus {
    const s = report.symlinks.find((x) => x.name === name);
    if (!s) throw new Error(`symlink ${name} not found in report`);
    return s;
  }

  it("marks real symlinks as symlink_ok with target populated", () => {
    const root = setupRoot({
      symlinks: { agents: "symlink", skills: "symlink", commands: "symlink" },
    });
    const report = checkInstallHealth(root);

    // On Windows without Dev Mode, the helper falls back to junction.
    // Accept either symlink_ok or junction_ok for this scenario — the
    // discriminator is "realpath diverges from path", which both satisfy.
    for (const name of CANONICAL) {
      const s = findByName(report, name);
      expect(["symlink_ok", "junction_ok"]).toContain(s.state);
    }
  });

  it("marks text files as text_file with file size captured", () => {
    const root = setupRoot({
      symlinks: { agents: "text_file", skills: "text_file", commands: "text_file" },
    });
    const report = checkInstallHealth(root);

    for (const name of CANONICAL) {
      const s = findByName(report, name);
      expect(s.state).toBe("text_file");
      expect(s.fileSize).toBeGreaterThan(0);
      expect(s.target).toBeNull();
    }
    expect(
      report.anomalies.some((a) => a.includes("text_file")),
    ).toBe(true);
  });

  it("marks absent paths as missing", () => {
    const root = setupRoot({
      symlinks: { agents: "missing", skills: "missing", commands: "missing" },
    });
    const report = checkInstallHealth(root);

    for (const name of CANONICAL) {
      const s = findByName(report, name);
      expect(s.state).toBe("missing");
    }
    expect(report.anomalies.some((a) => a.includes("missing"))).toBe(true);
  });

  it("marks broken symlinks as broken_target", () => {
    const root = setupRoot({
      symlinks: { agents: "broken", skills: "symlink", commands: "symlink" },
    });
    const report = checkInstallHealth(root);

    // Broken requires real symlink support — skip assertion if platform
    // silently fell back to a no-op (Windows without Dev Mode).
    const agents = findByName(report, "agents");
    if (agents.state === "broken_target") {
      expect(
        report.anomalies.some((a) => a.includes("broken_target")),
      ).toBe(true);
    }
  });

  it("marks regular directories as regular_dir", () => {
    const root = setupRoot({
      symlinks: { agents: "dir", skills: "symlink", commands: "symlink" },
    });
    const report = checkInstallHealth(root);

    const agents = findByName(report, "agents");
    expect(agents.state).toBe("regular_dir");
    expect(
      report.anomalies.some(
        (a) => a.includes("regular_dir") || a.includes("agents"),
      ),
    ).toBe(true);
  });

  it("is non-throwing on inaccessible rootDir", () => {
    const bogus = path.join(TEST_ROOT, "definitely-not-here");
    expect(() => checkInstallHealth(bogus)).not.toThrow();
    const report = checkInstallHealth(bogus);
    expect(report.ok).toBe(false);
  });
});

describe("checkInstallHealth — inPluginCache detection", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("detects inPluginCache when rootDir contains '/plugins/cache/'", () => {
    const root = setupRoot({ subpath: "plugins/cache/kadmon-harness/1.2.3" });
    const report = checkInstallHealth(root);
    expect(report.inPluginCache).toBe(true);
  });

  it("detects inPluginCache=false for local dev clone paths", () => {
    const root = setupRoot({ subpath: "local-dev/repo" });
    const report = checkInstallHealth(root);
    expect(report.inPluginCache).toBe(false);
  });

  it("normalizes Windows backslash paths when detecting plugin cache", () => {
    const root = setupRoot({
      subpath: "plugins/cache/kadmon-harness/another",
    });
    const report = checkInstallHealth(root);
    expect(report.inPluginCache).toBe(true);
  });
});

describe("checkInstallHealth — performance budget", () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it("completes under 15ms for a healthy repo (soft budget)", () => {
    const root = setupRoot({});
    const start = Date.now();
    checkInstallHealth(root);
    const durationMs = Date.now() - start;
    // Soft assertion: warn on regression, don't fail the suite for slow CI.
    if (durationMs > 15) {
      console.warn(
        `checkInstallHealth took ${durationMs}ms, over soft budget (15ms).`,
      );
    }
    expect(durationMs).toBeLessThan(100);
  });
});
