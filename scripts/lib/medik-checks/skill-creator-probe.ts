// Kadmon Harness — /medik Check #13: skill-creator-probe (plan-028 Phase 5.2)
// Probes 3 candidate paths for the skill-creator plugin. WARN if none found.

import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import type { CheckContext, CheckResult } from "./types.js";

export function runCheck(ctx: CheckContext): CheckResult {
  const homedir = os.homedir();

  // Candidates in order of priority (plan-028 §Phase 5.2)
  const candidates = [
    path.join(homedir, ".claude", "plugins", "cache", "skill-creator", "SKILL.md"),
    path.join(ctx.cwd, ".claude", "skills", "skill-creator", "SKILL.md"),
    path.join(homedir, ".claude", "skills", "skill-creator", "SKILL.md"),
  ];

  // Human-readable labels (NOT absolute paths) — avoids leaking username when
  // the /medik conversational output is pasted (only --ALV output is redacted).
  const labels = ["plugin cache", "project skills", "global skills"];

  for (let i = 0; i < candidates.length; i++) {
    if (existsSync(candidates[i]!)) {
      return {
        status: "PASS",
        category: "runtime",
        message: `skill-creator found (${labels[i]})`,
      };
    }
  }

  return {
    status: "WARN",
    category: "runtime",
    message:
      "skill-creator plugin missing — /evolve step 6 Generate will fail. Install via Claude Code plugin marketplace.",
  };
}
