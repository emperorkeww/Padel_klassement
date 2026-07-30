# Wannabe master artwork

`assets/wannabe-master.webp` is het enige live rasterartwork voor het
Wannabe-breakout-effect (de goud-divisie, rating 1000–1099).

- Canvas: 1024 × 1440 px, sRGB WebP met alpha (kwaliteit 78).
- Herkomst: volledig afgeleid van
  [`docs/referentie_wannabe.png`](../../../../../docs/referentie_wannabe.png)
  door [`scripts/wannabe-master.py`](../../../../../scripts/wannabe-master.py).
  Master én frontmasker komen daar uit; bij een gewijzigde referentie of
  uitsnede draai je het script opnieuw, je bewerkt het WebP niet met de hand.
- Register: de buitenrand van de lijst in de referentie (x 97…986, y 120…1392 op
  1086 × 1448) ligt in het master-canvas op x 82…942 en y 150…1345.
  `WannabeEffect.css` zet dat vak exact op het echte kaartvlak
  (`left -9.53%`, `top -12.55%`, `width 119.07%`); achter, binnen en voor delen
  die ene transformatie.
- Transparantie: rating, subniveau, vormemoji, avatar, scheidingslijnen, naam,
  divisieband en statblok van de referentie zijn uit de perkamenttextuur
  gesneden. De kaart houdt dus haar eigen contrast; er ligt geen waas over de
  inhoud en geen spookkopie naast de echte tekst.
- Compositie, met de klok mee vanaf boven: bronzen racketcrest met fluitje op de
  bovenrand, plakstrook over de rechterflank, kruis in stift rechts van de
  avatar, gescheurd briefje "NOT BAD" met pijlen over de rechterlijst,
  inktdruipers onder de rechteronderrand, megafoonmedaillon in de schildpunt,
  stiftkroontje met krassenbundel over de linkeronderrand, briefje
  "ALMOST THERE?" met twee gebogen pijlen en handgetekend kader op de
  linkerflank, plakstrook daarboven en een afgesprongen splinter langs de
  linkerbovenlijst. Binnen het kaartvlak: rasterpuntvelden, spatten, vlekken en
  het getekende tekstballonnetje met kroontje.
- Materiaal: neutraal zwarte stift en inkt, warm tan plakband en pakpapier,
  bronzen medaillons, grauw perkamentvuil. Geen kaart, lijst, tekst, statistiek
  of achtergrond uit de referentie.
- Sleutels: `vast` (contour = masker) voor de massieve voorwerpen, `inkt`
  (donkerte × chroma × lokaal contrast) voor alles wat met stift getekend is, en
  `perkament` (donkere helft van twee detailschalen) voor het vuil in het
  kaartvlak. De drie poorten van de inktsleutel zijn nodig omdat de referentie op
  *wit* staat en dezelfde streek van buiten de kaart tot over de lijst loopt; het
  script legt uit waarom elke poort er is.
- Maskers: er is geen inside-mask; het echte `clip-path: var(--schild)` van
  `.fut-kaart__vlak` begrenst de binnenlaag, en het content-veilig gesneden
  midden van het artwork doet de rest. `wannabe-front-mask.svg` selecteert de
  tien onderdelen die vóór de lijst mogen komen; tussen die groepen blijft de
  walnoten rand zichtbaar. Het masker heeft bewust **geen** zwarte
  achtergrondrect: CSS `mask` met een SVG-*image* valt in `match-source` terug op
  alpha, niet op luminance, en een dekkende zwarte rect laat dan de hele master
  door.
- Vormcorrectie: de referentiekaart loopt tot ~84% hoogte op volle breedte door
  en tapst dan naar de punt; het app-schild (`#fut-schild-notch`) begint zijn
  taps al op 60%. Onderdelen in die onderhoek — kroontje, krassenbundel,
  druipers, megafoon — krijgen in het script een verschuiving in kaartfracties.
  De vier CSS-waarden blijven voor alle drie de lagen gelijk.

Bij vervanging moet het canvasregister ongewijzigd blijven. Een gewijzigde
uitsnede vereist een bewuste herkalibratie van het frontmask én een nieuwe
desktop- en mobiele screenshot op dezelfde viewport.
