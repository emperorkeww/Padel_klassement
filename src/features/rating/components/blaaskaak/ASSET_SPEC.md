# Blaaskaak master artwork

`assets/blaaskaak-master.webp` is het live rasterartwork voor de kale
Blaaskaak-divisie (`zilver`, rating 900–999).

- Canvas: 1086 × 1538 px, sRGB WebP met alpha, circa 102 KB. De extra
  bovenruimte laat de megafoon ver buiten de kaart breken zonder hem aan de
  canvasrand af te snijden.
- Herkomst: gegenereerd met `docs/referentie_blaaskaak.png` als directe
  compositie-, materiaal- en lichtreferentie. De productie-uitvoer is met een
  vlakke chroma-key gegenereerd, lokaal naar alfa omgezet en als WebP
  gecomprimeerd. Dit is bewust beeldwerk: megafoon, metaal, mond en enamel
  worden niet als SVG nagetekend.
- Compositie: wit-chromen megafoon en blauwe geluidsschichten bovenaan, een
  comic-burst links, een navy tekstballon met drie witte dots rechts en het
  mondmedaillon met schichten in de schildpunt. De rating-, avatar-, naam-,
  divisie- en statzones zijn leeg. De kaartomranding zit bewust niet in het
  artwork. Blaaskaak gebruikt vier eigen `fut-schild-blaaskaak-*`-clips:
  frame en liner vormen een doorlopende asymmetrische bovenbrug met de vaste
  rechterknik; keyline en vlak wijken centraal terug voor de
  megafoonuitsparing. De kaart valt dus nergens terug op de generieke
  `var(--schild)`-vorm.
- De symbolen `#!&*` in de linker burst zijn scherpe, decoratieve DOM-tekst.
  Alleen de eenvoudige tekens blijven code-native; complex metaal, enamel en
  licht blijven rasterartwork.
- Register: alle drie instanties gebruiken uitsluitend de vijf
  `--blaaskaak-master-*`-properties in `BlaaskaakEffect.css`.
- Diepte: de volledige master staat achter de kaart en binnen het echte
  Blaaskaak-vlak. De voorinstantie gebruikt de alfa van het WebP zelf als
  organische contour; er is geen nagebouwd masker voor het artwork.
- Cascade: het effect wordt alleen zonder editie gemonteerd. Een In-Form-,
  On-Fire- of andere editie op een zilveren kaart behoudt dus zijn eigen skin
  en ornamenten.

Bij vervanging moeten canvasverhouding en lege contentzones behouden blijven.
Controleer daarna `/dev/blaaskaak` op desktop en mobiel.
