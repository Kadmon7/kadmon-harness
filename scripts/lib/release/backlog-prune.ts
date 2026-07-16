// /release backlog-prune (plan-037 Step 1.4, ARCHITECT OVERRIDE 2026-07-13).
//
// AMBIGUITY-1 resolution: PRUNE-ONLY + WARN (not the plan's machine sub-heading append).
// pruneBacklog removes done "- [x] ..." lines from BACKLOG.md and leaves CHANGELOG.md
// byte-identical — the hand-written CHANGELOG narrative stays the sole record. As a
// safety net, every pruned item's id is checked (read-only) against the CHANGELOG text;
// ids that are NOT found surface as UnnarratedPruneWarning so nothing marked done-but-
// never-narrated is silently dropped.

import fs from "node:fs";
import path from "node:path";
import type { ReleaseContext, StepResult, UnnarratedPruneWarning } from "./types.js";
import { log } from "../utils.js";

const DONE_LINE_RE = /^- \[x\] /;
const ID_RE = /(AUD-\d+|R-\d+)/;

function backlogPath(cwd: string): string {
  return path.join(cwd, "BACKLOG.md");
}

function readChangelogText(changelogPath: string): string {
  try {
    return fs.readFileSync(changelogPath, "utf8");
  } catch (e: unknown) {
    // Missing/unreadable changelog is treated as "nothing narrated" — every pruned
    // item surfaces as a warning rather than silently skipping the safety net.
    log("warn", "readChangelogText failed: falling back to returning empty string (treated as nothing narrated)", {
      operation: "readChangelogText",
      fallback: "returning empty string (treated as nothing narrated)",
      error: e instanceof Error ? e.message : String(e),
    });
    return "";
  }
}

function parseId(line: string): string {
  const match = ID_RE.exec(line);
  return match ? match[1] : "";
}

/** Pure scan of "- [x] ..." lines in BACKLOG.md, returned verbatim. */
export function collectDoneItems(cwd: string): readonly string[] {
  const content = fs.readFileSync(backlogPath(cwd), "utf8");
  return content.split("\n").filter((line) => DONE_LINE_RE.test(line));
}

/**
 * Prune "- [x] ..." lines from BACKLOG.md. Read-only checks the given (already-
 * consolidated) CHANGELOG for each pruned item's id and reports any that were never
 * narrated. Never writes to changelogPath. Idempotent: no [x] items -> skipped.
 */
export function pruneBacklog(ctx: ReleaseContext, changelogPath: string): StepResult {
  const filePath = backlogPath(ctx.cwd);
  const done = collectDoneItems(ctx.cwd);

  if (done.length === 0) {
    return {
      step: "backlog-prune",
      status: "skipped",
      message: "No [x] items in BACKLOG.md — nothing to prune",
      filesTouched: [],
      details: { pruned: [], warnings: [] },
    };
  }

  const changelogText = readChangelogText(changelogPath);
  const warnings: UnnarratedPruneWarning[] = [];

  for (const line of done) {
    const id = parseId(line);
    const narrated = id !== "" && changelogText.includes(id);
    if (!narrated) {
      warnings.push({ line, id });
    }
  }

  const content = fs.readFileSync(filePath, "utf8");
  const pruned = content.split("\n").filter((line) => !DONE_LINE_RE.test(line)).join("\n");
  fs.writeFileSync(filePath, pruned, "utf8");

  return {
    step: "backlog-prune",
    status: "applied",
    message: `Pruned ${done.length} done item${done.length > 1 ? "s" : ""} from BACKLOG.md` +
      (warnings.length > 0 ? ` (${warnings.length} unnarrated)` : ""),
    filesTouched: ["BACKLOG.md"],
    details: { pruned: [...done], warnings },
  };
}
