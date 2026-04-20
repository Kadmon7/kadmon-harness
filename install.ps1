# Kadmon Harness bootstrap (PowerShell) — plan-010 Phase 5.2 (narrowed by plan-019).
#
# PowerShell paridad of install.sh. Delegates settings merge to scripts/lib/install-apply.ts
# via `npx tsx` so merge logic stays DRY across bash and PowerShell entry points.
#
# Usage:
#   .\install.ps1 -TargetPath "C:\path\to\project"
#   .\install.ps1 -TargetPath "C:\path\to\project" -DryRun
#   .\install.ps1 -TargetPath "C:\path\to\project" -ForcePermissionsSync
#
# Env vars:
#   KADMON_USER_SETTINGS_PATH — override user-scope settings.json (for tests).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$TargetPath,

    [switch]$DryRun,

    [switch]$ForcePermissionsSync
)

$ErrorActionPreference = "Stop"

# ─── Resolve harness repo root from script location ──────────────────────────

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = $ScriptDir

function Write-Log {
    param([string]$Message)
    Write-Host "install.ps1: $Message"
}

function Invoke-OrDry {
    param(
        [string]$Description,
        [scriptblock]$Action
    )
    if ($DryRun) {
        Write-Host "[DRY RUN] $Description"
    } else {
        & $Action
    }
}

# ─── Step 2: Validate target ─────────────────────────────────────────────────

if (-not (Test-Path -Path $TargetPath -PathType Container)) {
    Write-Error "install.ps1: target '$TargetPath' does not exist or is not a directory"
    exit 1
}

$TargetAbs = (Resolve-Path $TargetPath).Path
$RepoAbs = (Resolve-Path $RepoRoot).Path
if ($TargetAbs -eq $RepoAbs) {
    Write-Error "install.ps1: target cannot be the harness repo itself"
    exit 1
}

# ─── Step 3: Detect OS (Windows is assumed for PowerShell) ───────────────────

$Platform = "windows"
if ($IsMacOS) { $Platform = "darwin" }
elseif ($IsLinux) { $Platform = "linux" }
Write-Log "detected platform: $Platform"

# ─── Step 4: Verify canonical symlinks (ADR-019 gate) ────────────────────────

foreach ($link in @("agents", "skills", "commands")) {
    $linkPath = Join-Path $RepoRoot $link
    $item = Get-Item -Path $linkPath -ErrorAction SilentlyContinue
    if ($null -eq $item -or ($item.LinkType -ne "SymbolicLink" -and $item.LinkType -ne "Junction")) {
        Write-Error @"
install.ps1: canonical symlink '$linkPath' missing or not a symlink.
  On Windows: enable Developer Mode (Settings > Privacy & Security > For Developers)
  and run: git config --global core.symlinks true
  then re-clone the harness repo with MSYS=winsymlinks:nativestrict.
"@
        exit 1
    }
}

# ─── Step 5: Node >= 20 check ────────────────────────────────────────────────

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Write-Error "install.ps1: 'node' not found in PATH. Install Node >= 20."
    exit 1
}

$nodeVersionOutput = & node --version
$nodeMajorStr = ($nodeVersionOutput -replace '^v', '').Split('.')[0]
$nodeMajor = [int]$nodeMajorStr
if ($nodeMajor -lt 20) {
    Write-Error "install.ps1: Node >= 20 required (found $nodeVersionOutput)"
    exit 1
}
Write-Log "node version OK: $nodeVersionOutput"

# ─── Step 6: Copy rules ──────────────────────────────────────────────────────

$RulesSrc = Join-Path $RepoRoot ".claude\rules"
$RulesDst = Join-Path $TargetPath ".claude\rules"

if (-not (Test-Path -Path $RulesSrc -PathType Container)) {
    Write-Error "install.ps1: source rules dir '$RulesSrc' missing"
    exit 2
}

if ($DryRun) {
    Write-Host "[DRY RUN] would copy $RulesSrc -> $RulesDst"
} else {
    $claudeDir = Join-Path $TargetPath ".claude"
    if (-not (Test-Path -Path $claudeDir)) {
        New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    }
    Copy-Item -Path $RulesSrc -Destination $claudeDir -Recurse -Force
    Write-Log "copied rules to $RulesDst"
}

# ─── Step 7: Call install-apply.ts via npx tsx ───────────────────────────────

$InstallApply = Join-Path $RepoRoot "scripts\lib\install-apply.ts"
if (-not (Test-Path -Path $InstallApply -PathType Leaf)) {
    Write-Error "install.ps1: missing $InstallApply"
    exit 3
}

$applyArgs = @("--target", $TargetPath)
if ($ForcePermissionsSync) {
    $applyArgs += "--force-permissions-sync"
}
# User-settings override via env var (tests use this to avoid touching real ~/.claude)
if ($env:KADMON_USER_SETTINGS_PATH) {
    $applyArgs += @("--user-settings", $env:KADMON_USER_SETTINGS_PATH)
}

if ($DryRun) {
    Write-Host "[DRY RUN] would invoke: npx tsx $InstallApply $($applyArgs -join ' ')"
} else {
    Push-Location $RepoRoot
    try {
        & npx tsx $InstallApply @applyArgs
        if ($LASTEXITCODE -ne 0) {
            throw "install-apply.ts exited with code $LASTEXITCODE"
        }
        Write-Log "settings applied via install-apply.ts"
    } finally {
        Pop-Location
    }
}

# ─── Step 8: settings.local.json template ────────────────────────────────────

$SettingsLocal = Join-Path $TargetPath ".claude\settings.local.json"
if (-not (Test-Path -Path $SettingsLocal)) {
    if ($DryRun) {
        Write-Host "[DRY RUN] would create $SettingsLocal (empty {} template)"
    } else {
        $claudeDir = Join-Path $TargetPath ".claude"
        if (-not (Test-Path -Path $claudeDir)) {
            New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
        }
        Set-Content -Path $SettingsLocal -Value "{}" -NoNewline
        Write-Log "created template: $SettingsLocal"
    }
} else {
    Write-Log "preserved existing $SettingsLocal (never overwritten)"
}

# ─── Step 9: Append to .gitignore (dedup) ────────────────────────────────────

$Gitignore = Join-Path $TargetPath ".gitignore"
$GitignoreEntries = @(
    ".claude/settings.local.json",
    ".claude/agent-memory/",
    "dist/"
)

if ($DryRun) {
    foreach ($entry in $GitignoreEntries) {
        Write-Host "[DRY RUN] would ensure '$entry' in $Gitignore"
    }
} else {
    if (-not (Test-Path -Path $Gitignore)) {
        New-Item -ItemType File -Path $Gitignore -Force | Out-Null
    }
    $existingContent = Get-Content -Path $Gitignore -ErrorAction SilentlyContinue
    if ($null -eq $existingContent) { $existingContent = @() }
    foreach ($entry in $GitignoreEntries) {
        if ($existingContent -notcontains $entry) {
            Add-Content -Path $Gitignore -Value $entry
            Write-Log "added to .gitignore: $entry"
        }
    }
}

# ─── Step 10: Write .kadmon-version ──────────────────────────────────────────

$PluginJson = Join-Path $RepoRoot ".claude-plugin\plugin.json"
$VersionFile = Join-Path $TargetPath ".kadmon-version"

$pluginRaw = Get-Content -Path $PluginJson -Raw
$pluginObj = $pluginRaw | ConvertFrom-Json
$Version = $pluginObj.version

if ([string]::IsNullOrEmpty($Version)) {
    Write-Error "install.ps1: failed to extract version from $PluginJson"
    exit 3
}

if ($DryRun) {
    Write-Host "[DRY RUN] would write $VersionFile with version '$Version'"
} else {
    Set-Content -Path $VersionFile -Value $Version -NoNewline
    Write-Log "wrote $VersionFile ($Version)"
}

# ─── Step 11: Post-install checklist ─────────────────────────────────────────

if ($DryRun) {
    Write-Host ""
    Write-Host "[DRY RUN] no filesystem changes were made."
    Write-Host "[DRY RUN] to perform the install, re-run without -DryRun."
    exit 0
}

Write-Host @"

---------------------------------------------------------------
Kadmon Harness $Version installed to: $TargetPath

Next steps:
  1. Open a Claude Code session in the target:
     cd "$TargetPath"; claude
  2. The plugin auto-registers via user-scope settings. Confirm with:
     /plugin - should list kadmon-harness as enabled
  3. Create your personal settings.local.json overrides (optional):
     $SettingsLocal
  4. First code change will trigger hooks: /chekpoint runs the gate suite.

Docs: README.md (INSTALL section) - ADR-010 (distribution model) - ADR-019 (symlinks)
---------------------------------------------------------------
"@
