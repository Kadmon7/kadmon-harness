#!/usr/bin/env node
// Hook: git-push-reminder | Trigger: PreToolUse (Bash)
// Purpose: Warn before git push if /verify or code-review wasn't run. Exit 1 as warning.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseStdin } from "./parse-stdin.js";
try {
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
            e.metadata?.agentType === "code-reviewer"
          )
            hasReview = true;
        } catch {
          /* skip */
        }
      }
      if (!hasVerify) warnings.push("typecheck/tests not run (/verify)");
      if (!hasReview) warnings.push("code-reviewer not invoked (/code-review)");
    }
  }

  if (warnings.length > 0) {
    console.log(`\u{26A0}\u{FE0F} Pre-push: ${warnings.join(", ")}`);
    process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: `git-push-reminder: ${err.message}` }));
}
process.exit(0);
