#!/bin/bash
# Kadmon Harness — status line (optional onboarding component, user-scope)
#
# 3-line terminal status for Claude Code sessions:
#   Line 1: model (emoji + tier color) | context bar % | +lines/-lines | session duration
#   Line 2: [CAVEMAN] badge (if active) | 5h/7d rate-limit % (traffic-light colors)
#   Line 3: git branch (color by prefix; main=red nudge) | dirty flag | ahead/behind | last commit
#
# Install (2 steps, any OS — Claude Code runs this via bash, incl. Windows Git Bash):
#
#   1. Copy this file to ~/.claude/statusline.sh
#      (macOS/Linux: chmod +x ~/.claude/statusline.sh)
#
#   2. Add to ~/.claude/settings.json (top-level key):
#        "statusLine": {
#          "type": "command",
#          "command": "~/.claude/statusline.sh"
#        }
#
# Restart the Claude Code session; the status line renders at the bottom.
#
# Notes:
# - Self-contained: parses stdin JSON with grep/sed — no jq dependency.
# - Degrades silently: git section only renders inside a repo; the CAVEMAN badge
#   only renders when ~/.claude/.caveman-active exists (written by the caveman
#   skill hooks) — safe to install without the caveman skill.
# - Always exits 0 so a non-git cwd never blanks the status line.
input=$(cat)

# Parse JSON without jq using grep/sed
get_val() {
  echo "$input" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*[^,}]*" | head -1 | sed 's/.*:[[:space:]]*//' | tr -d '"[:space:]'
}

# Extract quoted string preserving internal spaces
get_str() {
  echo "$input" | grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*:[[:space:]]*"//' | sed 's/"$//'
}

# --- Colors ---
RESET='\033[0m'
GREEN='\033[32m'
RED='\033[31m'
DIM=$'\033[2m'

# Threshold colors: green <low, yellow mid, red >high
color_pct() {
  local pct=$1
  if [ "$pct" -gt 80 ]; then printf '\033[31m'
  elif [ "$pct" -gt 50 ]; then printf '\033[33m'
  else printf '\033[32m'; fi
}

rl_color() {
  local pct=$1
  if [ "$pct" -gt 80 ]; then printf '\033[31m'
  elif [ "$pct" -gt 50 ]; then printf '\033[38;5;208m'
  else printf '\033[33m'; fi
}

dur_color() {
  local ms=$1
  if [ "$ms" -gt 25200000 ]; then printf '\033[31m'
  elif [ "$ms" -gt 14400000 ]; then printf '\033[33m'
  else printf '\033[32m'; fi
}

# --- Utilities ---
humanize() {
  local n=$1
  n=${n:-0}
  if [ "$n" -ge 1000000 ]; then
    local w=$((n / 1000000))
    local f=$(( (n % 1000000) / 100000 ))
    [ "$f" -gt 0 ] && echo "${w}.${f}m" || echo "${w}m"
  elif [ "$n" -ge 1000 ]; then
    local w=$((n / 1000))
    local f=$(( (n % 1000) / 100 ))
    [ "$f" -gt 0 ] && echo "${w}.${f}k" || echo "${w}k"
  else
    echo "$n"
  fi
}

format_dur() {
  local ms=$1
  ms=${ms:-0}
  local s=$((ms / 1000))
  if [ "$s" -lt 60 ]; then
    echo "${s}s"
  else
    local h=$((s / 3600))
    local m=$(( (s % 3600) / 60 ))
    [ "$h" -gt 0 ] && echo "${h}h${m}m" || echo "${m}m"
  fi
}

# --- Extract values ---
MODEL=$(get_str "display_name")
MODEL="${MODEL%% (*}"
[ -z "$MODEL" ] && MODEL="unknown"

PCT=$(get_val "used_percentage")
PCT=${PCT%%.*}
[ -z "$PCT" ] && PCT=0

IN_TOK=$(get_val "total_input_tokens"); [ -z "$IN_TOK" ] && IN_TOK=0
OUT_TOK=$(get_val "total_output_tokens"); [ -z "$OUT_TOK" ] && OUT_TOK=0
COST=$(get_val "total_cost_usd"); [ -z "$COST" ] && COST=0
printf -v COST_FMT "%.2f" "$COST"

DURATION=$(get_val "total_duration_ms"); [ -z "$DURATION" ] && DURATION=0
LINES_ADD=$(get_val "total_lines_added"); [ -z "$LINES_ADD" ] && LINES_ADD=0
LINES_REM=$(get_val "total_lines_removed"); [ -z "$LINES_REM" ] && LINES_REM=0

# Rate limits (extracts used_percentage from nested object)
RL5=$(get_val "five_hour"); RL5=${RL5%%.*}
RL7=$(get_val "seven_day"); RL7=${RL7%%.*}

# --- Context bar ---
BAR_WIDTH=10
FILLED=$((PCT * BAR_WIDTH / 100))
EMPTY=$((BAR_WIDTH - FILLED))
BAR=""
[ "$FILLED" -gt 0 ] && printf -v FILL "%${FILLED}s" && BAR="${FILL// /▓}"
[ "$EMPTY" -gt 0 ] && printf -v PAD "%${EMPTY}s" && BAR="${BAR}${PAD// /░}"

# --- Compute colors ---
CTX_C=$(color_pct "$PCT")
DUR_C=$(dur_color "$DURATION")

# Rate limit display
if [ -n "$RL5" ] && [ "$RL5" != "null" ]; then
  RL5_D="$(rl_color "$RL5")5h:${RL5}%${RESET}"
else
  RL5_D="5h:--"
fi
if [ -n "$RL7" ] && [ "$RL7" != "null" ]; then
  RL7_D="$(rl_color "$RL7")7d:${RL7}%${RESET}"
else
  RL7_D="7d:--"
fi

# --- Git info (Tier 1 + Tier 2) ---
# Only runs if inside a git repo; fails silently otherwise.
# Budget: ~3-10ms total. Each command is local (no network).
CYAN='\033[36m'
YELLOW='\033[33m'
BRIGHT_RED='\033[91m'

GIT_LINE=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH=$(git branch --show-current 2>/dev/null)
  [ -z "$BRANCH" ] && BRANCH="(detached)"

  # Branch color by prefix — default (main/master) red as a nudge away from direct edits.
  case "$BRANCH" in
    main|master) BRANCH_C="$RED" ;;
    feat/*)      BRANCH_C="$CYAN" ;;
    fix/*)       BRANCH_C="$YELLOW" ;;
    rename/*|refactor/*|chore/*|docs/*) BRANCH_C="$DIM" ;;
    *)           BRANCH_C="$RESET" ;;
  esac

  # Dirty indicator — one * if anything staged/unstaged, ✓ if clean.
  if [ -n "$(git status --porcelain 2>/dev/null | head -1)" ]; then
    DIRTY="${BRIGHT_RED}*${RESET}"
  else
    DIRTY="${GREEN}✓${RESET}"
  fi

  # Ahead/behind origin — only if upstream exists.
  AHEAD_BEHIND=""
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    AB=$(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null)
    BEHIND=$(echo "$AB" | awk '{print $1}')
    AHEAD=$(echo "$AB" | awk '{print $2}')
    [ -z "$BEHIND" ] && BEHIND=0
    [ -z "$AHEAD" ] && AHEAD=0
    AHEAD_C="$DIM"; BEHIND_C="$DIM"
    [ "$AHEAD" -gt 0 ] && AHEAD_C="$GREEN"
    [ "$BEHIND" -gt 0 ] && BEHIND_C="$YELLOW"
    AHEAD_BEHIND=$(printf "%b↑%s%b %b↓%s%b" \
      "$AHEAD_C" "$AHEAD" "$RESET" "$BEHIND_C" "$BEHIND" "$RESET")
  else
    AHEAD_BEHIND="${DIM}no upstream${RESET}"
  fi

  # Last commit — short sha + first ~40 chars of subject.
  LAST_COMMIT=$(git log -1 --format='%h %s' 2>/dev/null | cut -c1-50)

  GIT_LINE=$(printf "%b⎇ %s%b %b | %s | %s%s%b" \
    "$BRANCH_C" "$BRANCH" "$RESET" \
    "$DIRTY" \
    "$AHEAD_BEHIND" \
    "$DIM" "$LAST_COMMIT" "$RESET")
fi

# --- Caveman badge ---
# Reads ~/.claude/.caveman-active flag written by caveman plugin hooks.
# Color by mode: lite=yellow, full=orange, ultra=red, wenyan-*=magenta, commit/review=cyan.
CAVEMAN_TEXT=""
CAVEMAN_FLAG="$HOME/.claude/.caveman-active"
if [ -f "$CAVEMAN_FLAG" ]; then
  CAVEMAN_MODE=$(cat "$CAVEMAN_FLAG" 2>/dev/null)
  [ -z "$CAVEMAN_MODE" ] && CAVEMAN_MODE="full"

  case "$CAVEMAN_MODE" in
    lite)          CAVEMAN_C='\033[38;5;117m' ;;
    full)          CAVEMAN_C='\033[38;5;39m' ;;
    ultra)         CAVEMAN_C='\033[38;5;27m' ;;
    wenyan*)       CAVEMAN_C='\033[38;5;44m' ;;
    commit|review) CAVEMAN_C='\033[38;5;229m' ;;
    *)             CAVEMAN_C='\033[38;5;39m' ;;
  esac

  if [ "$CAVEMAN_MODE" = "full" ]; then
    CAVEMAN_TEXT=$(printf "%b[CAVEMAN]%b" "$CAVEMAN_C" "$RESET")
  else
    CAVEMAN_SUFFIX=$(echo "$CAVEMAN_MODE" | tr '[:lower:]' '[:upper:]')
    CAVEMAN_TEXT=$(printf "%b[CAVEMAN:%s]%b" "$CAVEMAN_C" "$CAVEMAN_SUFFIX" "$RESET")
  fi
fi

# Model color + emoji by tier: Opus=bright magenta 🦉, Sonnet=green ⚡, Haiku=cyan 🌸, Fable=violet 🐉
# Fable uses violet (141) not amber — amber clashed with the yellow rate-limit gradient (semantic traffic light).
case "$MODEL" in
  *[Oo]pus*)   MODEL_C='\033[95m';        MODEL_EMOJI='🦉' ;;
  *[Ss]onnet*) MODEL_C='\033[32m';        MODEL_EMOJI='⚡' ;;
  *[Hh]aiku*)  MODEL_C='\033[36m';        MODEL_EMOJI='🌸' ;;
  *[Ff]able*)  MODEL_C='\033[38;5;141m';  MODEL_EMOJI='🐉' ;;
  *)           MODEL_C='';                MODEL_EMOJI='' ;;
esac

# Caveman prefix for line 2 (empty when flag absent, badge+space when active)
CAVEMAN_PREFIX=""
[ -n "$CAVEMAN_TEXT" ] && CAVEMAN_PREFIX="${CAVEMAN_TEXT} "

# --- Output ---
# Line 1: Session monitor (model emoji + name color-coded by tier)
printf "[%s %b%s%b] %b%s %s%%%b | %b+%s%b %b-%s%b | %b%s%b\n" \
  "$MODEL_EMOJI" "$MODEL_C" "$MODEL" "$RESET" \
  "$CTX_C" "$BAR" "$PCT" "$RESET" \
  "$GREEN" "$LINES_ADD" "$RESET" "$RED" "$LINES_REM" "$RESET" \
  "$DUR_C" "$(format_dur "$DURATION")" "$RESET"

# Line 2: Caveman badge (if active) + rate limits
printf "%b%b %b\n" \
  "$CAVEMAN_PREFIX" \
  "$RL5_D" "$RL7_D"

# Line 3: Git info only (caveman badge now lives at line 2 start)
[ -n "$GIT_LINE" ] && printf "%b\n" "$GIT_LINE"

# Always exit 0 — in a non-git cwd this last test returns 1, which makes
# Claude Code discard the whole status line. Force success regardless.
exit 0
