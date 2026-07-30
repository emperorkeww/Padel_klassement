# GOAT master artwork

`assets/goat-master.webp` is het enige live rasterartwork voor het
GOAT-breakout-effect. Het is samengesteld uit `docs/referentie_goat.png` met
`scripts/goat-master.py`; dat script is de reproduceerbare bron van waarheid
voor iedere maat en positie hieronder.

- Canvas: 1024 × 1664 px, sRGB WebP met alpha.
- Kaartvak in het canvas: x 146..877, y 539..1556. Dat volgt exact uit
  `--goat-master-left: -20%`, `--goat-master-top: -53%` en
  `--goat-master-width: 140%`; wijzigt één van die drie, dan moet het canvas
  opnieuw worden opgebouwd.
- Register: achter, binnen en voor gebruiken exact dezelfde CSS-positie,
  breedte, schaal en rotatie.
- Veilige zone: de kaartzone boven de naamplaat blijft leeg op de bergscene na.
  Rating, subniveau, watermerk, avatar, naam en tierregel worden nooit door
  artwork overlapt.
- Compositie (canvasposities):
  - twee spiraalvormige bokhoorns, x 57..372 en 652..966, y 181..618 — ze
    steken ±90 px buiten de kaartflanken uit en duiken met hun coil achter de
    bovenhoeken van het frame;
  - het geitenmonument op zijn rots, x 376..748, y 26..566; de rotsbasis loopt
    door tot achter de bovenrand van de kaart;
  - kristalclusters langs beide flanken, x 24..224 en 802..1012, y 347..1222,
    met twee wiggen die over de framerand heen groeien;
  - de bergscene in het kaartvlak, x 174..867, y 852..1208, met de basis op de
    naamplaatlijn;
  - de kristalchevron met edelsteen in de schildpunt, x 393..631,
    y 1368..1564 — de punt eindigt net onder de schildpunt.
- Materiaal: rosé-metaal, magenta kristal, bijna zwart gesteente, roze nevel en
  gouddeeltjesachtige sterren. Geen kaartframe, tekst, rating, avatar of
  rechthoekige achtergrond in het beeld.
- Maskers: `goat-inside-mask.svg` laat binnen het schild alleen de bergscene
  door; `goat-front-mask.svg` selecteert de kristalpunten op de flanken en de
  volledige edelsteen-chevron. Beide maskerranden vallen bewust bínnen de
  bijbehorende uitsnede: de zachte overgang verbergt de rechte uitsnederand in
  plaats van hem te tonen.

Bij vervanging moet het canvasregister ongewijzigd blijven. Een andere uitsnede
vereist een bewuste herkalibratie van beide maskers én een nieuwe desktop- en
mobiele screenshot op dezelfde viewport.
