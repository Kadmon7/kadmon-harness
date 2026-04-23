# Kadmon Harness — Troubleshooting

Known post-install issues observed during real-world dogfood (5 collaborators, Mac + Windows, 2026-04-22), with copy-paste remediation and how to report new ones.

**Quick triage**: run `/medik` — Check #9 (Install Health, ADR-024) reports the state of canonical symlinks, `dist/`, and the runtime environment. If any anomaly appears, the rest of this doc tells you how to fix it.

---

## Bug #1 — Canonical symlinks cloned as text files (Windows)

**Symptom**: Plugin loader discovers hooks but NOT agents, skills, or commands. `/agents` in Claude Code shows an empty list; `/plugin` reports partial install.

**Diagnosis**: In the plugin cache directory (or the dev clone root), the 3 canonical symlinks `agents`, `skills`, `commands` are 14-16 byte regular files instead of real symlinks.

```bash
# In the plugin cache (adjust path to your install)
ls -la ~/.claude/plugins/cache/kadmon-harness/kadmon-harness/*/agents
# Broken:   -rw-r--r--  1 user staff    14 ...  agents
# Healthy:  lrwxrwxrwx  1 user staff    14 ...  agents -> .claude/agents
```

**Cause**: On Windows Git Bash, `git clone` writes symlinks as text files unless `MSYS=winsymlinks:nativestrict` is set *at clone time*. Developer Mode ON + `git config --global core.symlinks true` are necessary but **not sufficient** — the MSYS env var is the missing piece. Evidence: Abraham (2026-04-22) had Dev Mode + `GIT_SYMLINKS=true` but `MSYS=""` → bug reproduced.

### Fix A — Plugin cache (no re-install needed)

Run in **PowerShell as admin** (cmd's `mklink` fails silently here — verified 2026-04-22):

```powershell
$r = "C:\Users\<you>\.claude\plugins\cache\kadmon-harness\kadmon-harness\<version>"
Remove-Item "$r\agents","$r\skills","$r\commands" -Force -ErrorAction SilentlyContinue
New-Item -ItemType SymbolicLink -Path "$r\agents"   -Target "$r\.claude\agents"
New-Item -ItemType SymbolicLink -Path "$r\skills"   -Target "$r\.claude\skills"
New-Item -ItemType SymbolicLink -Path "$r\commands" -Target "$r\.claude\commands"
```

Then in Claude Code: `/reload-plugins`.

### Fix B — Dev clone (for harness contributors)

Set the env var permanently, then restore from git:

```bash
# In Git Bash, from the harness clone root
export MSYS=winsymlinks:nativestrict         # add to ~/.bashrc for persistence
git config --global core.symlinks true
rm agents skills commands
git checkout agents skills commands
ls -la agents skills commands                # expect 'lrwxrwxrwx'
```

### Fix C — Fresh re-clone (if the repo is disposable)

```bash
export MSYS=winsymlinks:nativestrict
git clone git@github.com:Kadmon7/Kadmon-Harness.git
```

### Verify the fix landed

```bash
/medik               # Check #9 should report "ok: true"
```

Or manually:

```bash
npx tsx -e "import('./scripts/lib/install-health.ts').then(m => console.log(m.checkInstallHealth(process.cwd()).symlinks))"
# Expect all 3 entries with state: "symlink_ok"
```

---

## Bug #2 — `PreToolUse:Agent hook error — bash.exe skipping` (Windows)

**Symptom** (verbatim from the field):

```
⎿  PreToolUse:Agent hook error
⎿  Failed with non-blocking status code: Skipping command-line
   '"C:\Program Files\Git\bin\..\usr\bin\bash.exe"'
```

**Status**: Under investigation (Sprint E — out of scope for ADR-024 v1.2.3).

**Working hypothesis**: The generated `${HOOK_CMD_PREFIX}` in `.claude-plugin/hooks.json` injects bash-pipeline syntax (`PATH="$PATH:/c/Program Files/nodejs" node ...`). Claude Code's Agent tool context on Windows may invoke hooks via a shell that cannot execute bash pipelines, so the hook is skipped with a non-blocking status.

**Observed workaround (confirmed by field evidence)**: Fixing Bug #1 first (the symlink clone bug) has, in every case so far, resolved Bug #2 as well. This suggests either the two bugs share a root cause (plugin loader giving up on anything it can't discover through the canonical symlinks), or Bug #2 is masked once agents/skills/commands start loading correctly.

**If you hit this**: fix the symlinks via Bug #1 remediation above, run `/reload-plugins`, and report back. If Bug #2 persists AFTER symlinks are verified `symlink_ok`, open an issue with the output of `/medik` Check #9 + the full hook error message.

---

## Bug #3 — `/reload-plugins` required after first install

**Symptom**: After installing the plugin via `/plugin install kadmon-harness@kadmon-harness`, agents/skills/commands are not immediately visible. Running `/reload-plugins` (or restarting Claude Code) makes them appear.

**Status**: Claude Code upstream quirk — the plugin cache is not refreshed synchronously after install. Not in our control.

**Workaround**: Always run `/reload-plugins` after `/plugin install`. This is the documented flow — treat it as step 2 of a 2-step install.

---

## How to report a new install issue

When something still breaks after trying the fixes above, we need evidence. Collect these three artifacts:

1. **`/medik` Check #9 output** — run `/medik` and copy the Check #9 row (or the full report if curious).
2. **`~/.kadmon/install-diagnostic.log`** — the last ~5 entries. Every session-start appends one line here (ADR-024). It's the most useful single file for remote debugging because it captures `platform`, `nodeVersion`, `KADMON_RUNTIME_ROOT`, symlink states, and `dist/` presence at the exact moment of the failure.
3. **`~/.kadmon/hook-errors.log`** — the last 10 entries. If any hook script is failing at import/startup, this file has the error message.

Paste those three into an issue or DM. Do NOT paste credentials, tokens, or content of arbitrary files — the logs above are scoped to harness-internal state only.

---

## Environment setup checklist (Windows Git Bash, one-time)

Run once per machine before cloning or installing the plugin:

```bash
# Developer Mode — Settings -> Privacy & security -> For developers -> ON
# (UI path; no CLI equivalent)

git config --global core.symlinks true

# Add to ~/.bashrc (create if missing)
echo 'export MSYS=winsymlinks:nativestrict' >> ~/.bashrc
source ~/.bashrc

# Verify
echo "MSYS=$MSYS"                                        # expect MSYS=winsymlinks:nativestrict
git config --global core.symlinks                        # expect true
```

After this, every future clone/install inherits the correct symlink behavior and Bug #1 cannot reproduce.

---

## Systematic checklist (when the 3 bugs above don't cover it)

If `/medik` Check #9 passes but the plugin still misbehaves, run this 6-step checklist in order. Stop at the first failing check and apply the fix. Ordered by empirical failure frequency.

### Check 1 — Canonical symlinks resolve as symlinks

Covered above as **Bug #1**. `ls -la agents commands skills` must show `lrwxrwxrwx`. If broken, jump to Fix A / Fix B / Fix C depending on where the clone lives.

### Check 2 — Node version ≥ 20

```bash
node --version                         # expect v20.x or higher
```

`install.sh` enforces it at install time but a post-install Node downgrade silently breaks hooks that import modern APIs. Fix: upgrade via nvm/fnm/volta, re-run `install.sh`.

### Check 3 — Plugin registered in user settings

```bash
cat ~/.claude/settings.json | grep -A1 enabledPlugins
cat ~/.claude/settings.json | grep -A3 extraKnownMarketplaces
```

Expected:

```json
"enabledPlugins": {
  "kadmon-harness@kadmon-harness": true
},
"extraKnownMarketplaces": {
  "kadmon-harness": {
    "path": "/absolute/path/to/Kadmon-Harness"
  }
}
```

Fix: re-run `install.sh /path/to/target` — idempotent, safe.

### Check 4 — Marketplace path is valid and readable

```bash
MARKET_PATH=$(cat ~/.claude/settings.json | jq -r '.extraKnownMarketplaces["kadmon-harness"].path')
ls -la "$MARKET_PATH/.claude-plugin/plugin.json"
```

The `path` points at the harness clone. If the clone moved or the path has unicode/spaces, the plugin loader can't find it. Fix: re-run `install.sh` from the current clone location so the path is re-written.

### Check 5 — Target has `.kadmon-version` marker

```bash
cat /path/to/target/.kadmon-version    # expect a semver string like 1.2.3
```

Missing marker means the install didn't complete against that target. Fix: `cd` into the harness clone and run `bash install.sh /path/to/target`.

### Check 6 — Target has `git remote origin` configured

```bash
cd /path/to/target
git remote get-url origin
```

`session-start.js` early-exits with a log line "Kadmon: no git remote — session tracking disabled" when there's no remote. **This is intentional** — without a remote the harness can't compute a stable `projectHash`. Fix (choose one):

- Add a remote if this is a real project: `git remote add origin git@github.com:user/repo.git`
- Accept the behavior: standalone/experimental repos without remote intentionally have no session tracking. The banner line is the signal everything else is fine.

### If all 6 checks pass and it still doesn't work

See the "How to report a new install issue" section above. Gather the 3 artifacts (`/medik` Check #9 output, `install-diagnostic.log`, `hook-errors.log`) and open an issue. Do not patch without fresh evidence — most "urgent" plugin bugs have been environment issues.

---

## References

- **ADR-024** — Install Health Telemetry — Passive Diagnostic Channel (`docs/decisions/ADR-024-install-health-telemetry.md`)
- **ADR-019** — Canonical Root Symlinks for Plugin Loader (`docs/decisions/ADR-019-canonical-root-symlinks-for-plugin-loader.md`)
- **ADR-010** — Harness Distribution Hybrid (`docs/decisions/ADR-010-harness-distribution-hybrid.md`)
- **`scripts/lib/install-health.ts`** — pure diagnostic module
- **`scripts/lib/install-remediation.ts`** — banner template with adaptive PowerShell vs git remediation
- **`.claude/commands/medik.md`** — `/medik` Check #9 row
- **`scripts/lib/install-apply.ts:194`** — marketplace path logic (referenced by Check #4)
- **`.claude/hooks/scripts/session-start.js`** — remote requirement (referenced by Check #6)
