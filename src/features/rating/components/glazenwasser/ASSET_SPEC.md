# Glazenwasser-artwork

De actuele bron van waarheid is
`docs/fut-kaarten/referentie_glazenwasser.png` (1024 × 1536). Alle productie-
assets worden reproduceerbaar gebouwd met:

```bash
python3 scripts/glazenwasser-onderdelen.py --preview
```

De generator vult de 2:3-referentie horizontaal transparant op tot een
100:139-stage. Daardoor blijven alle pixels in hun oorspronkelijke verhouding,
terwijl de kaartbox exact dezelfde dimensies houdt als elke andere FUT-kaart.

| asset | inhoud | afnemer |
| --- | --- | --- |
| `gw-water-back.webp` | buitenste bellen en waterspatten | `GlazenwasserKaart`, achter het schild |
| `gw-ring.webp` | zilver/marine/cyaan frame, topbadge, rechtertrekker, emmer met spray/doek, spons en onderbadge | `GlazenwasserKaart`, vóór frame en inhoud |
| `gw-glas.webp` | naadloze, halftransparante natglastegel | geclipt kaartvlak |
| `glazenwasser-master.webp` | dezelfde achter- en ringlagen geregistreerd op de compacte kaartstage | `GlazenwasserEffect` in `FutKaart` |
| `glazenwasser-front-mask.webp` | half-size RGBA-alfamasker van uitsluitend crest, badges, trekker, emmer, spons en schuim | voorselectie boven het compacte frame; CSS/canvas schaalt naar mastermaat |
| `gw-onderdelen.json` | maten, alfa, dekking en bestandsgrootte | layout- en assettests |

## Laagcontract

De grote kaart en de compacte kaart delen hetzelfde beeldmateriaal:

1. `waterBack` staat achter de echte kaartzijde;
2. de natglastegel wordt door het echte Glazenwasser-schild geclipt;
3. avatar en dynamische data blijven React-inhoud;
4. `cardRing` staat vóór de lijst en bevat alleen referentie-artwork buiten de
   veilige datazones;
5. de compacte `FutKaart` rendert één master achter, binnen en vóór; het
   frontmask laat uitsluitend de frame-breakers door. De metalen ring blijft in
   de binnenlaag, zodat hij nooit over emmer, spons of trekker heen schildert.

De profielafbeelding, rating, naam, divisietekst en waarden worden nooit uit de
referentie overgenomen. Zij blijven dynamisch. De vaste divisietekst op de grote
kaart is `GLAZENWASSER`; de statlabels zijn `PAC`, `SHO`, `PAS`, `DRI`, `DEF` en
`PHY`, met waarden uit `glazenwasserStats.ts`.

## Clipping en schaal

`gwSchildPad()` is de gedeelde contour voor `GlazenwasserKaartDefs` en
`FutKaartDefs` (`#fut-schild-glazenwasser`). De stage en alle bestaande
kaartweergaven houden `aspect-ratio: 100 / 139`; alleen de clip heeft de gebogen
schouders, centrale badge-recess en bredere referentiepunt. Frame-breakers leven
buiten de clip, maar binnen de geïsoleerde kaartstage. De eigenaar van showcase,
modal of carousel begrenst documentoverflow.

## Kwaliteitscontrole

`glazenwasserAssets.test.ts` controleert aanwezigheid, maten, alfa en
stage-registratie. `GlazenwasserEffect.test.tsx` borgt dezelfde masterbron voor
achter/binnen/voor en de montage van de binnenlaag in het echte kaartvlak.
Visuele controle gebeurt via `/dev/glazenwasser` en:

```bash
scripts/glazenwasser-screenshot.sh final-desktop http://127.0.0.1:5178 desktop
scripts/glazenwasser-screenshot.sh final-mobile http://127.0.0.1:5178 mobile
```
