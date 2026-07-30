# Big Daddy master artwork

De live kaart gebruikt `assets/bigdaddy-master.webp` als één coherent
feestdecor. Het bestand is **gegenereerd**, niet met de hand geplaatst:

```bash
node scripts/bigdaddy-master-compose.mjs [--preview]
```

Dat script bouwt de master uit `assets/bigdaddy-onderdelen.webp` — het oudere
Big Daddy-ringartwork, dat als onderdelenblad bewaard blijft. Het blad wordt
door geen enkele module geïmporteerd en zit dus niet in de bundel; alleen de
master doet mee.

## Waarom een compositiescript

De ring uit het onderdelenblad hing als één dichte krans óm de kaart: het
gouden frame verdween links en rechts volledig achter satijn en de kroon
bedekte een derde van het kaartvlak. `docs/referentie_big_daddy.png` doet het
omgekeerd — het frame blijft rondom leesbaar en de objecten raken het frame
alleen plaatselijk. Het script snijdt de objecten daarom los en zet ze terug op
de posities die de referentie aanhoudt, gemeten als fractie van het kaartvlak.
Elke plaatsing in `ONDERDELEN` heeft zo een meetbare tegenhanger in de
referentie, en de compositie is opnieuw te bouwen zonder gelaagd bronbestand.

## Canvas en registratie

- master: 1280 × 1727 px, sRGB WebP met alfakanaal;
- het canvas hangt links en rechts 20% en boven 22% buiten de kaart;
- dat zijn exact `--bigdaddy-master-left: -20%`, `--bigdaddy-master-top: -22%`
  en `--bigdaddy-master-width: 140%` in `BigDaddyEffect.css`.

Wijzig je de marges in het script, wijzig dan diezelfde drie waarden mee.
`BigDaddyEffect.test.tsx` vergelijkt script, CSS en maskers als tekst en valt
om zodra ze uit de pas lopen.

## Compositie

- pluchen wolken linksboven en rechtsboven, met magenta rook op de linkerflank;
- een grote juwelenkroon die met haar band op de bovenrand rust;
- hartballon, gouden sterballon en strik over de rechterbovenhoek;
- een tweede, gespiegelde hartballon op halve hoogte links;
- satijnlinten, neonharten en de pluchen ster op de rechterflank;
- een volledige gekroonde teddy met cape en hartstaf linksonder;
- linten linksonder en rechtsonder plus het gevleugelde hartmedaillon in de
  schildpunt;
- de centrale zone blijft leeg voor rating, avatar, naam en editie-informatie.

Twee valkuilen die het script expliciet afhandelt: een snee die volledig in een
massa ligt (de wolken) is overal dekkend en heeft dus een gelobd silhouetmasker
nodig — een veer alleen maakt er een zachte rechthoek van. En de veer, de
silhouetten, de alfa en de kleurcorrectie rekenen met de hand op de rauwe
RGBA-buffer: sharps `dest-in` en `modulate` lieten in deze pijplijn
respectievelijk de randen ongemoeid en het alfakanaal plat.

## Maskers

`bigdaddy-front-mask.webp` en `bigdaddy-inside-mask.webp` worden door hetzelfde
script gegenereerd en zijn dus afgeleid, geen handwerk. Ze zijn raster en geen
SVG, omdat hun vorm **de alfa van de onderdelen zelf** is:

- het frontmasker stempelt de alfa van elk onderdeel met een `voor`-selectie.
  Complete objecten mogen vóór het frame komen; de wolken en het middenstuk van
  het rechterlint blijven eronder, waardoor het satijn zichtbaar achter én vóór
  het frame weeft;
- het binnenmasker stempelt álle onderdelen en dempt die radiaal naar het
  midden, zodat alleen de randgebonden feestwaas in het schild komt en rating,
  avatar, naam en editieregel vrij blijven.

Een eerdere versie gebruikte SVG-vormen op de bounding box van elk onderdeel.
Dat is precies de fout die §12/stap 7 verbiedt: de frontlaag schilderde daardoor
hele rechthoeken artwork (wolk, gloed, naburige onderdelen) over kaart en frame,
met rechte randen dwars over de lijst. Een masker op objectcontour kan dat niet.

Twee details die daarbij horen: de versterkingsfactor blijft laag (1,3–1,8), want
een hoge factor maakt de geveerde snederand van een onderdeel weer een rechte
kant in het masker; en de maskers staan op halve resolutie, omdat ze per
definitie zacht zijn en de CSS ze naar 100% × 100% rekt.

Werk ze niet met de hand bij: de volgende scriptrun overschrijft dat.

## Overig

De oudere SVG-paden in `ornamentenBigDaddy.ts` blijven bestaan als
deterministische canvas/posterfallback, maar worden niet meer op de live
React-kaart gemount wanneer `editie === "icon"`.
