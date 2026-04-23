---
number: 024
title: Install Health Telemetry — Passive Diagnostic Channel
date: 2026-04-22
status: accepted
route: A
plan: ya-quedo-entonces-los-ancient-eagle.md
references: [ADR-019, ADR-010]
---

# ADR-024: Install Health Telemetry — Passive Diagnostic Channel

**Deciders**: Ych-Kadmon (architect), arkitect (agent review 2026-04-22).

## Context

After ADR-019 shipped canonical root symlinks as the plugin loader contract, a real-world dogfood on 2026-04-22 with 5 collaborators (Mac + Windows) surfaced a recurring install-time failure mode. The symlinks themselves work correctly when created properly — but 2 of 5 collaborators cloned the repo on Windows without `MSYS=winsymlinks:nativestrict` in their environment, so the 3 canonical symlinks (`./agents`, `./skills`, `./commands`) materialized as **regular text files containing the target path string** instead of real symbolic links.

Symptoms: plugin loader finds only hooks (registered via `.claude-plugin/hooks.json`, bypass the symlinks), silently drops agents/skills/commands discovery. User sees a half-broken install with no actionable diagnostic.

Aggravating factors:
- **Developer Mode + `git config --global core.symlinks true` are necessary but not sufficient.** A Windows collaborator had both; the bug still reproduced because `MSYS=winsymlinks:nativestrict` was unset at clone time.
- **`mklink` (cmd.exe) fails silently** when creating symlinks in the plugin cache post-clone. Only PowerShell `New-Item -ItemType SymbolicLink` reliably creates the real link.
- **No telemetry.** When the bug reproduces on a collaborator's machine, we have no log to inspect remotely. Data is lost the moment the Claude Code session closes.
- **Recurrence on every release.** A macOS collaborator (clean install) confirmed the bug is not one-time: "cuando hagan update va a volver el error" — each `git pull` on Windows repeats the failure mode unless the env var is set permanently.
- **Unrelated cousin bug.** A separate symptom (`PreToolUse:Agent hook error — Failed with non-blocking status code: Skipping command-line '...bash.exe'`) surfaced in 1 case. It is out of scope for this ADR (Sprint E investigation) but the telemetry channel defined here will capture ambient diagnostics useful for that investigation too.

### Pre-ADR hypothesis (rejected)

The initial impulse was to auto-fix symlinks inside the `session-start` hook — detect the text-file state and synthesize real symlinks via PowerShell on Windows. That path was rejected for three reasons: (1) **too magic** — silent mutation of plugin-cache contents during session startup introduces hidden state, (2) **privilege unpredictable** — symlink creation requires Developer Mode, which we cannot verify from Node.js reliably, (3) **feedback loss** — auto-fixing masks the underlying setup problem, users learn nothing, and the next `git pull` brings it back.

## Decision

Introduce a **passive, non-blocking install health telemetry channel** with three surfaces:

### 1. Diagnostic module (pure) — `scripts/lib/install-health.ts`

Exports `checkInstallHealth(rootDir: string): InstallHealthReport`. Follows the same report-only pattern as `scripts/lib/db-health.ts` (consumed by `/medik` Check #5). Pure, sync, sub-5ms, never throws.

**Tri-state symlink detection** — per arkitect HIGH-severity critique, `fs.lstatSync().isSymbolicLink()` alone produces false negatives on NTFS junctions. The discriminator is `fs.realpathSync(p) !== path.resolve(p)`:

- `symlink_ok` — `isSymbolicLink() === true`, target resolves (ADR-019 canonical).
- `junction_ok` — Windows junction, realpath diverges from path, treated as NOTE-severity not FAIL. Operationally equivalent for the plugin loader.
- `broken_target` — symlink exists, target missing.
- `text_file` — regular file containing target string, size 14-16 bytes. THE bug this ADR exists to detect.
- `regular_dir` — manual mutation: someone replaced symlink with a real directory.
- `missing` — nothing at the expected path.

### 2. Presentation module (split) — `scripts/lib/install-remediation.ts`

Exports `renderRemediation(report): string`. Separate from the diagnostic per arkitect MEDIUM-severity critique on SRP alignment with `db-health.ts`. Banner is adaptive:

- If `report.inPluginCache === true` → render PowerShell `New-Item -ItemType SymbolicLink` remediation (the fix confirmed on 2026-04-22).
- Else → render `git checkout agents skills commands` with `MSYS=winsymlinks:nativestrict` env hint (local dev clone path).

The `renderRemediation` function is pure string transformation, testable in isolation without filesystem stubs.

### 3. Shared rotation helper — `scripts/lib/rotating-jsonl-log.ts`

Extracted from `.claude/hooks/scripts/hook-logger.js` (inline rotation code) per arkitect decision 3 on logger extraction. Exports `writeRotatingJsonlLog(logPath, entry, opts)` with a single policy: truncate to last 50 lines when file >100KB. Both `hook-logger.js` and the new `.claude/hooks/scripts/install-diagnostic.js` consume it, eliminating drift between two rotation implementations.

### 4. Session-start integration — passive banner

`.claude/hooks/scripts/session-start.js` calls `checkInstallHealth(rootDir)` post `resolveRootDir()`. Two outcomes:

- **Always**: `logInstallDiagnostic(report)` appends the report to `~/.kadmon/install-diagnostic.log`. This is the telemetry surface — remote debug, cross-session trend detection, evidence for Sprint E investigations.
- **On anomaly**: append a warning banner to the session-start output (same pattern as the existing `distNote`). Banner includes adaptive remediation from `renderRemediation`. **Exit code remains 0** — session continues normally. No blocking.

### 5. `/medik` Check #9

Row added to `.claude/commands/medik.md` Phase 1 checks table. The check invokes `checkInstallHealth()` via `npx tsx -e`; mekanik analyzes anomalies in Phase 2 and suggests the remediation (never auto-applies). This gives users a mid-session debug path equivalent to the session-start banner — critical for the "every-release recurrence" scenario a macOS collaborator flagged.

## Why "passive" (non-negotiable)

The core principle: **warn, don't mutate.** The harness observes its own install state and exposes diagnostics, but never silently corrects them. Three consequences follow:

- Auto-fix is out of scope. If the pain persists post-v1.2.3, a future `/medik repair --install` command may be considered — but gated behind explicit user invocation, never in hooks.
- The banner is informational, not obstructive. Users with knowingly-broken installs (intentional during debugging) are not blocked.
- The diagnostic log is append-only and bounded. 50-line rotation matches `hook-errors.log` policy — telemetry, not audit trail.

## Consequences

**Positive**

- Recurring bug now has telemetry. Next time a collaborator hits it on update, `~/.kadmon/install-diagnostic.log` has the evidence, no copy-paste from stderr required.
- `/medik` Check #9 gives a mid-session remediation path — users self-serve without pinging the architect.
- ADR-019 remains authoritative for the canonical symlink contract; this ADR adds an observability layer, no contract change.
- `rotating-jsonl-log.ts` cleans up a latent drift risk between `hook-logger.js` and the new diagnostic log — single source of truth for rotation policy.

**Negative**

- `session-start` gains ~3ms overhead (3× `lstatSync` + 1× `readlinkSync`). Benchmarked in tests with soft assert `<5ms`. Acceptable for the contract.
- One more file in `scripts/lib/` (`install-remediation.ts`) compared to the initial plan. Trade accepted for SRP alignment with `db-health.ts`.
- `~/.kadmon/install-diagnostic.log` grows by one line per session on healthy installs. Bounded by the 50-line rotation; ignorable.

**Out of scope / deferred**

- Auto-fix of symlinks during session-start. Reconsider if v1.2.3 telemetry shows the warning is insufficient in practice.
- Root cause fix for the `PreToolUse:Agent hook error — bash.exe skipping` symptom. Sprint E; ADR-025 if confirmed as a separate issue.
- Upstream fix for Claude Code's `/reload-plugins` post-install requirement. Not in our control.
- Setting `KADMON_RUNTIME_ROOT` inside `.claude-plugin/hooks.json`. Pending Claude Code `env` block support investigation (flagged in `generate-plugin-hooks.ts` header).
- **`/medik --export`** for shareable redacted diagnostic file (replaces copy-paste of stderr by collaborators). Tracked in [`docs/roadmap/v1.3-medik-expansion.md`](../roadmap/v1.3-medik-expansion.md) (renamed from v1.2.4 on 2026-04-23 per ADR-025).
- **Schema `_v: 1` field** on persisted `InstallHealthReport` entries — orakle MEDIUM deferred from v1.2.3 `/chekpoint`. Roadmap'd in v1.3.
- **Typed reader wrapper `readTypedInstallDiagnostics()`** — orakle MEDIUM deferred from v1.2.3 `/chekpoint`. Roadmap'd in v1.3.

## Review

- 2026-04-22 — accepted post-arkitect review in `/abra-kdabra` chain. Conditional on (1) tri-state detection, (2) install-remediation split, (3) rotating-jsonl-log extraction, (4) this ADR written before konstruct breakdown. All four conditions satisfied.
- Next review: 2026-07-22 (90 days) — evaluate if passive banner is sufficient or if `/medik repair --install` auto-fix is needed based on observed telemetry.
