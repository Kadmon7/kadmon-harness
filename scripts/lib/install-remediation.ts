// Banner rendering for install health anomalies (ADR-024).
// Kept separate from install-health.ts (SRP — diagnostic vs presentation).
// Consumed by session-start banner and /medik Check #9 repair suggestion.

import path from "node:path";
import type { SymlinkStatus } from "./install-health.js";

export interface RemediationContext {
  readonly inPluginCache: boolean;
  readonly platform: NodeJS.Platform;
}

const ACTIONABLE_STATES: ReadonlyArray<SymlinkStatus["state"]> = [
  "text_file",
  "missing",
  "broken_target",
  "regular_dir",
];

function formatIssueLine(s: SymlinkStatus): string {
  const size = s.fileSize != null ? `, ${s.fileSize} bytes` : "";
  return `    - ${s.name} (${s.state}${size})`;
}

/**
 * Escape a string for safe interpolation inside a PowerShell double-quoted
 * literal. Without this, a rootDir containing `"`, `` ` ``, or `$` would
 * produce a banner that — when copy-pasted by the user — executes injected
 * PowerShell. Order matters: backtick first (so it does not double-escape
 * the escapes we add next), then dollar, then quote.
 */
function escapePwshDoubleQuoted(s: string): string {
  return s
    .replace(/`/g, "``")
    .replace(/\$/g, "`$")
    .replace(/"/g, '`"');
}

function renderPluginCacheRemediation(rootDir: string): string {
  const safeRoot = escapePwshDoubleQuoted(rootDir.replace(/\//g, "\\"));
  return [
    "  Fix (Windows plugin cache — run as admin in PowerShell):",
    `    $r = "${safeRoot}"`,
    '    Remove-Item "$r\\agents","$r\\skills","$r\\commands" -Force -ErrorAction SilentlyContinue',
    '    New-Item -ItemType SymbolicLink -Path "$r\\agents"   -Target "$r\\.claude\\agents"',
    '    New-Item -ItemType SymbolicLink -Path "$r\\skills"   -Target "$r\\.claude\\skills"',
    '    New-Item -ItemType SymbolicLink -Path "$r\\commands" -Target "$r\\.claude\\commands"',
    "  Then run: /reload-plugins",
  ].join("\n");
}

function renderRepoCloneRemediation(): string {
  return [
    "  Fix (dev clone — export env var, then restore symlinks from git):",
    "    export MSYS=winsymlinks:nativestrict     # Git Bash on Windows only",
    "    git config --global core.symlinks true",
    "    rm agents skills commands",
    "    git checkout agents skills commands",
    "    ls -la agents skills commands            # expect 'lrwxrwxrwx'",
  ].join("\n");
}

export function renderRemediationBanner(
  issues: ReadonlyArray<SymlinkStatus>,
  context: RemediationContext,
): string {
  const actionable = issues.filter((s) =>
    ACTIONABLE_STATES.includes(s.state),
  );
  if (actionable.length === 0) return "";

  // Derive rootDir from any issue path (strip trailing name segment).
  // Use path.dirname so Windows backslash paths are handled correctly —
  // lastIndexOf("/") returns -1 on those, corrupting the result.
  const samplePath = actionable[0]!.path;
  const rootDir = path.dirname(samplePath);

  const lines = [
    "",
    "⚠  WARNING: Kadmon Harness install is incomplete — plugin loader cannot discover components.",
    "  Canonical symlinks missing or invalid:",
    ...actionable.map(formatIssueLine),
    "",
    context.inPluginCache
      ? renderPluginCacheRemediation(rootDir)
      : renderRepoCloneRemediation(),
    "",
    "  Full diagnostic: ~/.kadmon/install-diagnostic.log",
    "  Troubleshooting: docs/onboarding/TROUBLESHOOTING.md",
  ];

  return lines.join("\n");
}
