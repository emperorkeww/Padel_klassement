# De In-Form-dashboardkaart

Dit document beschrijft hoe de dashboard player card van de In-Form-drager naar
[`in_form_dashboard.png`](in_form_dashboard.png) is gebracht. Het volgt
[`big-daddy-dashboardkaart.md`](big-daddy-dashboardkaart.md): dezelfde
laagopbouw, dezelfde regel voor een vloeiende doos, dezelfde screenshotroute.
Wat af is staat in §7, wat er nog komt in §8.

De twee bestaande kaartdocs blijven de naslag voor het materiaal:

- [`../fut-kaarten/special-card-visual-effects-architecture.md`](../fut-kaarten/special-card-visual-effects-architecture.md)
  — de ⚡-FUT-kaart zelf: één storm-master, drie registraties, frontmasker;
- [`big-daddy-dashboardkaart.md`](big-daddy-dashboardkaart.md) — waarom een
  dashboardkaart die structuur niet kan overnemen, en wat er wél uit overkomt.

## 1. Wat deze kaart anders maakt dan de Big Daddy

Twee dingen, en ze werken allebei in ons voordeel.

**De storm breekt niet uit.** Op de FUT-kaart is occlusie het hele dieptesignaal:
wolk in het vlak, wolk achter het frame, twee lobben vóór het frame. De
referentie doet dat hier niet. Meet de rechterflank na
([`if_rand`](in_form_dashboard.png), x 1520…1733) en het goud is over de volle
hoogte ononderbroken; de storm eindigt exact op de gouden keyline. Er is dus
géén voorlaag, géén `storm-front-mask.svg`-equivalent en géén contactschaduw
nodig. Alles wat de kaart tekent, tekent ze ín het kaartvlak. Dat is de helft van
de complexiteit van elke breakout-editie.

**In-Form is een overlay, geen permanent thema.** Big Daddy staat in
`HeroPermanent` en mag het kaartvlak per definitie overnemen. In-Form staat in
`HeroOverlay` en mag dat per #771 (AC4) juist níét: wie deze week in vorm is én
de pias van zijn groep, hoort een piaskaart met een In-Form-glans te zien. De
referentie toont de In-Form-kaart mét een Big Daddy- én een Kampioen-chip, dus
ze is het beeld van een speler die deze statussen draagt — niet het bewijs dat
In-Form het roze mag overschilderen. §4 zet de regel vast die dat oplost.

## 2. De referentie, opgemeten

`in_form_dashboard.png` is 1774 × 887; de kaartbox ligt op x 47…1733 en
y 57…842 — 1686 × 785, dus 2,15 : 1.

| onderdeel | meting | omgerekend |
| --- | --- | --- |
| goudrail (buitenste band) | 9 px helder + ~13 px afschaduwing op de flank | 0,53 % van de kaartbreedte |
| zwarte band | 6 px | 0,36 % |
| gouden keyline | 4 px | 0,24 % |
| chamfer op de keyline | ≈ 50 px | 3,0 % |
| kaartvlak | #0d0d10, vrijwel neutraal zwart | iets donkerder dan de tintstops van de dunne variant |
| rail-goud | #f9eab8 → #e1bc67 → #987131 | champagne met een specular top |
| keyline-goud | piek #fff38e | ≈ `--inform-lijn` (#ffd56b) één stap heter |
| groeven | diagonale pinstripes, ~115°, ook over de storm | = `.hero__groeven--inform` |

Twee meetresultaten sturen het hele plan:

1. **de lijst is dezelfde stapeling als bij Big Daddy** — rail, band, keyline,
   vlak — alleen zwart-goud in plaats van goud-magenta. `HeroLijst` hoeft niet
   te veranderen, alleen een tweede materiaal te krijgen;
2. **de keyline is achthoekig, de buitenrand niet.** De buitenste goudrail volgt
   een gewone afgeronde hoek; het is de gouden haarlijn eróver die de hoek
   diagonaal afsnijdt. Rail en band houden dus `border-radius`, keyline en vlak
   krijgen een `clip-path: polygon(…)`. Dat is precies andersom als het lijkt op
   een verkleinde screenshot, en het scheelt de vraag wat er met de slagschaduw
   van een achthoekige kaart moet gebeuren.

Aan voorwerpen draagt de referentie:

- een **stormkolom** langs de hele rechterflank, zwaartepunt rechtsboven, die
  onderaan tot in de rechteronderhoek doorloopt;
- een **racketsilhouet**, donkerder dan de storm, dat er half voor hangt;
- een **embersleep** in de linkeronderhoek: een handvol vonken en één dunne
  vertakking, verder niets;
- een **bliksemschild** op het midden van de bovenrand, half boven de kaart uit;
- de avatar in een **dubbele goudring** met een lichtboog rechtsonder;
- chips als **platen** (goud, magenta, groen, oranje) en knoppen als
  **achthoekige platen** met een goudrand en een gloed langs de onderkant;
- een gouden haarlijn als `hero__divide`, en de naam in een **zilververloop** in
  plaats van vlak wit.

## 3. Laagmodel

Ongewijzigd overgenomen uit `big-daddy-dashboardkaart.md` §3, met één laag
minder omdat er niets vóór het frame komt:

```text
hero__lagen (geklipt op de kaartradius)
  1 hero__lijst        goudrail          (border-radius)
  2   hero__lijst-band zwarte band       (border-radius)
  3     hero__lijst-key gouden keyline   (clip-path, achthoek)
  4       hero__vlak   zwart + groeven   (clip-path, achthoek)
              ↳ stormkolom, racket, embersleep: geklipt op de binnenrand,
                dus per constructie achter de lijst
  inhoud (z-index 1)
hero__lagen--voor (ongeklipt, z-index 2)
  5 alleen het bliksemschild op de bovenrand
```

`HeroLijst.tsx` blijft zoals hij is. Wat verandert is `HeroLagen`: `eigenLijst`
is nu een `permanent === "bigdaddy"`-vergelijking en moet een functie van beide
assen worden (§4).

## 4. De regel: wanneer krijgt een overlay een eigen lijst?

> Draagt een overlay een eigen referentieontwerp, dan neemt hij vlak en lijst
> over — op élke kaart. De ornamenten en de chip van het permanente thema blijven
> staan.

| situatie | vlak en lijst | stormartwork | ornamenten van het thema |
| --- | --- | --- | --- |
| In-Form, geen permanent thema | In-Form | ja | — |
| In-Form over Big Daddy | In-Form | ja | teddy, linten, hoekharten, medaillons |
| In-Form over kampioen / pias / Piet / dictator | In-Form | ja | krans, kap, medaillon, ringen, hoeken |
| On Fire over wat dan ook | het thema zelf | n.v.t. | alles |

Dit is de tweede versie van deze regel, en de eerste staat er niet meer. Die zei:
een overlay krijgt zijn eigen lijst *alleen* wanneer er geen permanent thema is,
want #771 (AC4) wil dat de kaart eronder herkenbaar blijft. Dat leverde twee
behandelingen voor één status op — hier een volle stormkaart, daar een dunne
navy tint — en die lazen naast elkaar als twee verschillende statussen. Erger:
juist de speler die én in vorm is én de pias van zijn groep kreeg de zwakste van
de twee te zien, terwijl hij de meeste titels draagt.

Wat AC4 wilde beschermen blijft overeind, alleen niet meer via het materiaal:

- **de ornamenten van het permanente thema blijven** — de teddy en de satijnlinten
  van de Big Daddy, de narrenkap en het maskermedaillon van de pias, de
  lauwerkrans en de linten van de kampioen. Ze hangen in `hero__lagen--voor` en
  raken het vlak niet, dus ze kunnen gewoon mee op het zwart;
- **de chip blijft** in de titelrij, zoals altijd. Kleur is nooit de enige
  indicator (#613);
- **de crest van het thema schuift naar 26%**, zoals hij dat voor elke overlay al
  deed. Het midden van de bovenrand is voor de schildcrest van In-Form.

Wat er ná deze wijziging niet meer is: de dunne In-Form-variant. Bliksemwatermerk,
pulsring, twee snelheidslijnen, de kale glyph-crest en de In-Form-tint zijn
verwijderd in plaats van als fallback blijven staan — dezelfde keuze die de Big
Daddy met zijn vectorornamenten maakte, en om dezelfde reden: er is geen tweede
tekenaar (canvas, poster) die ze nog nodig heeft.

On Fire houdt zijn dunne overlay. Niet uit principe, maar omdat er nog geen
referentieontwerp voor is: `heroLijstProfiel` heeft er een tak voor zodra die er
wel is.

## 5. De regel voor een vloeiende doos

Ongewijzigd uit `big-daddy-dashboardkaart.md` §4 — diktes in `cqw`, elke maat
een `clamp()`, elk onderdeel aan één rand of hoek, geen randlopers die de volle
rand overspannen. Eén toevoeging die deze kaart erbij eist:

**Artwork mag nooit onder de tekstkolom komen.** Wit op de heldere kern van een
bliksem haalt 3,1:1 en goud 2,1:1 — allebei ruim onder AA. Op het kale vlak
(#0d0d10) haalt wit 19,4:1 en het champagnegoud 12,9:1, dus de marge is er alleen
zolang de storm rechts van de tekst blijft. Dat is geen art direction maar een
harde grens, en hij moet in de code staan: de linkerrand van de stormkolom
verloopt met een maskergradient naar 0 vóór de tekstkolom, en die grens
verschuift mee met de container.

Dat is ook meteen het lastigste punt van deze kaart. Op een hero van 390 px
loopt de tekst over de volle breedte en is er geen rechterflank meer om de storm
in te zetten. De aanpak: onder een containerbreedte van ~560 px zakt de storm
naar een liggende band ónder de knoppenrij (waar de referentie de embersleep al
heeft staan) in plaats van een kolom rechts. Dezelfde soort ingreep als de teddy
die op smal naar de hoek zakt, en net als daar wijkt de compositie daar het
meest van de referentie af.

## 6. Het stormartwork: welke bron?

Er zijn twee bronnen en ze sluiten elkaar niet uit.

**A. `storm-master.webp` hergebruiken.** Het master-artwork van de ⚡-FUT-kaart
is 1444 × 1536 met transparante achtergrond: een hoge kolom met de gouden
hoofdontlading rechts en een tweede, koelere sliert links. Op 118 % kaarthoogte
rechts verankerd valt die hoofdkolom precies op de flank van de referentie en de
tweede sliert op de plek waar de referentie zijn losse wolkpartij heeft. Kost
**nul bytes** — het bestand zit al in de bundel — en levert per constructie
pariteit met de FUT-kaart.

Twee bezwaren, allebei eerlijk te noemen:

- de master is blauwgrijs met één gouden ontlading; de referentie is
  goud-dominant met een dicht vertakt web. Het silhouet klopt, de temperatuur
  niet;
- `STORM_MASTER_SPEC.md` legt vast dat het canvas als één ondeelbaar artwork
  wordt gebruikt en dat wolken en bliksem niet als losse browserassets mogen
  worden geëxporteerd. Hergebruik als hele kolom is daarmee in orde; wil je er
  losse onderdelen uit snijden (embersleep!), dan hoort er een zin bij die die
  regel tot de FUT-kaart beperkt — zoals de Big Daddy zijn onderdelenblad ook
  met het dashboard is gaan delen.

**B. Een eigen kolom uit de referentie snijden.** De storm staat op vrijwel zwart
en is dus met een luminantiekey vrij te stellen — precies het regime van
`pias-master.py` en `piet-master.py`, en makkelijker dan de Glazenwasser en de
slof, die tegen een lokaal gefit achtergrondmodel moesten werken. Levert exact de
referentie, kost naar schatting 100–150 kB. `dist/assets` staat na de Big Daddy
op 10,14 van de 11 MB, dus dat past — met minder lucht dan prettig is.

**Het is B geworden.** De composietproef met de FUT-master (118 % hoogte, rechts
verankerd) klopte op silhouet, maar niet op temperatuur: naast een kaart die
verder alleen zwart en champagnegoud draagt leest die master als een blauwe wolk.
`scripts/inform-dashboard-onderdelen.py` snijdt daarom twee onderdelen uit de
referentie zelf. Wat dat oplevert is per constructie identiek aan de referentie
zodra het weer op zwart landt — en dat is precies waar het naartoe gaat, want het
kaartvlak ís #0d0d10.

Wat níét mag: de kleur van de FUT-master met `filter: sepia()`/`hue-rotate()`
goedpraten. Dat vergrijst de bliksemkern en maakt het verschil met de FUT-kaart
juist zichtbaar. `STORM_MASTER_SPEC.md` blijft dus gelden zoals hij is; er is geen
regel bijgekomen, want er wordt niets uit die master geëxporteerd.

**Het racket** is geen onderdeel geworden. Het is in de referentie donkerder dan
de storm eromheen, dus de luminantiekey maakt het transparant — en op het zwarte
kaartvlak leest dat gat als het silhouet. Eén asset minder, en het kan per
constructie niet uit registratie lopen met de wolk eromheen. De vectorroute
(`divisies/goud.ts` tekent hetzelfde racket al voor crest, medaillon en
watermerk) bleef daarmee ongebruikt.

## 7. Wat er staat

### Vlak en lijst

- `heroThema.ts` — `heroLijstProfiel(permanent, overlay)` is de regel uit §4 op
  één plek, en `heroKlassen` hangt er `hero--lijst-inform` aan. Big Daddy heeft
  aan `.hero--bigdaddy` genoeg; In-Form heeft een tweede klasse nodig omdat
  `.hero--overlay-inform` ook de inkt zet die hij met niemand deelt, en omdat zijn
  materiaalblok het permanente thema in de cascade moet verslaan — het staat
  daarvoor ná de vijf themablokken in het bestand;
- `HeroLijst.tsx` bleef ongewijzigd, maar zijn geometrie in `DashboardHero.css`
  is generiek geworden: de vier vlakken lezen nu `--lijst-rail-d`,
  `--lijst-band-d` en `--lijst-key-d`, en het materiaal staat per thema. Zonder
  die stap had de tweede kaart alle vier de vlakken moeten overschrijven om van
  de Big Daddy-kleuren af te komen;
- `HeroLagen.tsx` mount de lijst voor beide profielen en zet de In-Form-decoratie
  ín het vlak. De tint blijft daar weg: dat vlak is al het zwart van de
  referentie, en een tweede donkere laag haalt de storm er weer uit;
- `DashboardHero.css` — het materiaalblok: goudrail, zwarte band, gouden keyline
  met chamfer, en het vlak met een gouden gloed rechtsboven. Plus het
  token-eiland (`--surface`, `--ink`, `--accent`, `--success`, `--danger`), de
  achthoekige knopplaten, de dubbele goudring om de profielfoto, de gouden
  haarlijn als scheiding, de eyebrow-lijn en de naam in zilververloop;
- twee tests in `DashboardHero.test.tsx` en vier in `heroThema.test.ts`: de vier
  vlakken zitten écht in elkaar, het artwork hangt ín het vlak, de diktes rekenen
  in `cqw`, de achthoek zit op de keyline en niet op de buitenrand, en een kaart
  mét permanent thema krijgt géén lijst en géén storm.

### Het artwork

- `scripts/inform-dashboard-onderdelen.py` snijdt twee onderdelen uit
  `in_form_dashboard.png`: de stormkolom van de rechterflank en de vonkensleep in
  de linkeronderhoek. Samen 317 kB; `dist/assets` komt daarmee op 10,58 van de
  11 MB uit `assetBudget.test.ts`;
- `InformDecor.tsx` rendert ze als losse `<img>`'s met `decoding="sync"`;
  `DashboardHero.css` verankert ze aan één rand en geeft de stormkolom een tweede
  uitdoving links — die hangt aan de kaartbreedte in plaats van aan het bestand
  en schuift dus mee als de kaart smaller wordt;
- onder 560 px containerbreedte zakt de kolom naar een lage band achter de
  knoppenrij (§5), en verdwijnt de vonkensleep.

### De ornamenten van het permanente thema

Die blijven staan (§4) en hoefden daarvoor niets: ze hangen in
`hero__lagen--voor`, buiten het vlak, en de enige die ín het vlak zit — de
satijnwikkel die bij Big Daddy achter de lijst door weeft — rekent tegen
`--lijst-d`, en die levert In-Form net zo goed. Eén regel moest wél weg:
`.hero--bigdaddy.hero--overlay-inform .hero__coach` maakte de roze spreekcapsule
donker onder de oude tint, en zou met zijn hogere specificiteit nu juist de
zwarte capsule van In-Form overschrijven. De On-Fire-helft van die regel blijft.

### De crest

`informSchild()` in `ornamentenInform.ts` tekent de schildplaat, en
`InformSchildCrest` zet de bestaande bliksemglyph erop. Twee maten uit dezelfde
functie zijn de gouden rand en de donkere kern, dus die rand kan niet ongelijk
worden. De kale glyph blijft staan voor In-Form boven een permanent thema: daar
is de crest een accent op andermans kaart en moet hij dun zijn.

Checkpoints staan in [`../../screenshots/hero`](../../screenshots/hero):
`inform-v1-vlak-en-lijst.png`, `inform-v1-donker.png` en `inform-v1-mobiel.png`.

### Drie dingen die tijdens het snijden omvielen

**Een knockout die niet tot nul komt, is een spookbeeld.** De kaartinhoud staat
op hetzelfde zwart als de storm en heeft dezelfde luminantie, dus de key alleen
haalt hem er niet uit. De chips en de coachcapsule worden daarom met een
uitgeveerde knockout weggehaald — maar met een blur van 26 px op een capsule van
92 px hoog kwam het midden niet verder dan 0,07, en dan staat er nog steeds
leesbare tekst in de wolk. De veer hoort klein te zijn ten opzichte van wat er
wordt weggehaald.

**Unpremultiply moet een vloer hebben.** Deel je de kleur door de kale alfa, dan
krijgt een pixel die de knockout net heeft weggehaald — kaartinhoud, dus helder —
een kleur van 255 mee. Onzichtbaar zolang die alfa 0 blijft, maar het schalen
middelt straight-alpha RGBA en trekt dat wit de halfdoorzichtige buren in. De
coachcapsule kwam zo als lichte tekst terug in een wolk waar hij al uit gesneden
was. Vloer op 0,15, en schalen premultiplied.

**De chamfer is geen rechthoek.** De eerste snee liep tot de binnenrand van de
keyline en had daarmee de diagonaal van de rechterbovenhoek erin — een streep
goud middenin het artwork. Een uitsnede tegen een niet-rechthoekige rand heeft een
veelhoek-knockout nodig, niet een kleinere rechthoek.

### Twee keuzes met een reden

**Hetzelfde zwart in beide thema's.** Zoals de Dictator en de Big Daddy. Het
contrast wordt daarmee deterministisch en het artwork hoeft niet te inverteren.

**Geen voorlaag.** De referentie houdt het goud over de volle hoogte
ononderbroken; de storm eindigt exact op de keyline. Daarmee vervalt de hele
front-occlusie van de ⚡-FUT-kaart — geen `storm-front-mask.svg`-equivalent, geen
contactschaduw, geen derde registratie.

## 8. Wat er nog komt

**De storm boven een permanent thema.** Nu rendert hij daar niet (§4). Het
alternatief — halve dekking over de tint bij thema's zónder eigen lijst — is een
kleine stap vanaf hier, maar vraagt een eigen oordeel op de showcase: op de
piaskaart moet het kraftkarton herkenbaar blijven.

**On Fire.** `heroLijstProfiel` geeft alleen In-Form een eigen profiel, omdat er
één referentieontwerp per kaart is en dat van 🔥 er nog niet is. De structuur
staat er wel: een tweede tak in die functie en een materiaalblok ernaast.

**Het navy van de ⚡-editie is rechtgezet.** De dunne variant (In-Form boven een
permanent thema) tintte navy (`#1b2235`), en `futKaartCanvas.test.ts` bindt die
drie stops aan de vlak-stops van de ⚡-FUT-kaart. Die kaart was dus óók navy —
terwijl beide referenties van deze editie neutraal meten: het kaartvlak van
`referentie_in_form.png` staat op #141616 en dat van de dashboardkaart op
#0d0d10, allebei met een rood-blauwverschil van twee punten waar de code er
zesentwintig had.

De stops zijn daarom geneutraliseerd naar `["#212223", "#111213", "#050607"]`, in
`futKaartCanvas.ts` én in de gelijkluidende gradient in `FutKaart.css`. Bewust
alléén de tint: per stop is de relatieve luminantie gelijk gebleven, dus de
belichting van de kaart verandert niet — alleen de blauwzweem verdwijnt. Op de
piaskaart is dat meteen zichtbaar: het kraftkarton schemert nu als karton door de
tint in plaats van als blauwgrijs, wat AC4 juist bedoelt. De synctest houdt de
kaart en de hero verder aan elkaar vast.

**Pariteit voor het goud.** `--if-goud` (#f2cf7d) is byte-gelijk aan
`--kaart-ink` van de ⚡-kaart, maar niets bewaakt dat. Een regel erbij in dezelfde
synctest zou dat afdekken.

**De smalle kaart.** Onder 560 px wijkt de compositie het meest van de referentie
af — die is nu eenmaal op een breed scherm getekend. De storm ligt daar als band
onder de knoppen in plaats van als kolom op de flank.
