# Slof-artwork: drie verbatim delen

De divisiekaart "Sletje van de baan" gebruikt geen samengesteld master-artwork en
ook geen dozijn losgesneden voorwerpen, maar **drie samenhangende delen die
letterlijk uit de referentie zijn gesneden en op hun eigen plek blijven**:

| bestand | wat | laag | montagepunt |
| --- | --- | --- | --- |
| `slof-buiten.webp` | spinrag om de bovenhoeken, ducttape op de rechterflank, losgeraakt afval | randAchter (20) | achter de kaart |
| `slof-plaat.webp` | het perkament binnen de lijst, mét scheuren, vlekken, vuil én het complete stilleven onderin (racket, fles, sok, papier, gruis en hun onderlinge schaduwen) | vuil (40) | in het kaartvlak, ónder de inkt |
| `slof-omlijsting.webp` | de volledige metalen lijst met beide crests en de boog | randVoor (70) | vóór de kaartzijde |

Alle drie zijn afgeleid van `docs/referentie_sletje_van_de_baan.png`
door [`scripts/slof-master.py`](../../../../../scripts/slof-master.py). Dat script
is de reproduceerbare bron van waarheid; het schrijft ook
`assets/slof-onderdelen.json` met per deel zijn plek als fractie van de kaartbox,
en `slofLayout.test.tsx` vergelijkt die plekken met de layout.

## Waarom drie delen en niet twaalf

Een eerdere versie sneed hier twaalf losse voorwerpen uit (fles, racket, sok,
papier, crest, tape, spinrag …) en zette ze op gemeten posities terug, en bouwde
de lijst opnieuw op uit een uitgerolde textuur. Dat kost precies wat een
referentie premium maakt:

- een uitgerolde band heeft geen afschuiningen, geen afgebrokkelde hoeken, geen
  roestaanslag en geen ingelegde crest — alleen korrel;
- losgezette voorwerpen verliezen de contactschaduwen waarmee ze in het bronbeeld
  op elkaar en op het perkament rusten, en de ondercrest leest dan als een
  plaatje dat er ná het frame op is gelegd;
- twaalf losse alfakanalen leveren twaalf randen waar er in het origineel geen
  zijn.

De drie delen hierboven zijn wél apart te stapelen (het rag hangt achter de
lijst, de plaat onder de inkt) maar zijn intern ongeschonden: hun onderlinge
ligging is die van het bronbeeld.

## Silhouet

Het silhouet komt uit het beeld zelf: drempel → grootste samenhangende component
→ gaten dichten. Niet uit een handgetekende polygoon en niet uit een generieke
clip-path. De alfa van `slof-omlijsting.webp` ís daarmee de kaartvorm, inclusief
de schouders, de boog en de onderrand.

Daarom zet de layout `eigenSilhouet: true`. De kaart voegt dan
`fut-kaart--eigen-silhouet` toe, zet `--schild: none` en maakt frame, liner,
keyline en vlak onzichtbaar — anders tekent de generieke schil een tweede rand en
een lichter kaartvlak onder een artwork dat zijn eigen contour en licht al heeft.

## Kaartbox

x 103..921, y 111..1248 in de referentie — precies 818 × 1137 px, en dat is exact
de 100 : 139 van de app. De afbeelding van referentie naar kaart is dus een
zuivere verschuiving met schaal ~1, en de kaarthoogte blijft ongewijzigd.

## Wat er uit de plaat gaat

Alleen wat de kaart zélf zet: de lettervormen van de referentie, haar vormemoji
en haar profielfoto. Niet de omgeving daarvan — juist daar zit het vuil dat de
kaart moet dragen.

Twee dingen die het script daarvoor expliciet afhandelt:

**De letters worden absoluut gedetecteerd, niet lokaal.** Ze zijn bijna zwart
(luma 14–28) op perkament rond 148; dat scheidt veel harder dan een lokale
contrastdrempel, die op deze zwaar getextureerde plaat ook scheuren en vlekken
oppikt en er dan hele blokken uithaalt. De waarden staan in lakrood — donkerder
dan perkament maar niet zwart — en krijgen een eigen tak op kleur.

**De inpaint verplaatst échte textuur.** Elke weggehaalde pixel krijgt het
*residu* (beeld min het gefitte perkamentveld) van een schone perkamentplek
elders, op het lokale veld gezet. Een genormaliseerde convolutie — het gemiddelde
van de omgeving — is glad, en tegen deze plaat tekent elke gladde plek zich af
als spookvorm van de weggehaalde letter. De bronnen zijn beperkt tot rustig
perkament bóven de propzone: zonder die eis telt het stilleven onderin ook als
"schoon" en wordt een halve racket als textuur in het statblok geplakt.

Het gat voor de profielfoto is transparant, met exact de straal van de stenen
ring in de referentie (150 px op de kaartbox). De app zet daar zijn eigen avatar
in; de ring eromheen zit ín de plaat en is dus ingebed met zijn eigen afschuining
en slagschaduw.

Bij vervanging moet de kaartbox ongewijzigd blijven. Een andere uitsnede vereist
een nieuwe meting van de zones in `slofLayout.ts` én nieuwe desktop- en mobiele
screenshots op dezelfde viewport.
