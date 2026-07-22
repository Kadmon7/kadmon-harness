// Shared module: resolve the directory a Bash tool_input.command's git
// invocation targets (B1, 2026-07-21). Bash-matcher hooks run wrapped in
// `cd "$(git rev-parse --show-toplevel)"` (the session repo), so a command
// like `cd C:\other-repo && git commit -m "..."` still runs the HOOK's own
// git calls against the session repo unless the hook explicitly resolves and
// passes `cwd`. Pure parse + fs check — never executes anything.
import fs from "node:fs";
import path from "node:path";

// Consecutive LEADING `cd` segments are consumed in order and the LAST one
// wins — `cd scratch && cd repo && git commit` runs git in `repo`, and
// resolving to `scratch` let a staged secret past commit-quality's scan
// (reviewer-verified 2026-07-22). A `cd` appearing after a non-cd command,
// subshells, and command substitution remain out of scope: modelling full
// shell semantics is not worth the complexity for a hook-cwd heuristic, and
// chasing every crafted bypass is the arms race CORRECTIONS.md C-005 forbids.
const LEADING_CD_SEGMENT_RE = /^\s*cd\s+(?:"([^"]*)"|'([^']*)'|(\S+))\s*(?:&&|;)/;
const GIT_DASH_C_RE = /\bgit\s+-C\s+(?:"([^"]*)"|'([^']*)'|(\S+))/;

// A sane shell command never chains this many `cd`s; the cap is a belt-and-
// braces guard against a pathological input spinning the consume loop.
const MAX_CD_SEGMENTS = 32;

function firstCapturedGroup(match) {
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function existsAsDir(candidate) {
  try {
    return fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

// Git Bash reports paths as `/c/Users/...`; translate to `C:\Users\...` when
// the direct path doesn't exist (win32 only — /c/... has no meaning as a
// Windows path fallback on other platforms).
function resolveGitBashPath(candidate) {
  if (process.platform !== "win32") return null;
  const m = /^\/([a-zA-Z])\/(.*)$/.exec(candidate);
  if (!m) return null;
  const winPath = `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, "\\")}`;
  return existsAsDir(winPath) ? winPath : null;
}

function validateCandidate(candidate) {
  if (!candidate) return null;
  if (existsAsDir(candidate)) return candidate;
  return resolveGitBashPath(candidate);
}

/**
 * Resolve the directory a Bash command's git invocation targets.
 * @param {unknown} command - The raw Bash tool_input.command value (untrusted).
 * @returns {string | null} The resolved, existing directory, or null when the
 *   command has no explicit target — callers should fall back to
 *   `process.cwd()` in that case.
 */
export function resolveCommandCwd(command) {
  try {
    if (typeof command !== "string" || command.length === 0) return null;

    // `git -C <path>` sets the git process's own working directory, so it
    // overrides any shell `cd` that came before it — check it first.
    const dashCMatch = GIT_DASH_C_RE.exec(command);
    if (dashCMatch) {
      return validateCandidate(firstCapturedGroup(dashCMatch));
    }

    // Walk the leading `cd` chain, resolving each segment against the one
    // before it so a relative hop (`cd /base && cd sub`) lands correctly.
    let rest = command;
    let resolved = null;
    for (let i = 0; i < MAX_CD_SEGMENTS; i++) {
      const segment = LEADING_CD_SEGMENT_RE.exec(rest);
      if (!segment) break;

      const raw = firstCapturedGroup(segment);
      if (!raw) return null;
      const candidate =
        resolved && !path.isAbsolute(raw) && !raw.startsWith("/")
          ? path.resolve(resolved, raw)
          : raw;

      // A segment that does not resolve breaks the chain: we can no longer
      // say where the command lands, and guessing is worse than saying so.
      resolved = validateCandidate(candidate);
      if (!resolved) return null;

      rest = rest.slice(segment[0].length);
    }

    return resolved;
  } catch {
    return null;
  }
}
