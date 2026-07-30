# Dictator breakout asset

De live kaart gebruikt `assets/dictator-master.webp` als één coherent
decoratief artwork in drie dieptelagen.

- bronformaat: 1024 × 1536 px (2:3);
- sRGB WebP met alpha;
- centrale kaart- en contentzone grotendeels transparant;
- gedetailleerde zwarte officierspet met rode band, goudborduursel en
  stercocarde;
- twee bordeauxrode vaandels boven/naast de kaart;
- verbonden rook, embers en radiale goudrode lichtlijnen;
- twee volle antiekgouden lauwerkransen langs de onderste zijranden;
- gelaagde rood-gouden stermedaille in de kaartpunt;
- één tank linksonder;
- één doorlopend ceremonieel lint rechtsonder en onderaan;
- geen kaart, frame, speler, rating of overige kaarttekst in het rasterasset.

Alle instanties gebruiken dezelfde `--dictator-master-*`-properties.
`dictator-front-mask.svg` selecteert pet, lauweren, stermedaille, tank, lage
rook en enkele lintplooien vóór het frame. Het echte `.fut-kaart__vlak`
levert het responsieve inside-masker.
