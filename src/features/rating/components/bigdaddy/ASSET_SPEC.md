# Big Daddy master artwork

De live kaart gebruikt `assets/bigdaddy-master.webp` als één coherent
feestdecor. De bron is 1024 × 1536 px, bevat een alfakanaal en houdt het
centrale kaartvlak grotendeels vrij.

De compositie bevat:

- een grote champagnegouden kroon met roze edelstenen bovenaan;
- verbonden roze wolken achter de bovenrand;
- een balloncluster en strik rechtsboven;
- een gekroonde pluchen beer met cape en hartstaf linksonder;
- een kleinere pluchen ster rechts;
- satijnen linten, harten, confetti en magenta rook langs de flanken;
- een gevleugeld hartmedaillon onderaan.

Alle drie de DOM-instanties gebruiken dezelfde `--bigdaddy-master-*`
custom properties. De bestaande schildclip begrenst de inside-laag en
`bigdaddy-inside-mask.svg` houdt daarin alleen wolken, linten en ondergloed
over. `bigdaddy-front-mask.svg` selecteert alleen de kroon, de volledige maar
lager geplaatste teddy, beperkte ballondelen, de pluchen ster en het onderste
medaillon vóór het frame.

De oudere SVG-paden in `ornamentenBigDaddy.ts` blijven bestaan als
deterministische canvas/posterfallback, maar worden niet meer op de live
React-kaart gemount wanneer `editie === "icon"`.
