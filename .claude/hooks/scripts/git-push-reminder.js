#!/usr/bin/env node
// Hook: git-push-reminder | Trigger: PreToolUse (Bash)
// Purpose: Warn before git push if /verify wasn't run, or if production code will push without review. Exit 1 as warning.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseStdin, isDisabled } from "./parse-stdin.js";
import { logHookEvent } from "./log-hook-event.js";
try {
  if (isDisabled("git-push-reminder")) process.exit(0);
  const start = Date.now();
  const input = parseStdin();
  const cmd = input.tool_input?.command ?? "";
  if (!cmd.includes("git push")) process.exit(0);

  const warnings = [];
  const sid = input.session_id ?? "";
  if (sid) {
    const obsFile = path.join(os.tmpdir(), "kadmon", sid, "observations.jsonl");
    if (fs.existsSync(obsFile)) {
      const lines = fs
        .readFileSync(obsFile, "utf8")
        .split("\n")
        .filter(Boolean);
      let hasVerify = false;
      let hasReview = false;
      for (const line of lines) {
        try {
          const e = JSON.parse(line);
          const cmd = e.metadata?.command ?? "";
          if (cmd.includes("tsc --noEmit") || cmd.includes("vitest run"))
            hasVerify = true;
          if (
            e.toolName === "Agent" &&
            ["kody", "typescript-reviewer"].includes(e.metadata?.agentType)
          )
            hasReview = true;
        } catch {
          /* skip */
        }
      }
      if (!hasVerify)
        warnings.push("typecheck/tests not run — run /chekpoint first");

      // Relaxed review check: only warn if unpushed commits contain production
      // code OR large refactors (>= 10 files). Docs/metadata/config commits are
      // legitimate "skip tier" commits and should not trigger a false alarm.
      // See .claude/rules/common/development-workflow.md "/chekpoint Tiers".
      if (!hasReview) {
        let hasProductionCode = false;
        let fileCount = 0;
        // Test hook: inject a colon-separated file list to bypass git diff.
        // Production code never sets this env var.
        const testFiles = process.env.KADMON_TEST_PUSH_FILES;
        if (testFiles !== undefined) {
          const files = testFiles.split(":").filter(Boolean);
          fileCount = files.length;
          hasProductionCode = files.some(
            (f) =>
              (f.startsWith("scripts/lib/") ||
                f.startsWith(".claude/hooks/scripts/")) &&
              (f.endsWith(".ts") || f.endsWith(".js")),
          );
        } else {
          try {
            const diffOutput = execFileSync(
              "git",
              ["diff", "@{u}..HEAD", "--name-only"],
              { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] },
            );
            const files = diffOutput.split("\n").filter(Boolean);
            fileCount = files.length;
            hasProductionCode = files.some(
              (f) =>
                (f.startsWith("scripts/lib/") ||
                  f.startsWith(".claude/hooks/scripts/")) &&
                (f.endsWith(".ts") || f.endsWith(".js")),
            );
          } catch {
            // No upstream tracked, or not a git repo, or git unavailable —
            // fall back to warning (safe default: assume review needed).
            hasProductionCode = true;
          }
        }

        if (hasProductionCode) {
          warnings.push(
            "production code unreviewed — run /chekpoint (full tier) first",
          );
        } else if (fileCount >= 10) {
          warnings.push(
            `${fileCount} files unreviewed — run /chekpoint (full tier) first`,
          );
        }
        // else: docs/metadata/typo commits — no warning (legitimate skip tier)
      }
    }
  }

  if (warnings.length > 0) {
    logHookEvent(sid, {
      hookName: "git-push-reminder",
      eventType: "pre_tool",
      toolName: "Bash",
      exitCode: 1,
      blocked: false,
      durationMs: Date.now() - start,
      error: warnings.join("; "),
    });
    console.error(`\u{26A0}\u{FE0F} Pre-push: ${warnings.join(", ")}`);
    process.exit(1);
  }
} catch (err) {
  console.error(
    JSON.stringify({
      error: `git-push-reminder: ${err instanceof Error ? err.message : String(err)}`,
    }),
  );
}
process.exit(0);
