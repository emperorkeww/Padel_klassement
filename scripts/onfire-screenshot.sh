#!/usr/bin/env bash
# Vaste screenshot van de echte On Fire-kaart op /dev/onfire.
set -euo pipefail

LABEL="${1:-onfire-$(date +%Y%m%d-%H%M%S)}"
BASIS="${2:-http://localhost:5173}"
MODUS="${3:-desktop}"
URL="$BASIS"
case "$URL" in
  *"/dev/onfire"*) ;;
  *) URL="$BASIS/dev/onfire" ;;
esac

UIT="screenshots/onfire"
mkdir -p "$UIT"
PROFIEL="$(mktemp -d)"
trap 'rm -rf "$PROFIEL"' EXIT

CHROMIUM="${CHROMIUM:-chromium}"
if [ "$MODUS" = "mobile" ]; then
  VENSTER="390,844"
else
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
