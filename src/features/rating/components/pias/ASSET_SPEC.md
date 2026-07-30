# Pias master artwork

`assets/pias-master.webp` is het enige live rasterartwork voor het
pias-breakout-effect.

- Canvas: 768 × 1024 px, sRGB WebP met alpha (kwaliteit 78). De uitvoermaat
  is een compromis met het bundelbudget uit `src/lib/utils/assetBudget.test.ts`;
  het script rekent op de volle referentieresolutie en schaalt pas in de laatste
  stap terug.
- Herkomst: volledig afgeleid van [`docs/referentie_pias.png`](../../../../../docs/referentie_pias.png)
  door [`scripts/pias-master.py`](../../../../../scripts/pias-master.py). Dit is
  het enige master-artwork met een reproduceerbare bron in de repo: bij een
  gewijzigde referentie of uitsnede draai je het script opnieuw, je bewerkt het
  WebP niet met de hand.
- Register: het kaartvak van de referentie (x 123…963, y 116…1302 op 1086 × 1448)
  ligt in het master-canvas op x 87…681 en y 82…908. `PiasEffect.css` zet dat
  vak exact op het echte kaartvlak; back, inside en front delen die ene
  transformatie.
- Transparantie: de hele kaartuitsnede is leeg. Rating, avatar, naam, divisie- en
  editieregel houden dus hun eigen contrast; er ligt geen waas overheen.
- `pias-front-mask.svg` houdt de viewBox van de referentie-uitsnede (1024 × 1365,
  dezelfde verhouding als het canvas). Het masker wordt met `100% 100%` op de
  laag geschaald, dus die viewBox is een coördinatenstelsel, geen resolutie.
- Compositie, met de klok mee vanaf boven: narrenkroon met twee bordeauxrode
  strikken op de bovenrand, zwart-gouden klaverteken rechtsboven, zwarte
  schaakpion rechts, twee speelkaarten met jokerhart rechtsonder, doorlopende
  lintboog met rozet en clownmedaillon onderaan, narrenkop met kap, bellen en
  plooikraag linksonder, aangebeten bagel links, en overal room-witte
  poederwolken, kolengruis, gouddeeltjes en rood-gouden confettiruiten.
- Materiaal: warm goud, bordeauxrood satijn, gebroken wit porselein, bijna
  zwarte kolen. Geen kaart, frame, tekst, statistiek, badge of achtergrond uit
  de referentie.
- Objecten blijven compleet. De referentie tekent kroon, rozet, lint, narrenkop,
  bagel, speelkaarten, pion en klaver óver de kaart; het script snijdt ze langs
  hun eigen contour uit in plaats van ze op de framerand af te breken. Twee
  stukken referentieframe die tussen de speelkaarten en tussen de horens van de
  narrenkap door zichtbaar bleven zijn expliciet weggelaten — die zouden als
  tweede gouden rand naast het echte frame verschijnen.
- Gruis: kolen, goudstof en confetti liggen ook op het perkament, maar alleen in
  de band tussen 26 en 132 px binnen de kaartrand en nooit over rating, avatar,
  naamplaat, statistiek of badgerij.
- Maskers: er is geen inside-mask; het echte `clip-path: var(--schild)` van
  `.fut-kaart__vlak` begrenst de binnenlaag, en het lege midden van het artwork
  doet de rest. `pias-front-mask.svg` selecteert de negen objectgroepen die vóór
  het frame mogen komen; tussen die groepen blijft de gouden rand zichtbaar.

Bij vervanging moet het canvasregister ongewijzigd blijven. Een gewijzigde
uitsnede vereist een bewuste herkalibratie van het frontmask én een nieuwe
desktop- en mobiele screenshot op dezelfde viewport.
