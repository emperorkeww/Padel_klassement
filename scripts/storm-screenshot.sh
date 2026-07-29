#!/usr/bin/env bash
# Screenshot van de In-Form storm-stage (#834).
#
# Gebruik:  scripts/storm-screenshot.sh [label] [basis-url]
#   label      bestandsnaam zonder extensie (default: iteratie + timestamp)
#   basis-url  dev-server (default: http://localhost:5173)
#
# Opent /dev/storm op een vast viewport met headless Chromium en bewaart de
# screenshot in screenshots/storm/. Draai dit na elke significante wijziging
# aan het stormeffect; voeg ?debugStorm=1 aan de URL toe voor de debugweergave:
#   scripts/storm-screenshot.sh debug "http://localhost:5173/dev/storm?debugStorm=1"
set -euo pipefail

LABEL="${1:-storm-$(date +%Y%m%d-%H%M%S)}"
BASIS="${2:-http://localhost:5173}"
URL="$BASIS"
case "$URL" in
  *"/dev/storm"*) ;;
  *) URL="$BASIS/dev/storm" ;;
esac

UIT="screenshots/storm"
mkdir -p "$UIT"
PROFIEL="$(mktemp -d)"
trap 'rm -rf "$PROFIEL"' EXIT

CHROMIUM="${CHROMIUM:-chromium}"
"$CHROMIUM" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --hide-scrollbars \
  --user-data-dir="$PROFIEL" \
  --window-size=700,900 \
  --force-device-scale-factor=2 \
  --virtual-time-budget=8000 \
  --screenshot="$UIT/$LABEL.png" \
  "$URL" 2>/dev/null

echo "$UIT/$LABEL.png"
