// scripts/lib/install-scaffold.ts — plan-041 Phase 1 Step 1.3.
// Step-0 project scaffolding (ADR-041 D1/D2). Invoked by install-apply.ts
// (gated by --no-scaffold), and by the two shells via that single TS gate.
//
// Contract:
//   - Create-if-missing, non-destructive. Existence is checked via an
//     lstat-based helper (entryExists), never fs.existsSync — existsSync
//     follows symlinks and reports FALSE for a dangling one, which would let
//     the create-if-missing gate open and follow the link (security review
//     M1, 2026-07-22). Content is NEVER inspected, so a populated
//     BACKLOG.md or a hand-authored docs/decisions/ is inviolable.
//   - A directory the function creates gets an empty .gitkeep so git tracks
//     it (git does not track empty directories). A pre-existing directory is
//     skipped entirely and never receives a .gitkeep.
//   - Every write is containment-checked (assertContained) against the
//     realpath of the nearest existing ancestor before it happens — this
//     rejects a docs/ symlink that would otherwise relocate the whole
//     scaffold outside targetRoot (security review M2, 2026-07-22).
//   - The BACKLOG template is read and validated (exists, non-empty) BEFORE
//     any directory is created, so a missing/empty template fails loud
//     without leaving a half-scaffolded tree behind (security review M3/L1,
//     2026-07-22). BACKLOG.md is copied verbatim from
//     docs/onboarding/BACKLOG.template.md (the <ProjectName> token is left
//     intact for the consumer to fill).
//   - `targetRoot` MUST be an absolute path — this is a library-boundary
//     guard (security review H1, 2026-07-22): a relative targetRoot must
//     never be silently resolved here, because that resolution would happen
//     against this process's cwd, not the caller's intended directory. The
//     caller (install-apply.ts, itself invoked with an absolute --target by
//     both shells) is responsible for passing an absolute path.
//   - Reported paths are repo-relative to targetRoot and forward-slash
//     normalized (Windows/POSIX parity), derived from the real absolute
//     path via path.relative() so Windows separator leakage is genuinely
//     exercised, not just assumed of hardcoded POSIX literals.
import fs from "node:fs";
import path from "node:path";
// Manifest (ADR-041 D2) — directories created empty + seeded with .gitkeep.
const SCAFFOLD_DIRS = [
    "docs/decisions",
    "docs/plans",
    "docs/research",
    "docs/state",
];
const BACKLOG_RELATIVE_PATH = "BACKLOG.md";
const BACKLOG_TEMPLATE_RELATIVE_PATH = "docs/onboarding/BACKLOG.template.md";
/**
 * True if `p` has any dirent present — including a dangling symlink.
 * fs.existsSync is stat-based: it follows symlinks and reports FALSE for a
 * dangling one, which would let a create-if-missing gate open and follow the
 * link (M1). lstat sees the link node itself regardless of where it points.
 */
function entryExists(p) {
    return fs.lstatSync(p, { throwIfNoEntry: false }) !== undefined;
}
function isEexist(err) {
    return (err instanceof Error &&
        err.code === "EEXIST");
}
/**
 * Walk up from `p` until an existing dirent is found (or the filesystem
 * root is reached). Used so the containment check below has something to
 * realpath even when intermediate path segments (e.g. a not-yet-created
 * "docs/") don't exist yet.
 */
function nearestExistingAncestor(p) {
    let current = p;
    while (!fs.existsSync(current)) {
        const parent = path.dirname(current);
        if (parent === current) {
            return current; // filesystem root — should not happen in practice
        }
        current = parent;
    }
    return current;
}
/**
 * Containment guard (M2): `absolutePath` must resolve to a location under
 * `targetRoot` even when an intermediate segment is a symlink pointing
 * elsewhere (e.g. target/docs -> ../elsewhere). Resolves the realpath of the
 * nearest existing ancestor of `absolutePath` and checks it is targetRoot or
 * a descendant of it. Mirrors the containment check in
 * scripts/lib/evolve-generate.ts (the trailing path.sep matters — without it
 * a sibling named `targetRootEVIL` would pass).
 */
function assertContained(targetRoot, absolutePath) {
    const realRoot = fs.realpathSync(targetRoot);
    const ancestor = nearestExistingAncestor(path.dirname(absolutePath));
    const realAncestor = fs.realpathSync(ancestor);
    if (realAncestor !== realRoot &&
        !realAncestor.startsWith(realRoot + path.sep)) {
        throw new Error(`install-scaffold: refusing to write "${absolutePath}" — resolves ` +
            `outside targetRoot (nearest existing ancestor "${realAncestor}" ` +
            `escapes "${realRoot}")`);
    }
}
/** Derive a repo-relative, forward-slash-normalized path for reporting. */
function toReportPath(targetRoot, absolutePath) {
    return path.relative(targetRoot, absolutePath).split(path.sep).join("/");
}
function scaffoldDir(targetRoot, absoluteDir) {
    if (entryExists(absoluteDir)) {
        return "skipped";
    }
    assertContained(targetRoot, absoluteDir);
    fs.mkdirSync(absoluteDir, { recursive: true });
    try {
        // wx: TOCTOU belt (defense in depth) — entryExists already sees dangling
        // symlinks, so this mainly guards a race with a concurrent install run.
        fs.writeFileSync(path.join(absoluteDir, ".gitkeep"), "", { flag: "wx" });
    }
    catch (err) {
        if (!isEexist(err)) {
            throw err;
        }
    }
    return "created";
}
function scaffoldBacklog(targetRoot, absoluteBacklog, templateBytes) {
    if (entryExists(absoluteBacklog)) {
        return "skipped";
    }
    assertContained(targetRoot, absoluteBacklog);
    try {
        fs.writeFileSync(absoluteBacklog, templateBytes, { flag: "wx" });
    }
    catch (err) {
        if (isEexist(err)) {
            return "skipped";
        }
        throw err;
    }
    return "created";
}
/**
 * Scaffold the decision-record substrate (docs/decisions, docs/plans,
 * docs/research, docs/state) plus a root BACKLOG.md into `targetRoot`.
 * Create-if-missing and non-destructive — safe to call any number of times.
 *
 * @param targetRoot - the consumer project root receiving the scaffold. MUST
 *   be an absolute path (library-boundary guard, H1) — the caller resolves
 *   it, this function never calls path.resolve() on it internally.
 * @param repoRoot - the Kadmon Harness repo root (source of the BACKLOG template)
 */
export function scaffoldProject(targetRoot, repoRoot) {
    if (!path.isAbsolute(targetRoot)) {
        throw new Error(`install-scaffold: targetRoot must be absolute (got "${targetRoot}")`);
    }
    // M3: read + validate the BACKLOG template BEFORE creating any
    // directories, so a missing/empty template fails loud before leaving a
    // half-scaffolded tree (docs/ dirs + no BACKLOG.md) behind — which, under
    // `set -euo pipefail`, would otherwise abort install.sh mid-run and skip
    // later steps (settings.local.json, .kadmon-version).
    const templatePath = path.join(repoRoot, ...BACKLOG_TEMPLATE_RELATIVE_PATH.split("/"));
    if (!fs.existsSync(templatePath)) {
        throw new Error(`install-scaffold: BACKLOG.md template not found at ${templatePath} — cannot scaffold BACKLOG.md`);
    }
    const templateBytes = fs.readFileSync(templatePath);
    if (templateBytes.length === 0) {
        // L1: a 0-byte BACKLOG.md would be unrepairable — create-if-missing
        // means no later, correct install can ever fix it once it lands.
        throw new Error(`install-scaffold: BACKLOG.md template at ${templatePath} is empty ` +
            `(0 bytes) — refusing to scaffold an unrepairable empty BACKLOG.md`);
    }
    const created = [];
    const skipped = [];
    for (const relativeDir of SCAFFOLD_DIRS) {
        const absoluteDir = path.join(targetRoot, ...relativeDir.split("/"));
        const outcome = scaffoldDir(targetRoot, absoluteDir);
        const reportPath = toReportPath(targetRoot, absoluteDir);
        if (outcome === "created") {
            created.push(reportPath);
        }
        else {
            skipped.push(reportPath);
        }
    }
    const absoluteBacklog = path.join(targetRoot, BACKLOG_RELATIVE_PATH);
    const backlogOutcome = scaffoldBacklog(targetRoot, absoluteBacklog, templateBytes);
    const backlogReportPath = toReportPath(targetRoot, absoluteBacklog);
    if (backlogOutcome === "created") {
        created.push(backlogReportPath);
    }
    else {
        skipped.push(backlogReportPath);
    }
    return { created, skipped };
}
