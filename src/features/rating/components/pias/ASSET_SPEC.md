# Pias master artwork

`assets/pias-master.webp` is het enige live rasterartwork voor het
pias-breakout-effect.

- Canvas: het script rekent in 1024 × 1365 (dat is ook de viewBox van het
  frontmasker en de ruimte waarin `FRONT_GROEPEN` staat) en schrijft het WebP op
  768 × 1024, sRGB met alpha, kwaliteit 86. Die twee maten zijn los van elkaar:
  het masker is vector en kost niets, terwijl het raster de bundel belast — en
  die zit met ~9,8 MB dicht tegen de grens uit `assetBudget.test.ts`. Het
  register is percentagegebaseerd, dus aan de rastermaat hangt alleen de
  scherpte, niet de compositie.
- Herkomst: volledig afgeleid van [`docs/referentie_pias.png`](../../../../../docs/referentie_pias.png)
  door [`scripts/pias-master.py`](../../../../../scripts/pias-master.py). Dit is
  het enige master-artwork met een reproduceerbare bron in de repo: bij een
  gewijzigde referentie of uitsnede draai je het script opnieuw, je bewerkt het
  WebP niet met de hand.
- Register: het kaartvak van de referentie (x 123…963, y 116…1302 op 1086 × 1448)
  ligt in het master-canvas op x 116…908 en y 109…1210. `PiasEffect.css` zet dat
  vak exact op het echte kaartvlak; back, inside en front delen die ene
  transformatie.
- Transparantie: de hele kaartuitsnede is leeg. Rating, avatar, naam, divisie- en
  editieregel houden dus hun eigen contrast; er ligt geen waas overheen.
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
  **Dat masker is gegenereerd, niet handwerk** — het script schrijft het mee,
  want zijn vensters dragen dezelfde schuif als het artwork (zie hieronder). Werk
  het dus niet met de hand bij; pas `FRONT_GROEPEN` in het script aan en draai het
  opnieuw.
- Schildcontour: de kaartrand van de referentie houdt rechte flanken tot ~88%
  hoogte, het app-schild (`#fut-schild-notch`) knijpt al vanaf 60% naar zijn punt.
  Alles wat in de referentie die rand markeert, stond daardoor onderaan náást de
  kaart in de lucht. De onderste helft van de ring schuift daarom horizontaal mee
  met de rand van het écht gebruikte schild: per rij het verschil tussen die rand
  en de referentierand, begrensd op 120 px, alleen van y afhankelijk (een schuif
  die met x meeloopt rékt de lintlussen uit, één die enkel van y afhangt kantelt
  ze). Het centrale medaillon blijft staan en gaat 5 px terug naar de kaartas; die
  zone dekt tegelijk de plek waar de schuif van teken wisselt, zodat de
  doorlopende lintboog geen naad krijgt.
- Anders dan bij de kettingen van de Zwarte Piet staat de schuif *niet* uit binnen
  het schild. De pias-props liggen met opzet half over de kaart — speelkaarten
  rechts, plooikraag linksonder — en een schuif die op de schildrand op nul valt,
  scheurt zo'n prop precies daar in twee. Het kaartvlak is in de master toch
  transparant, dus er valt binnen het schild niets te beschermen.
- Na de schuif komt materiaal dat buiten de referentiekaart lag binnen het schild
  terecht. Voor de props is dat de bedoeling; voor los gruis niet. Een
  dieptepoort handhaaft daarom óók ná de schuif de band van 132 px: zonder die
  poort liep de roetsliert onder de narrenkop tot ~200 px in het vlak, tot tegen
  de editieregel.

Bij vervanging moet het canvasregister ongewijzigd blijven. Een gewijzigde
uitsnede vereist een bewuste herkalibratie van `FRONT_GROEPEN` én een nieuwe
desktop- en mobiele screenshot op dezelfde viewport.
