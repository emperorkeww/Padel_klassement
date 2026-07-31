#!/usr/bin/env bash
# Vaste screenshot van de echte Zwarte Piet-kaart op /dev/piet.
set -euo pipefail

LABEL="${1:-piet-$(date +%Y%m%d-%H%M%S)}"
BASIS="${2:-http://localhost:5173}"
MODUS="${3:-desktop}"
URL="$BASIS"
case "$URL" in
  *"/dev/piet"*) ;;
  *) URL="$BASIS/dev/piet" ;;
esac
if [ "${4:-}" = "kaart" ]; then
  case "$URL" in
    *"?"*) URL="$URL&kaart=1" ;;
    *) URL="$URL?kaart=1" ;;
  esac
fi

UIT="screenshots/piet"
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

# Vierde argument "kaart": alleen de kaart met zijn breakout, zonder titel en
# uitleg. De stage schakelt daarvoor zelf naar exportmodus via ?kaart=1 — dat is
# betrouwbaarder dan de stage-UI achteraf uit de pixels raden. Wat hier gebeurt
# is enkel nog de randen wegsnijden: de uitsnede volgt de alfa van de compositie,
# zodat het uitstekende goudstof meekomt. Zonder dit argument blijft de volledige
# stage in beeld (handig voor marge- en laagcontrole).
if [ "${4:-}" = "kaart" ]; then
  python3 - "$UIT/$LABEL.png" <<'PY'
import sys
import numpy as np
from PIL import Image

pad = sys.argv[1]
im = Image.open(pad).convert("RGB")
a = np.asarray(im).astype(np.int16)
# De stage-achtergrond is #070604 met een zwakke radiale gloed; alles wat daar
# noemenswaardig boven uitkomt is kaart of breakout. In exportmodus staat er niets
# anders op de pagina, dus de bounding box van dat "iets" is de compositie.
vol = a.max(axis=2) > 26
ys, xs = np.nonzero(vol)
marge = 6
box = (
    max(0, xs.min() - marge),
    max(0, ys.min() - marge),
    min(im.width, xs.max() + marge),
    min(im.height, ys.max() + marge),
)
im.crop(box).save(pad)
print(f"uitgesneden naar {box[2] - box[0]}x{box[3] - box[1]}", file=sys.stderr)
PY
fi

echo "$UIT/$LABEL.png"
