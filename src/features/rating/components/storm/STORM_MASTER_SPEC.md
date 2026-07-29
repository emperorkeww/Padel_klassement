# Storm master — assetspecificatie

## Technisch

- Bestand: `assets/in-form/storm-master.webp`
- Canvasverhouding: 361:384 (huidige bron: 1444 × 1536 px)
- Aanbevolen productieformaat: minimaal 2166 × 2304 px
- Achtergrond: volledig transparant alpha-kanaal; geen rechthoekige matte
- Kleurruimte: sRGB
- WebP: alpha behouden, bij voorkeur lossless of visueel lossless
- Het hele canvas wordt als één ondeelbaar artwork gebruikt. Wolken,
  rook, verlichting en bliksem mogen niet als losse browserassets worden
  geëxporteerd.

## Compositie

- Eén samenhangende, donkere, volumetrische cumulonimbus.
- Grootste massa in de bovenste en rechterhelft van het canvas.
- Aan de linkerkant een zachte, rafelige rookaanloop; geen rij herkenbare
  cirkels of losse bolwolken.
- Donkere blauwgrijze kernen met overlappende schalen en diepte.
- Goud-wit lokaal randlicht rond de ontlading; de rest blijft donker en
  contrastrijk.
- Transparante rookranden moeten geleidelijk naar alpha 0 uitlopen.
- De extra transparante breedte links draagt een lage secundaire wolkmassa
  en dun vertakte bliksem; de oorspronkelijke rechterkolom begint op x=420.

Bij de huidige browsertransform vult het dichte interne deel circa 35–45%
van de kaartbreedte, loopt de kolom circa 110% van de kaarthoogte door en
eindigt de transparant uitlopende buitenrand circa 26% voorbij rechts.
Het zwaartepunt ligt rechtsboven/rechtsmidden; linksonder blijft leeg of
hooguit zeer subtiel.

## Bliksem

- Eén hoofdtraject, diagonaal van het boven-midden naar rechts-midden.
- Enkele korte vertakkingen, geen tweede dominante ontlading.
- De kern is goud-wit met een kleine amberkleurige halo.
- Geen pad dat de kaartcontour of rechterrand volgt.
- Het traject kruist bij de huidige plaatsing één of twee keer de
  rechterframerand en blijft grotendeels rechts van de avatar.

## Maskers en registratie

`storm-front-mask.svg` gebruikt dezelfde 1444 × 1536-viewBox als het
master-artwork. Het selecteert alleen een bovenste en een middelste lob voor
lokale frame-occlusie. De back-, inside- en front-instanties mogen geen eigen
`left`, `top`, `width`, `scale` of `rotate` krijgen.

De inside-instantie wordt door het bestaande `.fut-kaart__vlak` met
`clip-path: var(--schild)` gemaskeerd. De negatieve inset compenseert exact
frame + liner + keyline, zodat zijn coördinaten opnieuw gelijk zijn aan de
100 × 139 kaartstage.

## Generatieprompt van de huidige bron

Use case: precise-object-edit. Expand the existing central storm to a tall
2:3 portrait composition and turn it into one continuous vertical
thundercloud column. Preserve the central cloud mass, its horizontal
placement and the single diagonal gold-white lightning trajectory. Add
genuinely new volumetric lobes above the old top and connected dark cloud
and smoke below the old bottom; do not vertically stretch the existing
texture. Keep the dense main mass upper-right and mid-right, with irregular
silhouette, almost-black and charcoal cores, restrained cool-blue shadows,
transparent wispy edges and only local amber rim light near the existing
bolt. Use a flat `#00ff00` chroma-key background for local background
removal. No card, frame, avatar, text, rain, debris, straight edges,
geometric cropping, repeated circular cloud row, separate floating cloud
islands, watermark or second main lightning.
