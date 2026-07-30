#!/usr/bin/env bash
# Vaste screenshot van de echte Wannabe-kaart op /dev/wannabe.
set -euo pipefail

LABEL="${1:-wannabe-$(date +%Y%m%d-%H%M%S)}"
BASIS="${2:-http://localhost:5173}"
MODUS="${3:-desktop}"
URL="$BASIS"
case "$URL" in
  *"/dev/wannabe"*) ;;
  *) URL="$BASIS/dev/wannabe" ;;
esac

UIT="screenshots/wannabe"
mkdir -p "$UIT"
PROFIEL="$(mktemp -d)"
trap 'rm -rf "$PROFIEL"' EXIT

CHROMIUM="${CHROMIUM:-chromium}"
if [ "$MODUS" = "mobile" ]; then
  VENSTER="390,844"
else
  # De racketcrest steekt ~9% kaarthoogte uit; een gewone stage volstaat.
  VENSTER="700,1000"
fi
"$CHROMIUM" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --hide-scrollbars \
  --user-data-dir="$PROFIEL" \
  --window-size="$VENSTER" \
  --force-device-scale-factor=2 \
  --virtual-time-budget=8000 \
  --screenshot="$UIT/$LABEL.png" \
  "$URL" 2>/dev/null

echo "$UIT/$LABEL.png"
