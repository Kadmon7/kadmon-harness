// Kadmon Harness — Install health diagnostic (pure).
// Checks the 3 canonical root symlinks (ADR-019), dist/ freshness, and the
// runtime environment. Consumed by session-start (banner) and /medik Check
// #9. Presentation lives in scripts/lib/install-remediation.ts per ADR-024.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Reuse the existing staleness probe from the shared hooks module. Use
// top-level await dynamic import (not require()) because the target file
// .claude/hooks/scripts/ensure-dist.js is ESM — `require()` of it would
// throw ERR_REQUIRE_ESM on Node 18/20 (engine floor `>=18`).
type DistStaleProbe = (rootDir: string) => { stale: boolean; reason: string };

const isDistStale: DistStaleProbe = await (async () => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const modPath = path.resolve(
      here,
      "..",
      "..",
      ".claude",
      "hooks",
      "scripts",
      "ensure-dist.js",
    );
    const mod = (await import(pathToFileURL(modPath).href)) as {
      isDistStale: DistStaleProbe;
    };
    return mod.isDistStale;
  } catch {
    return () => ({ stale: false, reason: "ensure-dist unavailable" });
  }
})();

export type SymlinkState =
  | "symlink_ok"
  | "junction_ok"
  | "broken_target"
  | "text_file"
  | "regular_dir"
  | "missing";

export interface SymlinkStatus {
  readonly name: "agents" | "skills" | "commands";
  readonly path: string;
  readonly state: SymlinkState;
  readonly target: string | null;
  readonly fileSize: number | null;
}

export interface InstallHealthReport {
  readonly rootDir: string;
  readonly platform: NodeJS.Platform;
  readonly nodeVersion: string;
  readonly runtimeRootEnv: string | null;
  readonly inPluginCache: boolean;
  readonly symlinks: readonly SymlinkStatus[];
  readonly distPresent: boolean;
  readonly distStale: { readonly stale: boolean; readonly reason: string };
  readonly anomalies: readonly string[];
  readonly ok: boolean;
  readonly timestamp: string;
}

const CANONICAL_NAMES = ["agents", "skills", "commands"] as const;

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function detectSymlink(
  rootDir: string,
  name: SymlinkStatus["name"],
): SymlinkStatus {
  const linkPath = path.join(rootDir, name);

  let lstat: fs.Stats;
  try {
    lstat = fs.lstatSync(linkPath);
  } catch {
    return {
      name,
      path: linkPath,
      state: "missing",
      target: null,
      fileSize: null,
    };
  }

  // Real symbolic link — resolve target and classify.
  if (lstat.isSymbolicLink()) {
    let linkTarget: string | null = null;
    try {
      linkTarget = fs.readlinkSync(linkPath);
    } catch {
      linkTarget = null;
    }

    try {
      fs.statSync(linkPath); // follows the link; throws if target missing
      return {
        name,
        path: linkPath,
        state: "symlink_ok",
        target: linkTarget,
        fileSize: null,
      };
    } catch {
      return {
        name,
        path: linkPath,
        state: "broken_target",
        target: linkTarget,
        fileSize: null,
      };
    }
  }

  // Directory — could be a junction (NTFS, reparse point) OR a regular
  // directory that replaced a symlink. The discriminator is whether
  // realpath diverges from the resolved path: junctions redirect, real
  // directories do not.
  if (lstat.isDirectory()) {
    try {
      const resolved = path.resolve(linkPath);
      const real = fs.realpathSync(linkPath);
      if (normalizePath(resolved) !== normalizePath(real)) {
        return {
          name,
          path: linkPath,
          state: "junction_ok",
          target: real,
          fileSize: null,
        };
      }
      return {
        name,
        path: linkPath,
        state: "regular_dir",
        target: null,
        fileSize: null,
      };
    } catch {
      return {
        name,
        path: linkPath,
        state: "regular_dir",
        target: null,
        fileSize: null,
      };
    }
  }

  // Regular file — almost certainly the Windows clone bug: git wrote the
  // symlink target string as a text file because MSYS=winsymlinks:nativestrict
  // was unset during clone. Typical size: 14-16 bytes.
  if (lstat.isFile()) {
    return {
      name,
      path: linkPath,
      state: "text_file",
      target: null,
      fileSize: lstat.size,
    };
  }

  return {
    name,
    path: linkPath,
    state: "missing",
    target: null,
    fileSize: null,
  };
}

function detectAnomalies(
  symlinks: readonly SymlinkStatus[],
  distPresent: boolean,
  distStale: { stale: boolean; reason: string },
): string[] {
  const anomalies: string[] = [];

  for (const s of symlinks) {
    switch (s.state) {
      case "symlink_ok":
      case "junction_ok":
        break;
      case "text_file":
        anomalies.push(
          `canonical-link:${s.name}:text_file (${s.fileSize ?? 0}b — likely Windows clone without MSYS=winsymlinks:nativestrict)`,
        );
        break;
      case "missing":
        anomalies.push(`canonical-link:${s.name}:missing`);
        break;
      case "broken_target":
        anomalies.push(
          `canonical-link:${s.name}:broken_target (target=${s.target ?? "<unknown>"} does not resolve)`,
        );
        break;
      case "regular_dir":
        anomalies.push(
          `canonical-link:${s.name}:regular_dir (expected symlink, got plain directory — manual mutation)`,
        );
        break;
    }
  }

  if (!distPresent) {
    anomalies.push("dist_missing");
  } else if (distStale.stale) {
    anomalies.push(`dist_stale: ${distStale.reason}`);
  }

  return anomalies;
}

export function checkInstallHealth(rootDir: string): InstallHealthReport {
  const platform = process.platform;
  const nodeVersion = process.version;
  const runtimeRootEnv = process.env.KADMON_RUNTIME_ROOT ?? null;
  const inPluginCache = normalizePath(rootDir).includes("/plugins/cache/");

  const symlinks: SymlinkStatus[] = CANONICAL_NAMES.map((name) =>
    detectSymlink(rootDir, name),
  );

  let distPresent = false;
  try {
    distPresent = fs.existsSync(path.join(rootDir, "dist"));
  } catch {
    distPresent = false;
  }

  let distStale: { stale: boolean; reason: string };
  try {
    distStale = isDistStale(rootDir);
  } catch {
    distStale = { stale: false, reason: "probe failed" };
  }

  const anomalies = detectAnomalies(symlinks, distPresent, distStale);

  return {
    rootDir,
    platform,
    nodeVersion,
    runtimeRootEnv,
    inPluginCache,
    symlinks,
    distPresent,
    distStale,
    anomalies,
    ok: anomalies.length === 0,
    timestamp: new Date().toISOString(),
  };
}
