#!/usr/bin/env bash
# Kadmon Harness bootstrap — plan-010 Phase 4.2 (narrowed by plan-019).
#
# Distributes rules + permissions.deny + .kadmon-version + .gitignore into the
# target project, and registers the plugin in the user's ~/.claude/settings.json.
# Does NOT copy agents/skills/commands — those ship via the plugin's canonical
# root symlinks (ADR-019 Ruta Y).
#
# Usage:
#   install.sh [--dry-run] [--force-permissions-sync] <target-path>
#
# Env vars:
#   KADMON_USER_SETTINGS_PATH — override ~/.claude/settings.json (for tests).

set -euo pipefail

# ─── Resolve harness repo root from script location ──────────────────────────

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$SCRIPT_DIR"

# ─── Parse args ──────────────────────────────────────────────────────────────

DRY_RUN=false
FORCE_PERMISSIONS_SYNC=false
TARGET=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force-permissions-sync)
      FORCE_PERMISSIONS_SYNC=true
      shift
      ;;
    -h|--help)
      cat <<EOF
Kadmon Harness install.sh

Usage:
  install.sh [--dry-run] [--force-permissions-sync] <target-path>

Options:
  --dry-run                   Print planned operations without touching the filesystem.
  --force-permissions-sync    Re-merge permissions.deny even if already present.
  -h, --help                  Show this help.

Env vars:
  KADMON_USER_SETTINGS_PATH   Override path for user-scope settings.json (tests).

Requirements:
  - Node >= 20 (node --version)
  - bash (Git Bash on Windows, or native Mac/Linux)
  - Canonical root symlinks in harness repo (agents, skills, commands).
    On Windows, requires Developer Mode ON + git config --global core.symlinks true.
EOF
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "install.sh: unknown option '$1'" >&2
      exit 1
      ;;
    *)
      if [[ -n "$TARGET" ]]; then
        echo "install.sh: multiple target paths provided — only one allowed" >&2
        exit 1
      fi
      TARGET="$1"
      shift
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "install.sh: target path required. Use -h for help." >&2
  exit 1
fi

log() {
  echo "install.sh: $*"
}

# ─── Step 2: Validate target ─────────────────────────────────────────────────

if [[ ! -d "$TARGET" ]]; then
  echo "install.sh: target '$TARGET' does not exist or is not a directory" >&2
  exit 1
fi

if [[ ! -w "$TARGET" ]]; then
  echo "install.sh: target '$TARGET' is not writable" >&2
  exit 1
fi

# Reject targeting the harness repo itself. Prefer realpath, fall back to
# readlink -f, then to pure-bash cd+pwd so minimal Git Bash installs are covered
# (spektr 2026-04-20 LOW — silent bypass if realpath absent).
if command -v realpath >/dev/null 2>&1; then
  TARGET_ABS="$(realpath "$TARGET")"
  REPO_ABS="$(realpath "$REPO_ROOT")"
elif command -v readlink >/dev/null 2>&1 && readlink -f / >/dev/null 2>&1; then
  TARGET_ABS="$(readlink -f "$TARGET")"
  REPO_ABS="$(readlink -f "$REPO_ROOT")"
else
  TARGET_ABS="$(cd "$TARGET" && pwd)"
  REPO_ABS="$(cd "$REPO_ROOT" && pwd)"
fi
if [[ "$TARGET_ABS" == "$REPO_ABS" ]]; then
  echo "install.sh: target cannot be the harness repo itself" >&2
  exit 1
fi

# ─── Step 3: Detect OS ───────────────────────────────────────────────────────

OS_TYPE="$(uname -s)"
case "$OS_TYPE" in
  Linux*)        PLATFORM="linux" ;;
  Darwin*)       PLATFORM="darwin" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="gitbash" ;;
  *)
    echo "install.sh: unsupported OS '$OS_TYPE'" >&2
    exit 1
    ;;
esac
log "detected platform: $PLATFORM"

# ─── Step 4: Verify canonical symlinks (ADR-019 gate) ────────────────────────

for link in agents skills commands; do
  if [[ ! -L "$REPO_ROOT/$link" ]]; then
    echo "install.sh: canonical symlink '$REPO_ROOT/$link' missing or not a symlink." >&2
    echo "  On Windows: enable Developer Mode (Settings > Privacy & Security > For Developers)" >&2
    echo "  and run: git config --global core.symlinks true" >&2
    echo "  then re-clone the harness repo with MSYS=winsymlinks:nativestrict." >&2
    exit 1
  fi
done

# ─── Step 5: Node >= 20 check ────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "install.sh: 'node' not found in PATH. Install Node >= 20." >&2
  exit 1
fi

NODE_VERSION="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [[ "$NODE_VERSION" -lt 20 ]]; then
  echo "install.sh: Node >= 20 required (found v$(node --version))" >&2
  exit 1
fi
log "node version OK: $(node --version)"

# ─── Step 6: Copy rules ──────────────────────────────────────────────────────

RULES_SRC="$REPO_ROOT/.claude/rules"
RULES_DST="$TARGET/.claude/rules"

if [[ ! -d "$RULES_SRC" ]]; then
  echo "install.sh: source rules dir '$RULES_SRC' missing" >&2
  exit 2
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] would copy $RULES_SRC/ -> $RULES_DST/"
else
  mkdir -p "$TARGET/.claude"
  # cp -r is portable (rsync may not exist in minimal Git Bash installs)
  cp -r "$RULES_SRC" "$TARGET/.claude/"
  log "copied rules to $RULES_DST"
fi

# ─── Step 7: Call install-apply.ts via npx tsx ───────────────────────────────

INSTALL_APPLY="$REPO_ROOT/scripts/lib/install-apply.ts"
if [[ ! -f "$INSTALL_APPLY" ]]; then
  echo "install.sh: missing $INSTALL_APPLY" >&2
  exit 3
fi

APPLY_ARGS=(--target "$TARGET")
if [[ "$FORCE_PERMISSIONS_SYNC" == "true" ]]; then
  APPLY_ARGS+=(--force-permissions-sync)
fi
# User-settings override via env var (tests use this to avoid touching real ~/.claude)
if [[ -n "${KADMON_USER_SETTINGS_PATH:-}" ]]; then
  APPLY_ARGS+=(--user-settings "$KADMON_USER_SETTINGS_PATH")
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] would invoke: npx tsx $INSTALL_APPLY ${APPLY_ARGS[*]}"
else
  # Run from REPO_ROOT so npx tsx can resolve dependencies relative to harness repo
  ( cd "$REPO_ROOT" && npx tsx "$INSTALL_APPLY" "${APPLY_ARGS[@]}" )
  log "settings applied via install-apply.ts"
fi

# ─── Step 8: settings.local.json template ────────────────────────────────────

SETTINGS_LOCAL="$TARGET/.claude/settings.local.json"
if [[ ! -f "$SETTINGS_LOCAL" ]]; then
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] would create $SETTINGS_LOCAL (empty {} template)"
  else
    mkdir -p "$TARGET/.claude"
    echo '{}' > "$SETTINGS_LOCAL"
    log "created template: $SETTINGS_LOCAL"
  fi
else
  log "preserved existing $SETTINGS_LOCAL (never overwritten)"
fi

# ─── Step 9: Append to .gitignore (dedup) ────────────────────────────────────

GITIGNORE="$TARGET/.gitignore"
GITIGNORE_ENTRIES=(
  ".claude/settings.local.json"
  ".claude/agent-memory/"
  "dist/"
)

if [[ "$DRY_RUN" == "true" ]]; then
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    echo "[DRY RUN] would ensure '$entry' in $GITIGNORE"
  done
else
  # Ensure file exists for grep check
  touch "$GITIGNORE"
  for entry in "${GITIGNORE_ENTRIES[@]}"; do
    # -F fixed-string, -x whole-line match to avoid substring collision
    if ! grep -Fxq "$entry" "$GITIGNORE"; then
      echo "$entry" >> "$GITIGNORE"
      log "added to .gitignore: $entry"
    fi
  done
fi

# ─── Step 10: Write .kadmon-version ──────────────────────────────────────────

PLUGIN_JSON="$REPO_ROOT/.claude-plugin/plugin.json"
VERSION_FILE="$TARGET/.kadmon-version"

# Extract version from plugin.json. Prefer jq, fallback to sed.
if command -v jq >/dev/null 2>&1; then
  VERSION="$(jq -r .version "$PLUGIN_JSON")"
else
  VERSION="$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PLUGIN_JSON" | head -1 | sed 's/.*"\([^"]*\)"[^"]*$/\1/')"
fi

if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
  echo "install.sh: failed to extract version from $PLUGIN_JSON" >&2
  exit 3
fi

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] would write $VERSION_FILE with version '$VERSION'"
else
  echo "$VERSION" > "$VERSION_FILE"
  log "wrote $VERSION_FILE ($VERSION)"
fi

# ─── Step 11: Post-install checklist ─────────────────────────────────────────

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "[DRY RUN] no filesystem changes were made."
  echo "[DRY RUN] to perform the install, re-run without --dry-run."
  exit 0
fi

cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kadmon Harness $VERSION installed to: $TARGET

Next steps:
  1. Open a Claude Code session in the target:
     cd "$TARGET" && claude
  2. The plugin auto-registers via user-scope settings. Confirm with:
     /plugin — should list kadmon-harness as enabled
  3. Create your personal settings.local.json overrides (optional):
     $SETTINGS_LOCAL
  4. First code change will trigger hooks: /chekpoint runs the gate suite.

Docs: README.md (INSTALL section) · ADR-010 (distribution model) · ADR-019 (symlinks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
