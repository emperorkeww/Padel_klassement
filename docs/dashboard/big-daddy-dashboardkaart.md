# De Big Daddy-dashboardkaart

Dit document beschrijft hoe de dashboard player card van de Big Daddy naar
[`big_daddy_dashboard.png`](big_daddy_dashboard.png) wordt gebracht, en welk
patroon daarvoor uit de FUT-kaarten komt. Het is tegelijk het werkplan: wat af
is staat in §5, wat nog komt in §6.

Het is de derde variant van hetzelfde thema. De twee bestaande zijn:

- [`../fut-kaarten/special-card-visual-effects-architecture.md`](../fut-kaarten/special-card-visual-effects-architecture.md)
  — decoratie die om een generieke kaart heen breekt: één master, drie
  registraties, maskers uit de onderdelen;
- [`../fut-kaarten/divisie-kaartlayouts.md`](../fut-kaarten/divisie-kaartlayouts.md)
  — een kaart met een eigen compositie: losse onderdelen met eigen plek en laag.

De dashboardkaart is geen van beide, en §1 legt uit waarom dat verschil er is.

## 1. Waarom de drie-masterstructuur hier niet past

Die structuur staat of valt bij één gedeelde transform op een doos met een vaste
verhouding (100 : 139). Alle geometrie is dan een fractie van de kaartbox, en
back, inside en front kunnen daarom pixelmatig op elkaar aansluiten.

De dashboardkaart heeft die doos niet. Haar breedte volgt de viewport en haar
hoogte volgt de inhoud: een coachbriefing van twee regels, een titelrij die
wrapt, drie knoppen die op mobiel onder elkaar vallen. Dezelfde kaart is op
desktop 2,1 : 1 en op een telefoon 0,6 : 1. Eén master met
`--*-master-left/top/width` zou daar of vervormen of de compositie uit de hoeken
trekken; "mobiele registratie wijkt af" uit de diagnosetabel is hier geen bug
maar de normale toestand.

Wat wél overkomt zijn drie dingen uit diezelfde docs:

1. **de weeflogica** — decoratie begint in het kaartvlak, verdwijnt achter de
   lijst en komt plaatselijk ervóór, met een stuk lijst zichtbaar ertussen;
2. **losse onderdelen** in plaats van vensters op één master
   (`glazenwasser-onderdelen.py`): elk onderdeel een eigen, strak op zijn alfa
   bijgesneden WebP, los geschaald en geplaatst;
3. **de lijst als geneste vlakken** in plaats van als rand: vier dekkende,
   identiek afgeronde vlakken waarvan het verschil de lijst ís.

## 2. De referentie, opgemeten

`big_daddy_dashboard.png` is 1774 × 887; de kaartbox ligt op x 36…1740 en
y 30…855.

| onderdeel | meting | omgerekend |
| --- | --- | --- |
| goudrail (buitenste band) | 6 px | 0,35 % van de kaartbreedte |
| magenta band | 18 px | 1,05 % |
| gouden keyline | 5 px | 0,30 % |
| matelas-ruit | periode 46 px | 2,6 % |
| kaartvlak | #f7c3d5 links, #fcd8e1 midden, #f9bfd3 rechts | verzadigd satijn |
| band / keyline | #b62b5d / #eba866 | ≈ `#b3145e` / `#e5bd6d` van de 👑-kaart |
| inkt van de naam | #84063d | ≈ `--bigdaddy-kaart-ink` |

Die laatste twee regels zijn het belangrijkste meetresultaat: het materiaal van
de referentie is bijna byte-gelijk aan wat de 👑-FUT-kaart sinds #834 al draagt.
De dashboardkaart hoeft dus geen eigen palet, alleen dezelfde tokens.

Aan voorwerpen draagt de referentie: een gevleugeld hartmedaillon op het midden
van de boven- én onderrand, edelsteenharten in drie hoeken, satijnlint dat langs
de rechterflank door de lijst weeft, een hangend hartjuweel halverwege rechts,
de gekroonde teddy met scepter linksonder en lint langs de onderrand. Allemaal
objecten die al in `bigdaddy-onderdelen.webp` staan — hetzelfde blad waaruit
`bigdaddy-master-compose.mjs` de FUT-kaart samenstelt.

## 3. Laagmodel

`HeroLagen` had twee containers: `hero__lagen` (geklipt, onder de inhoud) en
`hero__lagen--voor` (ongeklipt, boven de inhoud). Er was een derde positie nodig:
de lijst moet *tussen* twee ornamentlagen liggen, anders kan er niets achter
verdwijnen.

```text
hero__lagen (geklipt op de kaartradius)
  1 hero__lijst        goudrail
  2   hero__lijst-band magenta band
  3     hero__lijst-key gouden keyline
  4       hero__vlak   satijn + matelas + hartbokeh + vignet
              ↳ watermerk, confetti en straks de lintmiddenstukken:
                geklipt op de binnenrand, dus per constructie achter de lijst
  inhoud (z-index 1)
hero__lagen--voor (ongeklipt, z-index 2)
  5 hoekedelstenen, teddy, medaillons, lintvoorpassages, hangjuweel
```

Elk vlak is dekkend en ligt ín zijn voorganger; wat je als lijst ziet is het
verschil tussen twee opeenvolgende vlakken. Dat is exact de opbouw van de
FUT-kaart (`.fut-kaart__zijde` > `__liner` > `__keyline` > `__vlak`) en de reden
dat het geen inset-schaduwen kunnen zijn: de buitenste rail is een metaalverloop
en een inset-schaduw draagt geen verloop.

Het vlak is tegelijk het montagepunt voor decoratie die achter de lijst hoort —
de tegenhanger van de inside-layer, die op de kaart het echte
`clip-path: var(--schild)` erft.

## 4. De regel voor een vloeiende doos

Dit is het punt waarop deze kaart anders is dan alles in de kaartdocs, en het
hoort in de code te staan in plaats van in een screenshot:

- **diktes rekenen in `cqw`, niet in procenten.** Een percentage in `inset`
  rekent horizontaal tegen de breedte en verticaal tegen de hoogte; een brede
  kaart zou daardoor een dunnere boven- dan zijrand krijgen. `.hero--bigdaddy`
  is daarom `container-type: inline-size`;
- **elke maat heeft een `clamp()`**. De ondergrens houdt de lijst leesbaar op een
  hero van 320 px, de bovengrens voorkomt dat hij op een breed scherm een kader
  wordt;
- **een onderdeel wordt aan één hoek of één rand verankerd**, nooit met fracties
  op beide assen, en zijn maat rekent tegen de *breedte*. `height: auto` houdt de
  beeldverhouding, dus een opnieuw gesneden asset kan de layout niet uitrekken;
- **randlopers zijn hoekstukken met een uitgeveerde staart**, geen strook die de
  volle rand overspant. Op mobiel is de kaart twee tot drie keer zo hoog als op
  desktop; een gerekt satijnlint valt daar door de mand en een getegelde strook
  vraagt een naadloze tegel die dit artwork niet heeft.

## 5. Wat er staat

### Stap 1 — vlak en lijst

- `HeroLijst.tsx` — de vier geneste vlakken, met het kaartvlak als slot voor
  decoratie die achter de lijst hoort;
- `HeroLagen.tsx` mount hem voor `permanent === "bigdaddy"` en zet de
  achter-ornamenten ín dat vlak in plaats van erbovenop;
- `DashboardHero.css` — het materiaal: rail, band, keyline en het satijn met
  matelas-ruit, hartbokeh en vignet. Plus een **token-eiland** (zelfde aanpak als
  `.hero--pias` en `.hero--piet`): `--surface`, `--ink`, `--accent`, `--success`
  en `--danger` worden binnen de kaart hertekend, zodat knoppen, chips,
  vormbolletjes en tooltips het thema volgen zonder eigen regel. De knoppen zijn
  de platen van de referentie (goud voor de primaire, magenta voor de andere
  twee), de coachregel is een satijnen capsule met een hartje, de profielfoto
  krijgt de dubbele metaalring;
- `scripts/hero-screenshot.sh` — vaste opname van `/dev/hero`, met het thema
  expliciet in de aanroep. Headless Chromium meldt van zichzelf
  `prefers-color-scheme: dark`, en deze kaart moet in beide thema's worden
  beoordeeld;
- twee tests in `DashboardHero.test.tsx`: de vier vlakken zitten écht in elkaar
  en de decoratie zit ín het kaartvlak, de diktes rekenen in `cqw`, en een thema
  zonder eigen profiel krijgt geen lege lijst-spans in zijn DOM.

### Stap 2 — de onderdelen

- `scripts/bigdaddy-dashboard-onderdelen.mjs` snijdt vijf onderdelen uit
  `bigdaddy-onderdelen.webp`: het gevleugelde hartmedaillon, de gekroonde teddy,
  het geslepen hoekhart (de topfleur van de kroon), de satijnwikkel van de
  rechterflank en de lintsleep langs de onderrand. Samen 150 kB; `dist/assets`
  komt daarmee op 10,14 van de 11 MB;
- elk onderdeel wordt ná veer en masker **strak op zijn alfa bijgesneden** en
  krijgt een regel in `onderdelen.json`. `BigDaddyDecor.tsx` rendert ze als losse
  `<img>`'s; `DashboardHero.css` verankert ze aan één hoek of rand;
- het flanklint wordt twee keer gerenderd uit dezelfde bron en op hetzelfde
  anker: één keer in het kaartvlak (geklipt op de binnenrand, dus achter de
  lijst) en één keer in de voorlaag met een maskergradient die het middenstuk
  weglaat. Op de lijst zie je hem daardoor boven én achter het goud door lopen;
- de oude vector-ornamenten (`heroOrnamentenBigDaddy.tsx`: kroon-crest,
  ballonnen, lintkrullen, confetti) en het kroonwatermerk zijn weg. Anders dan
  bij de FUT-kaarten blijven ze ook niet als fallback staan: er is voor de hero
  geen canvas-/posterroute die ze nog tekent.

Checkpoints staan in [`../../screenshots/hero`](../../screenshots/hero):
`bigdaddy-v0-baseline.png` (de kaart vóór dit alles),
`bigdaddy-v1-vlak-en-lijst.png`, `bigdaddy-v1-donker.png`,
`bigdaddy-v1-mobiel.png`, `bigdaddy-v2-onderdelen.png`,
`bigdaddy-v2-mobiel.png` en `bigdaddy-v2-inform-overlay.png`.

### Vier dingen die tijdens stap 2 omvielen

**Een overlay hoort ín het vlak.** Met een In-Form of On Fire erover dekte de
tintlaag de hele lijst af: van het goud-magenta profiel was niets meer over, en
dan is de permanente kaart precies zo onzichtbaar als #771 wilde voorkomen. Bij
een thema met eigen lijst gaan tint, groeven en glans daarom mee ín `hero__vlak`.
Wat op dat oppervlak drijft, verdonkert mee — vandaar de aparte regel voor de
spreekcapsule van de coach.

**Een snee mag zijn buurman niet meenemen.** De eerste bodemsleep bevatte een
teddypoot en een stuk medaillonvleugel; die kwamen als spookkopie terug in de
hoek. Dezelfde regel als bij de Glazenwasser: een onderdeel dat zelf al een asset
is, hoort niet in de uitsnede van een ander.

**Een lus is geen sleep.** De eerste bodemsnee was ongeveer even hoog als breed
en werd op een kaart van 2 : 1 een torentje in de hoek. De vlakke passage
onderaan het blad doet wat de referentie doet.

**Driemaal hetzelfde juweel is een patroon.** De referentie hangt halverwege de
rechterflank nog een hartje, maar dat is dáár een ánder, vlakker juweel. Met een
derde kopie van dezelfde gouden zetting las de flank als een herhaling; die plek
blijft leeg tot er een eigen snee voor is.

### Twee keuzes met een reden

**Hetzelfde roze in beide thema's.** Zoals de Dictator in beide thema's donker
is. Het contrast wordt daarmee deterministisch en de decoratie hoeft niet te
inverteren — een geïnverteerd roségouden ornament wordt groen.

**De vlakstops zijn lichter dan op de FUT-kaart.** Op de kaart staat korte,
grote inkt; hier staat een hele coachregel. Op de ongunstigste plek van het vlak
(onderste stop mét vignet, #eeb7cf) haalt `--bd-ink` 5,4:1, `--bd-ink-soft`
5,0:1 en `--accent` 4,8:1. Dezelfde afweging als bij de Kampioen-hero, waar
`futKaartCanvas.test.ts` de afwijking al expliciet vastlegt.

## 6. Wat er nog komt

**De teddy op een smalle kaart.** Onder een containerbreedte van 560 px zakt hij
naar de hoek en hangt hij er grotendeels buiten, want daar staan de drie knoppen
onder elkaar over de volle breedte. Dat werkt, maar het is de plek waar de
compositie het meest van de referentie afwijkt — die is nu eenmaal op een breed
scherm getekend.

**Het hangjuweel aan de rechterflank.** Zie hierboven: het vraagt een eigen snee,
en die zit niet in het onderdelenblad. De referentie zelf is de tweede bron, maar
die staat op licht grijs — de luminantiekey van de Piet en de pias werkt daar
niet. Het is dan de slof-variant: het *absolute* verschil tegen een lokaal gefit
achtergrondmodel.

**Pariteit met de kaartenwand.** De FUT-kaart en deze kaart delen nu materiaal en
onderdelenblad, maar niemand bewaakt dat ze niet uit elkaar lopen. De synctest in
`futKaartCanvas.test.ts` doet dat al voor de Kampioen-, In-Form- en
On-Fire-stops; een regel erbij voor het icon-register zou hetzelfde doen voor
deze kaart.

**De andere drie referenties.** In-Form, pias en Zwarte Piet staan als ontwerp al
in deze map. `HeroLijst` is daarom niet Big Daddy-specifiek: het thema levert
alleen het materiaal en de diktes, en `eigenLijst` in `HeroLagen` is de enige
plek die weet wie er een profiel heeft. Wie de volgende oppakt, hoeft §3 en §4
niet opnieuw te bedenken — en kan het snijscript kopiëren met een andere
sneelijst.

## 7. Budget en laadgedrag

De onderdelen zijn samen 150 kB en landen in `dist/assets`, dat daarmee op
10,14 van de 11 MB van `assetBudget.test.ts` staat. Ze worden alleen opgehaald
door de speler die het thema draagt — dat is er per club precies één, want dit is
de kaart van de nummer één.

`decoding="sync"` op elk onderdeel is geen detail: op de headless screenshotroute
blijft een async gedecodeerde WebP leeg, en dan lijkt een ontbrekend onderdeel op
een z-index-fout.
