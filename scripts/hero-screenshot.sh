#!/usr/bin/env bash
# Vaste screenshot van de dashboard player card op /dev/hero.
#
# Gebruik: scripts/hero-screenshot.sh <label> [basis-url] [desktop|mobile] [licht|donker]
#
# Anders dan de kaartscripts staat het thema hier expliciet in de aanroep:
# headless Chromium meldt van zichzelf `prefers-color-scheme: dark`, en de
# dashboardkaart moet in béíde thema's worden beoordeeld. De themaresolver
# (lib/utils/theme.ts) leest die mediaquery, dus dit stuurt hem via blink.
set -euo pipefail

LABEL="${1:-hero-$(date +%Y%m%d-%H%M%S)}"
BASIS="${2:-http://localhost:5173}"
MODUS="${3:-desktop}"
THEMA="${4:-licht}"
URL="$BASIS"
case "$URL" in
  *"/dev/hero"*) ;;
  *) URL="$BASIS/dev/hero" ;;
esac

UIT="screenshots/hero"
mkdir -p "$UIT"
PROFIEL="$(mktemp -d)"
trap 'rm -rf "$PROFIEL"' EXIT

if [ "$THEMA" = "donker" ]; then
  KLEURSCHEMA=0
else
  KLEURSCHEMA=1
fi

CHROMIUM="${CHROMIUM:-chromium}"
if [ "$MODUS" = "mobile" ]; then
  VENSTER="390,1400"
else
  VENSTER="1400,1500"
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
  --blink-settings=preferredColorScheme="$KLEURSCHEMA" \
  --screenshot="$UIT/$LABEL.png" \
  "$URL" 2>/dev/null

echo "$UIT/$LABEL.png"
