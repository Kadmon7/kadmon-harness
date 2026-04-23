// Kadmon Harness — Install health diagnostic (pure).
// Checks the 3 canonical root symlinks (ADR-019), dist/ freshness, and the
// runtime environment. Consumed by session-start (banner) and /medik Check
// #9. Presentation lives in scripts/lib/install-remediation.ts per ADR-024.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const isDistStale = await (async () => {
    try {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const modPath = path.resolve(here, "..", "..", ".claude", "hooks", "scripts", "ensure-dist.js");
        const mod = (await import(pathToFileURL(modPath).href));
        return mod.isDistStale;
    }
    catch {
        return () => ({ stale: false, reason: "ensure-dist unavailable" });
    }
})();
const CANONICAL_NAMES = ["agents", "skills", "commands"];
function normalizePath(p) {
    return p.replace(/\\/g, "/");
}
function detectSymlink(rootDir, name) {
    const linkPath = path.join(rootDir, name);
    let lstat;
    try {
        lstat = fs.lstatSync(linkPath);
    }
    catch {
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
        let linkTarget = null;
        try {
            linkTarget = fs.readlinkSync(linkPath);
        }
        catch {
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
        }
        catch {
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
        }
        catch {
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
function detectAnomalies(symlinks, distPresent, distStale) {
    const anomalies = [];
    for (const s of symlinks) {
        switch (s.state) {
            case "symlink_ok":
            case "junction_ok":
                break;
            case "text_file":
                anomalies.push(`canonical-link:${s.name}:text_file (${s.fileSize ?? 0}b — likely Windows clone without MSYS=winsymlinks:nativestrict)`);
                break;
            case "missing":
                anomalies.push(`canonical-link:${s.name}:missing`);
                break;
            case "broken_target":
                anomalies.push(`canonical-link:${s.name}:broken_target (target=${s.target ?? "<unknown>"} does not resolve)`);
                break;
            case "regular_dir":
                anomalies.push(`canonical-link:${s.name}:regular_dir (expected symlink, got plain directory — manual mutation)`);
                break;
        }
    }
    if (!distPresent) {
        anomalies.push("dist_missing");
    }
    else if (distStale.stale) {
        anomalies.push(`dist_stale: ${distStale.reason}`);
    }
    return anomalies;
}
export function checkInstallHealth(rootDir) {
    const platform = process.platform;
    const nodeVersion = process.version;
    const runtimeRootEnv = process.env.KADMON_RUNTIME_ROOT ?? null;
    const inPluginCache = normalizePath(rootDir).includes("/plugins/cache/");
    const symlinks = CANONICAL_NAMES.map((name) => detectSymlink(rootDir, name));
    let distPresent = false;
    try {
        distPresent = fs.existsSync(path.join(rootDir, "dist"));
    }
    catch {
        distPresent = false;
    }
    let distStale;
    try {
        distStale = isDistStale(rootDir);
    }
    catch {
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
