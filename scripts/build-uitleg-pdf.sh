#!/usr/bin/env bash
# Bouwt de spelersuitleg-PDF's in docs/ (#1004).
#
# Twee stappen omdat LaTeX geen webp leest: eerst de avatars van Coach Rudy naar
# png (macOS `sips`, zit in het systeem), dan xelatex. Alles behalve de PDF
# belandt in een tijdelijke map, zodat er geen .aux/.log/.png in de repo
# achterblijft.
#
# Gebruik:  ./scripts/build-uitleg-pdf.sh
set -euo pipefail

wortel="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
avatars="$wortel/src/features/coach/components/rudi_avatars"
werkmap="$(mktemp -d)"
trap 'rm -rf "$werkmap"' EXIT

for naam in rudi-portret rudi-gemeen; do
  sips -s format png "$avatars/$naam.webp" --out "$werkmap/$naam.png" >/dev/null
done

for bron in "$wortel"/docs/*-uitleg.tex; do
  echo "→ $(basename "$bron")"
  # Twee keer draaien is hier niet nodig (geen verwijzingen/inhoudsopgave), maar
  # de werkmap moet wel in TEXINPUTS staan zodat \includegraphics de png's ziet.
  TEXINPUTS="$werkmap:$wortel/docs:" xelatex \
    -interaction=nonstopmode -halt-on-error \
    -output-directory="$werkmap" "$bron" >/dev/null
  cp "$werkmap/$(basename "${bron%.tex}").pdf" "$wortel/docs/"
done

echo "Klaar — PDF's staan in docs/."
