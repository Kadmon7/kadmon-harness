# Plugin Troubleshooting Runbook

**When to use**: a collaborator installed Kadmon Harness as a plugin (via `install.sh` / `install.ps1`) and reports "nothing works", "hooks don't fire", "banner doesn't appear", or similar vague failure. Run this checklist in order — stop at the first failing check and apply the fix.

Most failures are not bugs in the harness; they are environment setup issues. This runbook prioritizes checks by empirical failure frequency (symlinks first — most common).

## Quick Context

The Kadmon Harness plugin is **file-based**: it lives in the user's local clone of the `kadmon-harness` repo. `install.sh` registers that clone as a marketplace in `~/.claude/settings.json` and Claude Code loads agents / commands / skills / hooks from there. There is no npm package, no CDN, no central cache — each user's plugin is literally their git clone.

Failures therefore split into three buckets:
1. **The clone itself is broken** (symlinks not materialized, wrong Node version) — checks 1–2
2. **Plugin registration failed or drifted** (user settings missing entries, stale marketplace path) — checks 3–4
3. **The target repo fires hooks but they no-op** (missing remote, missing `.kadmon-version`) — checks 5–6

## Checklist (in order of likelihood)

### 1. Canonical symlinks resolved as symlinks, not as text files

**Why this matters most**: ADR-019 uses `./agents`, `./commands`, `./skills` symlinks at the root of the harness clone — the Claude Code plugin loader requires them. If git checked them out as plain text files containing the path (common on Windows without Developer Mode, also possible on Linux clones where `core.symlinks` was off at clone time), the plugin loader rejects the plugin silently — **zero agents / commands / skills / hooks load**.

**Check**:
```bash
cd /path/to/their/Kadmon-Harness
ls -la agents commands skills
```

Expected output:
```
lrwxrwxrwx ... agents -> .claude/agents
lrwxrwxrwx ... commands -> .claude/commands
lrwxrwxrwx ... skills -> .claude/skills
```

If instead they show `-rw-r--r--` with size 14–16 bytes, symlinks are broken.

**Fix**:
```bash
git config --global core.symlinks true
rm -f agents commands skills
git checkout HEAD -- agents commands skills
ls -la agents commands skills   # verify lrwxrwxrwx
```

On Windows additionally required: Developer Mode ON (Settings → For developers) **before** the clone, or re-clone.

### 2. Node version ≥ 20

**Why**: `install.sh` enforces it at install time, but if they bypassed the check or updated Node after, hooks importing modern APIs can fail silently.

**Check**:
```bash
node --version
```

Expected: `v20.x.x` or higher.

**Fix**: upgrade via their Node version manager (nvm, fnm, volta, etc.), then re-run `install.sh`.

### 3. Plugin registered in user settings

**Why**: `install-apply.ts` writes `enabledPlugins` + `extraKnownMarketplaces` into `~/.claude/settings.json`. If the install failed halfway or they manually edited the file, Claude Code won't know the plugin exists.

**Check**:
```bash
cat ~/.claude/settings.json | grep -A1 enabledPlugins
cat ~/.claude/settings.json | grep -A3 extraKnownMarketplaces
```

Expected:
```json
"enabledPlugins": {
  "kadmon-harness@kadmon-harness": true
}
"extraKnownMarketplaces": {
  "kadmon-harness": {
    "path": "/absolute/path/to/their/Kadmon-Harness"
  }
}
```

**Fix**: re-run `install.sh /path/to/target`. It's idempotent — won't damage an existing install.

### 4. Marketplace path is valid and readable

**Why**: the `path` above points at their harness clone. If they moved or deleted the clone after install, or the path has unicode / spaces that some shells mangle, the plugin loader can't find it.

**Check**:
```bash
MARKET_PATH=$(cat ~/.claude/settings.json | jq -r '.extraKnownMarketplaces["kadmon-harness"].path')
ls -la "$MARKET_PATH/.claude-plugin/plugin.json"
```

Expected: file exists.

**Fix**: re-run `install.sh` from inside the current clone location so the path is re-written. If the path has spaces, ensure `install.sh` was run with the path double-quoted.

### 5. Target has `.kadmon-version` marker

**Why**: this is the install sentinel. If missing, the install didn't complete against that target.

**Check**:
```bash
cat /path/to/target/.kadmon-version
```

Expected: a version string like `1.1.0`.

**Fix**:
```bash
cd /path/to/their/Kadmon-Harness
bash install.sh /path/to/target
```

### 6. Target has `git remote origin` configured

**Why**: `session-start.js:27-32` early-exits when `git remote get-url origin` returns null. Without a remote there's no stable `projectHash`, so the session cannot be tracked. This is **intentional**, not a bug — but if the collaborator created the target with `git init` and never added a remote, they'll see the log line "Kadmon: no git remote — session tracking disabled".

**Check**:
```bash
cd /path/to/target
git remote get-url origin
```

**Fix** (choose one):
- Add a remote if this is a real project: `git remote add origin git@github.com:user/repo.git`
- Accept the behavior: standalone / experimental repos without remote intentionally have no session tracking. The log line is now visible as a banner — that's the signal everything else is fine, it just won't persist sessions.

## If all 6 checks pass and it still doesn't work

Ask for:
1. Output of `ls -la /path/to/their/Kadmon-Harness` (to rule out permission issues)
2. Output of `cat ~/.kadmon/hook-errors.log | tail -20` (if any hook crashed, it logs here)
3. A copy of `~/.claude/settings.json` with secrets redacted (to inspect plugin registration)
4. A screenshot of `/plugin` output in their Claude Code session (to confirm plugin shows as enabled)

File the issue in Kadmon-Harness repo with the above evidence. Do **not** patch without fresh evidence — the last three "urgent" plugin bugs were all environment issues (see `project_plan_010_dogfood_findings.md` in private memory: Bug #3 was initially diagnosed as "Sprint E env-block support" and turned out to be a missing remote).

## References

- ADR-010: hybrid distribution model
- ADR-019: canonical root symlinks
- `scripts/lib/install-apply.ts:194` — marketplace path logic
- `.claude/hooks/scripts/session-start.js:27-32` — remote requirement
- README.md INSTALL section — user-facing install docs
