# Special Card Visual Effects Architecture

Dit document beschrijft de daadwerkelijk geïmplementeerde architectuur van
het In-Form-stormeffect en de daarop gebaseerde On Fire-, Dictator-, Big
Daddy-, Piet-, pias-, GOAT- en Wannabe-breakouts. Het is tegelijk een technische
naslag en een herbruikbare blauwdruk voor special cards waarvan decoratie niet
alleen ín de kaart staat, maar ook achter de kaart verdwijnt en plaatselijk vóór
het frame komt.

De kern van de oplossing is eenvoudig: één coherent storm-artwork wordt drie
keer op exact dezelfde coördinaten gerenderd. Alleen de clipping en de
laagpositie verschillen. Daardoor lopen wolk, rook, licht en bliksem
pixelmatig door van het kaartvlak naar de breakout buiten de kaart.

Belangrijkste implementatiebestanden:

- [`FutKaart.tsx`](../src/features/rating/components/FutKaart.tsx) — biedt de
  drie montagepunten rond en in de bestaande kaartstructuur.
- [`InformStorm.tsx`](../src/features/rating/components/storm/InformStorm.tsx)
  — rendert de drie instanties van dezelfde bron.
- [`InformStorm.css`](../src/features/rating/components/storm/InformStorm.css)
  — gedeelde registratie, z-index, clipping, frontmask en contactschaduw.
- [`storm-master.webp`](../src/features/rating/components/storm/assets/in-form/storm-master.webp)
  — het transparante master-artwork.
- [`storm-front-mask.svg`](../src/features/rating/components/storm/assets/in-form/storm-front-mask.svg)
  — selecteert de twee lokale voorgrondocclusies.
- [`STORM_MASTER_SPEC.md`](../src/features/rating/components/storm/STORM_MASTER_SPEC.md)
  en [`MANIFEST.md`](../src/features/rating/components/storm/MANIFEST.md) —
  het assetcontract en de actuele registratie.
- [`OnfireEffect.tsx`](../src/features/rating/components/onfire/OnfireEffect.tsx)
  en [`OnfireEffect.css`](../src/features/rating/components/onfire/OnfireEffect.css)
  — dezelfde architectuur toegepast op lava, vulkaan en rook.
- [`ASSET_SPEC.md`](../src/features/rating/components/onfire/ASSET_SPEC.md) —
  het actuele On Fire-assetcontract.
- [`DictatorEffect.tsx`](../src/features/rating/components/dictator/DictatorEffect.tsx)
  en [`DictatorEffect.css`](../src/features/rating/components/dictator/DictatorEffect.css)
  — dezelfde architectuur toegepast op vaandels, regimegloed, tank en
  ceremonieel lint.
- [`BigDaddyEffect.tsx`](../src/features/rating/components/bigdaddy/BigDaddyEffect.tsx)
  en [`BigDaddyEffect.css`](../src/features/rating/components/bigdaddy/BigDaddyEffect.css)
  — dezelfde architectuur toegepast op kroon, wolken, ballonnen, pluchen
  figuren, linten en een gevleugeld hartmedaillon.
- [`bigdaddy-master-compose.mjs`](../scripts/bigdaddy-master-compose.mjs) — de
  eerste editie waarvan master én beide maskers uit één reproduceerbaar script
  komen, gemeten aan de referentie.
- [`PiasEffect.tsx`](../src/features/rating/components/pias/PiasEffect.tsx),
  [`PiasEffect.css`](../src/features/rating/components/pias/PiasEffect.css) en
  [`scripts/pias-master.py`](../scripts/pias-master.py) — dezelfde architectuur
  toegepast op narrenkroon, speelkaarten, lint, rozet, narrenkop en bagel, met
  een master die uit de referentie zelf wordt gesneden.
- [`GoatEffect.tsx`](../src/features/rating/components/goat/GoatEffect.tsx),
  [`GoatEffect.css`](../src/features/rating/components/goat/GoatEffect.css) en
  [`scripts/goat-master.py`](../scripts/goat-master.py) — dezelfde architectuur
  toegepast op bokhoorns, geitenmonument, kristalclusters, bergscene en
  edelsteen-chevron, met een master die uit de referentie zelf wordt gesneden.
- [`WannabeEffect.tsx`](../src/features/rating/components/wannabe/WannabeEffect.tsx),
  [`WannabeEffect.css`](../src/features/rating/components/wannabe/WannabeEffect.css)
  en [`scripts/wannabe-master.py`](../scripts/wannabe-master.py) — dezelfde
  architectuur toegepast op racketcrest, megafoonmedaillon, plakstroken,
  briefjes, stiftkroontjes en inktdruipers; de eerste referentie die op wit
  staat in plaats van op zwart.

## 1. Context en visueel doel

De In-Form-kaart stelt een speler voor die in de afgelopen zeven dagen de
grootste ratingwinst behaalde. Het stormthema vertaalt die tijdelijke
vormpiek naar een donkere donderwolk, goud-witte bliksem en plaatselijke
amberkleurige verlichting. Het effect moet energiek en uitzonderlijk
aanvoelen, zonder de rating, avatar, naam of editie-informatie te
overschilderen.

De oorspronkelijke visuele referentie staat in
[`referentie_in_form.png`](./referentie_in_form.png). De compacte
beginsituatie staat in [`implementatie.png`](./implementatie.png).

Een breakout-effect werkt alleen wanneer het oog één doorlopende massa kan
volgen:

1. de storm begint zichtbaar in het rechterdeel van het kaartvlak;
2. een ander deel ligt achter het gouden frame;
3. de massa loopt breed buiten de rechterrand door;
4. twee geselecteerde wolkdelen liggen vóór het frame.

Een wolk die uitsluitend naast de kaart staat, blijft decoratie rondom een
kaart. Een wolk die binnen, achter en vóór hetzelfde frame wordt gelezen,
lijkt uit de kaart te komen. Occlusie is hier dus geen technisch detail, maar
het voornaamste dieptesignaal.

## 2. Oorspronkelijke problemen

### Losse zij-effecten

De eerste composities gebruikten losse wolk- en bliksemelementen aan de
rechterzijde. Omdat die elementen niet als één volume door het kaartvlak
liepen, voelden ze aangeplakt. De bliksem en wolk hadden bovendien niet
altijd dezelfde visuele taal.

### Een verticale rij bolwolken

De vroege wolk was herkenbaar opgebouwd uit afzonderlijke ronde vormen. Een
regelmatige reeks cirkels leest als een illustratieve kralenketting, niet als
een zware cumulonimbus. Herhaling in schaal, afstand en contour maakte de
constructie zichtbaar.

### Te weinig massa in het kaartvlak

Wanneer alleen een rokerige texture of glow binnen het schild zichtbaar was,
bleef de grote wolk buiten de kaart staan. Daardoor ontbrak het beginpunt van
de storm. De interne massa moest een donkere kern, volumetrische lobben en
zachte randen krijgen, terwijl de kaartinhoud leesbaar bleef.

### De volledige wolk achter het frame

Een technisch correcte back- en inside-layer was niet genoeg. Als de gouden
rand overal boven de storm bleef liggen, leek de wolk achter de kaart
geplakt. Minstens twee beperkte front-occlusies waren nodig om het frame
plaatselijk door de storm te laten verdwijnen.

### Een geometrisch onderbroken frame

Een frame mag alleen verdwijnen waar een zichtbare wolk het bedekt. Te kleine
of te harde maskers lieten rechte uiteinden van het frame zien, alsof er
stukken met een rechthoek waren weggeknipt. Organische maskerpaden,
halftransparante wolkranden en een lokale contactschaduw lossen dat op.

### Bliksem als elektrische border

Wanneer de hoofdbliksem te dicht langs de rechterrand loopt, volgt het oog de
kaartcontour in plaats van het wolkvolume. Het resultaat lijkt op een
decoratieve neonrand. Het huidige traject loopt diagonaal door de massa en
ondersteunt de vorm van de wolk. Er is bewust geen tweede dominante
ontlading.

### Te veel CSS-effect, te weinig coherent artwork

Losse gradients, cirkels, glows en filters kunnen rook suggereren, maar
leverden geen overtuigende volumetrische storm op. CSS bleef wel nuttig voor
registratie, lokale schaduw en clipping; de inhoudelijke wolkvorm verhuisde
naar één transparant rasterartwork.

### Effecten van naburige carouselkaarten

De kaart zelf gebruikt `overflow: visible`, omdat de storm buiten het schild
moet kunnen komen. Zonder begrenzing op de carousel-cell kan zo'n breakout
over een buurkaart schilderen. Dat leidt af van de actieve kaart en maakt
z-indexgedrag tussen slides onvoorspelbaar.

### Horizontale overflow en onverwachte clipping

Een grote externe wolk kan de documentbreedte vergroten of door een
onbedoelde ancestor worden afgesneden. De oplossing is niet om de kaart zelf
te clippen: de kaart moet lokaal `overflow: visible` houden. De begrenzing
hoort op de omliggende presentatie- of carousel-cell.

### Afgesneden of vervuilde kaartinformatie

Een algemene grijze/blauwe waas verlaagt het contrast van rating, avatar en
naam. De binnenlaag staat daarom onder de kaartinhoud en de frontlaag toont
alleen twee kleine gebieden langs de rechterrand. Leesbaarheid wordt door
laagpositie én door art direction beschermd.

## 3. Iteratieve ontwikkeling

De repository bevat de visuele checkpoints onder
[`screenshots/storm/`](../screenshots/storm/). De bestandsnamen zijn de
feitelijke ontwikkelvolgorde; niet iedere tussenstap was bedoeld als
productie-eindbeeld.

| Iteratie | Probleem | Aanpassing | Resultaat | Screenshot |
| --- | --- | --- | --- | --- |
| Beginsituatie | Compact zij-effect; ronde wolksegmenten; bliksem leest los van de kaart | Vast referentie- en implementatiebeeld als vergelijkingsbasis | Verschil in massa, schaal en overlap werd meetbaar | [`implementatie.png`](./implementatie.png), [`referentie_in_form.png`](./referentie_in_form.png) |
| Baseline | Storm staat vooral naast de kaart | Reproduceerbare dev-stage en vaste desktopviewport | Betrouwbaar startpunt voor visuele vergelijking | [`baseline.png`](../screenshots/storm/baseline.png) |
| Eerste iteraties | Ronde wolkenrij en randbliksem blijven dominant | Losse assets herschaald en richting rechterbovenhoek gegroepeerd | Meer activiteit, maar nog geen samenhangende storm | [`iteratie-1.png`](../screenshots/storm/iteratie-1.png), [`iteratie-2.png`](../screenshots/storm/iteratie-2.png), [`iteratie-3.png`](../screenshots/storm/iteratie-3.png) |
| V2 compositie | Te weinig brede massa binnen en buiten de kaart | Back-, inside- en frontrollen explicieter gemaakt; grotere organische compositie | De storm kreeg een duidelijker zwaartepunt rechtsboven/rechtsmidden | [`storm-v2-composition.png`](../screenshots/storm/storm-v2-composition.png) |
| V2 layering | Technische lagen sloten visueel onvoldoende aan | Registratie en clipping afzonderlijk gecontroleerd | Zichtbaar onderscheid tussen binnen-, achter- en voorgebied | [`storm-v2-layering.png`](../screenshots/storm/storm-v2-layering.png), [`storm-v2-registration.png`](../screenshots/storm/storm-v2-registration.png) |
| Gedeeld master-artwork | Afzonderlijke assets weken in vorm en licht van elkaar af | Eén `storm-master.webp` drie keer met dezelfde transform gerenderd | Pixelmatige continuïteit van wolk en bliksem | [`storm-v2-final.png`](../screenshots/storm/storm-v2-final.png) |
| V4 | Storm voelde nog als cluster naast de kaart | De gedeelde compositie verder naar links geplaatst | Interne oorsprong werd duidelijker zonder breakout te verliezen | [`storm-v4-final.png`](../screenshots/storm/storm-v4-final.png) |
| V5 | Hoofdwolk was te compact en te smal | Master zichtbaar vergroot; interne en externe massa verbreed | Meer donkere kernen en een zwaardere rechtercluster | [`storm-v5-final.png`](../screenshots/storm/storm-v5-final.png) |
| V6 | Gouden frame bleef te consequent vóór de wolk | Frontmask uitgebreid naar twee lokale occlusies | De storm breekt aantoonbaar vóór het rechterframe | [`storm-v6-front-occlusion.png`](../screenshots/storm/storm-v6-front-occlusion.png) |
| V8 volume | Wolk bleef verticaal te compact | Master vervangen door een 2:3-artwork met nieuwe boven- en ondermassa; gedeelde transform bijgesteld | Eén doorlopende stormkolom boven, naast en tot aan de rechteronderhoek | [`storm-v8-vertical-volume.png`](../screenshots/storm/storm-v8-vertical-volume.png) |
| V8 frame | Frameonderbrekingen waren lokaal nog te abrupt | Organisch frontmask en kleine, maskergebonden contactschaduw | Bovenste en middelste wolklob bedekken de frame-einden natuurlijk | [`storm-v8-frame-occlusion.png`](../screenshots/storm/storm-v8-frame-occlusion.png) |
| V8 eindcontrole | Desktop alleen is onvoldoende bewijs voor responsiviteit | Dezelfde implementatie op vaste desktop- en mobiele viewport vastgelegd | Breakout, leesbaarheid en registratie blijven bij schalen behouden | [`storm-v8-final.png`](../screenshots/storm/storm-v8-final.png), [`storm-v8-mobile.png`](../screenshots/storm/storm-v8-mobile.png) |

De belangrijkste ontwikkelles is dat schaal en positie pas betrouwbaar
kunnen worden beoordeeld nadat de lagen dezelfde bron en hetzelfde
coördinatenstelsel gebruiken. Daarvóór kan iedere losse correctie een nieuwe
naad tussen wolk, glow en bliksem introduceren.

## 4. Definitieve architectuur

### 4.1 Montagepunten in `FutKaart`

De bestaande `FutKaart`-architectuur is behouden. Alleen voor
`editie === "inform"` worden drie stormcomponenten in bestaande
laagposities gemonteerd. De relevante structuur is:

```tsx
<div className="fut-kaart__flipper">
  {editie === "inform" && <InformStormAchter />}

  <div className="fut-kaart__zijde fut-kaart__zijde--voor">
    <span className="fut-kaart__liner">
      <span className="fut-kaart__keyline">
        <span className="fut-kaart__vlak">
          <span className="fut-kaart__randwaas" aria-hidden="true" />
          {motief}
          {glansLaag}
          {editie === "inform" && <InformStormBinnen />}
          {voor}
        </span>
      </span>
    </span>
  </div>

  {/* achterzijde en bestaande voorornamenten */}
  {editie === "inform" && <InformStormVoor />}
</div>
```

Dit codefragment is ingekort, maar de relatieve DOM-volgorde komt overeen met
de implementatie in `FutKaart.tsx`.

### 4.2 Eén component, drie rollen

`InformStorm.tsx` importeert maar één beeldbron:

```tsx
import stormMaster from "./assets/in-form/storm-master.webp";

type StormLaag = "achter" | "binnen" | "voor";

function StormMaster({ laag }: { laag: StormLaag }) {
  return (
    <span
      className={`inform-storm inform-storm--${laag}`}
      data-laag={laag}
      aria-hidden="true"
    >
      <span className="inform-storm__master" data-naam="storm-master.webp">
        <img
          src={stormMaster}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
        />
      </span>
    </span>
  );
}
```

`InformStormAchter`, `InformStormBinnen` en `InformStormVoor` zijn dunne
wrappers rond deze functie. Daardoor kunnen de drie instanties niet
ongemerkt verschillende bronbestanden krijgen.

De lagen zijn decoratief:

- `aria-hidden="true"` op de wrapper en `alt=""` op het beeld houden ze uit
  de accessibility tree;
- `pointer-events: none` voorkomt dat ze kaartinteractie blokkeren;
- `draggable={false}` voorkomt een ongewenste browser-drag;
- `loading="eager"` voorkomt dat een visueel essentieel deel van de kaart
  later inspringt.

### 4.3 Laagdiagram

De hoofdvolgorde in de flipper is:

```text
z-index 5   stormFrontLayer
            - alleen twee organische maskerdelen
            - lokale contactschaduw
            - vóór geselecteerde stukken van het frame

z-index 2   bestaande frontornamenten

z-index 1   card side
            - gouden frame
            - liner
            - keyline
            - card interior (.fut-kaart__vlak)
                content wordt na stormInsideLayer gerenderd
                stormInsideLayer: z-index -1, geclipt door var(--schild)

z-index 0   stormBackLayer
            - volledige master
            - alleen zichtbaar waar de kaart hem niet bedekt
```

De inside-layer staat in een geneste context. Daarom is het diagram geen
enkele globale stapel: de inside-layer leeft binnen
`.fut-kaart__vlak`, terwijl back en front siblings van de kaartzijde zijn.

### 4.4 Verantwoordelijkheid per laag

**Back layer**

- rendert de volledige master;
- staat op `z-index: 0`;
- levert de wolk boven en rechts buiten de kaart;
- verdwijnt vanzelf achter de kaartzijde, zonder een apart achter-masker.

**Inside layer**

- is een kind van `.fut-kaart__vlak`;
- staat daar op `z-index: -1`;
- wordt door het bestaande `clip-path: var(--schild)` begrensd;
- staat onder `{voor}`, waardoor rating, avatar, naam en kaartteksten
  leesbaar blijven.

**Card layer**

- bestaat ongewijzigd uit frame, liner, keyline en vlak;
- heeft voor de In-Form-voorkant expliciet `position: relative` en
  `z-index: 1`;
- blijft de bron van de actuele kaartvorm en framegeometrie.

**Front layer**

- staat op `z-index: 5`;
- rendert dezelfde master met hetzelfde register;
- gebruikt `storm-front-mask.svg` om alleen een bovenste en middelste
  wolklob door te laten;
- gebruikt een kleine `drop-shadow()` na masking als lokale contactschaduw.

Er is geen aparte geknipte frame-afbeelding. Het echte frame blijft intact;
de voorste wolkpixels bedekken het lokaal. Daardoor ontstaan geen
geometrische frame-einden.

## 5. Gedeeld coördinatenstelsel

Alle stormgeometrie komt uit vijf custom properties op de In-Form-kaart:

```css
.fut-kaart.fut-kaart--inform {
  --storm-master-left: -20%;
  --storm-master-top: -16%;
  --storm-master-width: 155%;
  --storm-master-scale: 1;
  --storm-master-rotate: 0deg;
}

.inform-storm__master {
  left: var(--storm-master-left);
  top: var(--storm-master-top);
  width: var(--storm-master-width);
  transform:
    rotate(var(--storm-master-rotate))
    scale(var(--storm-master-scale));
  transform-origin: 0 0;
}
```

Back, inside en front krijgen bewust geen eigen `left`, `top`, `width`,
`scale` of `rotate`. Een afwijking van enkele pixels zou al zichtbaar zijn
als een versprongen bliksem, dubbele wolkrand of lichtnaad ter hoogte van het
frame.

De percentages worden berekend ten opzichte van dezelfde kaartstage. De
master is 1444 × 1536 pixels en bevat 420 pixels extra compositieruimte links.
De oorspronkelijke rechterstorm begint daar op x=420 en behoudt daardoor bij
`width: 155%` dezelfde visuele schaal en positie als de vroegere
1024px-master. De extra ruimte draagt alleen de secundaire lage wolk en dunne
bliksemvertakkingen aan de linkerzijde.

### Compensatie van de interne insets

De inside-layer wordt pas binnen frame, liner en keyline gemonteerd. Zijn
lokale doos zou daarom kleiner zijn dan die van back en front. De CSS telt de
drie bestaande randdiktes op:

```css
--storm-master-inset: calc(
  var(--kaart-frame-dikte, 3px) +
  var(--kaart-liner-dikte, 1.5px) +
  var(--kaart-keyline-dikte, 1px)
);

.inform-storm--binnen {
  inset: calc(-1 * var(--storm-master-inset));
}
```

Die negatieve inset brengt de inside-instantie terug naar het
coördinatenstelsel van de volledige kaart. Dit is het registratiedetail dat
de drie kopieën pixelmatig laat aansluiten.

## 6. Artwork en assetcontract

### 6.1 Master-artwork

Het productie-artwork staat in
`src/features/rating/components/storm/assets/in-form/storm-master.webp`.
De actuele eigenschappen zijn:

- 1444 × 1536 pixels;
- transparante compositieruimte links naast de oorspronkelijke 2:3-storm;
- sRGB WebP met transparant alpha-kanaal;
- één samenhangende verticale stormkolom;
- bijna zwarte en donkergrijze kernen met beperkt koelblauw;
- transparante rookranden;
- één goud-wit hoofdbliksemtraject met kleine vertakkingen;
- amberkleurige verlichting alleen rond de ontlading;
- geen kaart, frame, tekst of rechthoekige achtergrond in het beeld.

Het artwork bevat bewust wolk, rook, licht en bliksem in één bron. Dat
behoudt de interne lichtlogica wanneer dezelfde storm op drie verschillende
dieptes wordt getoond.

De reproduceerbare art direction en aanbevolen productieresolutie staan in
`STORM_MASTER_SPEC.md`. Het bronbestand is tijdens de laatste iteratie uit
een chroma-keybeeld vrijgesteld en naar transparante WebP verwerkt. Dat
proces is geen runtime-afhankelijkheid; de browser ontvangt alleen de
afgewerkte WebP.

### 6.2 Frontmask

`storm-front-mask.svg` gebruikt dezelfde `viewBox="0 0 1444 1536"` als de
master. Het bevat twee organische, licht vervaagde witte paden:

- een brede bovenlob rond de gebogen rechterbovenrand;
- een kleinere middenlob rond het rechterframe.

Zwart is volledig verborgen, wit zichtbaar en de blur levert een
rookachtige overgang. Tussen beide maskerdelen blijft een kort stuk gouden
frame zichtbaar. Dat maakt de volgorde achter → voor → achter visueel
leesbaar.

De CSS biedt zowel `-webkit-mask` als de standaard `mask`:

```css
.inform-storm--voor .inform-storm__master {
  -webkit-mask:
    url("./assets/in-form/storm-front-mask.svg")
    center / 100% 100% no-repeat;
  mask:
    url("./assets/in-form/storm-front-mask.svg")
    center / 100% 100% no-repeat;
}
```

Een belangrijk detail: het mask zit op `.inform-storm__master`, niet op een
los getekende voorgrondwolk. De doorgelaten pixels blijven daardoor exact
dezelfde pixels als in back en inside.

### 6.3 Geen statisch interior-mask

Er bestaat in de huidige implementatie geen
`card-interior-mask.svg`. De inside-layer gebruikt de werkelijke
`.fut-kaart__vlak` en dus de actuele `clip-path: var(--schild)`. Dat heeft
twee voordelen:

- de storm volgt exact dezelfde kaartvorm als frame en inhoud;
- varianten van `--schild` blijven automatisch ondersteund.

Een apart SVG-masker zou een tweede bron van waarheid voor de kaartvorm
introduceren.

### 6.4 Legacy-assets

In `components/storm/assets/` staan nog oudere losse SVG-assets, waaronder
`storm-cloud-back-right.svg`, `storm-cloud-inside-right.svg`,
`storm-cloud-front-right.svg`, `storm-cloud-bottom-left.svg`,
`lightning-back-right.svg`, `lightning-front-right.svg`,
`storm-glow-right.svg`, `storm-debris.svg` en `storm-sparks.svg`.

Deze bestanden worden niet meer door `InformStorm.tsx` geïmporteerd. Ze zijn
historisch/experimenteel materiaal en mogen niet als de actuele
browserarchitectuur worden beschouwd. Een toekomstige opschoning kan ze
verwijderen zodra is vastgesteld dat geen ander build- of ontwerptraject ze
nodig heeft.

## 7. Clipping, masking en natuurlijke frame-overlap

De kaartbasis is opgebouwd uit vier geneste, identiek geclipte lagen:

```text
.fut-kaart__zijde   frame
  .fut-kaart__liner donkere binnenrand
    .fut-kaart__keyline lichte haarlijn
      .fut-kaart__vlak kaartinterieur
```

Iedere laag gebruikt `clip-path: var(--schild)`. De rand is dus geen CSS
`border`, maar het zichtbare verschil tussen opeenvolgende geclipte
achtergronden en paddings.

Dat bepaalt de stormstrategie:

- de back-layer hoort buiten deze keten en kan achter het volledige schild
  verdwijnen;
- de inside-layer hoort in `.fut-kaart__vlak` en erft zijn exacte clip;
- de front-layer hoort na de kaartzijde en kan vóór het echte frame
  schilderen.

### Contactschaduw

De voorste master krijgt na masking deze lokale schaduw:

```css
filter: drop-shadow(
  calc(var(--fut-kw) * -0.014)
  calc(var(--fut-kw) * 0.008)
  calc(var(--fut-kw) * 0.012)
  rgba(2, 4, 10, 0.78)
);
```

Omdat `drop-shadow()` de gemaskeerde alpha volgt, ontstaat geen
rechthoekige schaduwdoos. De kleine negatieve x-offset en positieve y-offset
plaatsen schaduw aan de binnen-/onderzijde van de voorste wolklob. De
schaduw blijft proportioneel dankzij `--fut-kw`.

De geselecteerde voorgrondpixels krijgen daarnaast een donkere
`drop-shadow()` voor kerndichtheid en een zwakke amberkleurige
`drop-shadow()` voor randlicht. De brede kaart wordt niet met een algemene
gele of blauwe overlay bedekt.

## 8. Z-index en stacking contexts

Z-index werkt alleen voorspelbaar wanneer de relevante elementen in
afgebakende paint-contexts leven.

### Kaartniveau

`.fut-kaart` heeft:

```css
position: relative;
overflow: visible;
isolation: isolate;
perspective: 600px;
```

`overflow: visible` is nodig voor de breakout. `isolation: isolate` maakt de
kaart tegelijk een eigen stacking context, zodat haar hoge frontlaag niet
over de decoratie van een andere kaart kan concurreren.

De flipper gebruikt `transform-style: preserve-3d`. Daarom heeft de
In-Form-voorkant expliciet `position: relative; z-index: 1`; zonder die
registratie kon de gefilterde kaartzijde als één compositielaag alsnog boven
de gemaskeerde frontdetails eindigen.

### Presentatie- en carouselniveau

De kaart mag zichzelf niet clippen. De eigenaar van een cel begrenst het
totale effect:

```css
.kaart-showcase__maat,
.wrapped-card {
  position: relative;
  isolation: isolate;
  overflow: clip;
}
```

In de Wrapped-carousel blijft `.wrapped-track` de horizontale native
scrollcontainer met scroll snapping. Iedere `.wrapped-card` is vervolgens
een onafhankelijke paint-stage. Zo mag een storm binnen zijn eigen slide
uitbreken, maar niet over een buurkaart tekenen.

De actieve kaart wordt daardoor visueel dominant zonder de architectuur van
de carousel te veranderen.

## 9. Responsive gedrag

De kaartmaat komt uit `--fut-kw`. De basiskaart heeft een vaste
`aspect-ratio: 100 / 139`; typografie, frame, schaduw en stormgerelateerde
afstanden schalen vanuit dezelfde kaartbreedte.

Voor de storm zijn drie regels belangrijk:

1. `left`, `top` en `width` zijn percentages van de kaartstage;
2. schaduw- en glowafstanden gebruiken `calc(var(--fut-kw) * factor)`;
3. back, inside en front delen altijd dezelfde properties.

De dev-stage gebruikt op desktop `--fut-kw: 450px`. Onder 640 pixels wordt
dat:

```css
--fut-kw: min(450px, 72vw);
```

Er is dus geen afzonderlijke mobiele stormtransform. De hele compositie
schaalt proportioneel met de kaart en kan niet loskomen van het frame.

De pagina rond de dev-stage gebruikt `overflow-x: clip`. In een carousel
gebeurt de clipping per cell. Dit voorkomt horizontale documentoverflow,
terwijl de lokale kaart zelf `overflow: visible` kan behouden.

De laatste mobiele controle gebruikte een CSS-viewport van 390 × 844 met
device-pixel-ratio 2. Het opgeslagen bestand is daardoor 780 × 1688 pixels.
De desktopworkflow gebruikt 700 × 900 bij device-pixel-ratio 2 en levert
1400 × 1800 pixels.

## 10. Screenshot- en debugworkflow

### Vaste dev-route

`StormShowcase.tsx` biedt in development `/dev/storm`. De stage rendert de
echte `FutKaart`, `FutKaartVoorkant`, `Avatar` en `FutKaartDefs`; het is dus
geen geïsoleerde namaak. De vaste testinhoud is:

- naam: `Alice Anders`;
- ELO: `1050`;
- editie: `⚡ In-Form · +48`;
- titel: `⚡ In-Form`.

Daardoor veranderen visuele vergelijkingen niet door willekeurige data.

### Desktopscript

`scripts/storm-screenshot.sh` start een headless Chromium-opname met:

- viewport 700 × 900;
- device-pixel-ratio 2;
- virtual-time-budget 8000 ms;
- uitvoer naar `screenshots/storm/<label>.png`.

Voorbeeld:

```bash
scripts/storm-screenshot.sh storm-v8-final http://localhost:5173
```

### Registratiedebug

In development activeert `?debugStorm=1` de debugweergave. Elke laag krijgt
een gekleurde omtrek en label; de masterdoos toont bovendien het anker en de
bestandsnaam:

```text
rood    achter
groen  binnen
cyaan  voor
```

Voorbeeld:

```bash
scripts/storm-screenshot.sh debug \
  "http://localhost:5173/dev/storm?debugStorm=1"
```

Deze modus controleert registratie. De gewone screenshot controleert
compositie. Beide zijn nodig: een visueel plausibel beeld kan technisch nog
drie verschillend geregistreerde lagen verbergen.

### Visuele controlelijst

Controleer na iedere grote wijziging op exact dezelfde viewport:

- begint een donkere wolkenmassa zichtbaar binnen de kaart;
- sluit die massa zonder naad aan op de externe wolk;
- verdwijnt een deel achter het frame;
- liggen precies de gewenste delen vóór het frame;
- blijft een kort framegedeelte tussen de front-occlusies zichtbaar;
- worden alle schijnbare frame-einden volledig door wolk bedekt;
- blijft de hoofdbliksem in de wolk en grotendeels rechts van de avatar;
- blijven rating, avatar, naam en kaarttekst leesbaar;
- veroorzaakt de breakout geen horizontale documentoverflow;
- schildert geen effect over een naburige carousel-cell.

## 11. Tests en kwaliteitscontroles

### Gerichte DOM-tests

`InformStorm.test.tsx` borgt twee architectuurinvarianten:

1. de DOM bevat de lagen in de volgorde `achter`, `binnen`, `voor`;
2. alle drie beelden hebben exact dezelfde `src`;
3. de inside-layer is werkelijk een kind van `.fut-kaart__vlak`.

De eerste test voorkomt dat een latere wijziging opnieuw drie visueel
afwijkende assets introduceert. De tweede test voorkomt dat de inside-layer
buiten de echte kaartclip wordt gemonteerd.

### Bestaande vectortests

`ornamentenInform.test.ts` test nog de deterministische vectorstorm uit
`ornamentenInform.ts`: grenzen, asymmetrie, randkruising, bliksemsegmenten en
veiligheid van de tekstband. Die vectoren worden gebruikt door de
canvas/posterroute in `futKaartCanvas.ts`.

Dat is een aparte renderer en niet hetzelfde als de live WebP-compositie.
De tests blijven waardevol voor posterstabiliteit, maar bewijzen geen
pixelpariteit met de huidige DOM-storm.

### Kwaliteitsgates

De gebruikelijke afronding bestaat uit:

```bash
npm run lint
npx --no-install tsc -b --pretty false
npm run build
npx vitest run src/features/rating/components/storm/InformStorm.test.tsx
git diff --check
```

Daarnaast zijn vaste screenshots en een browsercontrole op documentbreedte,
stormregistratie en cell-isolatie nodig. Tests kunnen de aanwezigheid en
structuur van lagen bewijzen, maar niet beoordelen of een wolk
volumetrisch, natuurlijk of visueel verbonden oogt.

## 12. Herbruikbare blauwdruk voor toekomstige special cards

Gebruik deze architectuur wanneer een effect één visueel object door meerdere
dieptes van de kaart moet laten lopen. Voorbeelden zijn vuur dat uit een
On-Fire-kaart slaat, een kroon- of aura-effect voor Big Daddy, ijs, rook,
confetti of energie voor andere edities.

### Stap 1 — bepaal het diepteverhaal

Schrijf vóór implementatie op:

- welk deel zichtbaar in de kaart begint;
- welk deel achter het frame verdwijnt;
- waar de externe breakout ligt;
- welke twee of drie kleine gebieden vóór het frame mogen komen;
- welke inhoud absoluut vrij moet blijven.

Zonder dit schema wordt z-index vaak achteraf als cosmetische correctie
gebruikt.

### Stap 2 — kies één coherente bron

Wanneer licht, rook of materiaal door de rand moet doorlopen, gebruik één
master-artwork met transparantie. Neem bliksem, gloed of vuurgloed in
dezelfde bron op als hun positie deel van de compositie is.

Losse assets blijven geschikt voor onafhankelijke ornamenten, zoals een
kroon of medaillon. Ze zijn minder geschikt voor één fysiek volume dat
pixelmatig over een frame moet doorlopen.

### Stap 3 — maak een dun React-laagcomponent

Volg het patroon van `StormMaster`:

- één bronimport;
- één gedeeld intern DOM-fragment;
- een kleine unie voor `achter | binnen | voor`;
- drie semantische exports voor de montagepunten;
- decoratieve accessibility-attributen;
- geen editionele kaartinhoud in de effectcomponent.

### Stap 4 — gebruik bestaande kaartslots

Monteer:

1. back vóór `.fut-kaart__zijde--voor`;
2. inside in `.fut-kaart__vlak`, vóór de content;
3. front na kaartzijde en bestaande frontornamenten, wanneer het effect
   daadwerkelijk boven die elementen moet liggen.

Verplaats rating, avatar, naam of tekst niet om ruimte voor het effect te
maken. Stuur de leesbaarheid via artwork, mask en laagpositie.

### Stap 5 — centraliseer de transform

Maak edition-specifieke properties zoals:

```css
--effect-master-left: ...;
--effect-master-top: ...;
--effect-master-width: ...;
--effect-master-scale: ...;
--effect-master-rotate: ...;
```

Gebruik diezelfde waarden in alle instanties. Voeg geen
`--effect-front-left` of `--effect-inside-scale` toe; zulke uitzonderingen
breken de registratie. Een andere zichtbare selectie hoort in een mask, niet
in een andere transform.

### Stap 6 — hergebruik het echte schildmasker

Plaats de inside-layer in `.fut-kaart__vlak`. Daarmee volgt hij automatisch
`var(--schild)`, ook bij een andere kaartvorm. Compenseer de geneste
frame-insets zoals `--storm-master-inset` dat doet.

### Stap 7 — ontwerp een beperkt frontmask

Een goed frontmask:

- gebruikt hetzelfde coördinatenstelsel als het master-artwork;
- toont alleen delen die het frame werkelijk bedekken;
- vermijdt rechte of geometrische randen;
- laat tussen grote occlusies iets van het frame zien;
- blijft uit rating-, avatar- en tekstzones;
- kan met een lokale, alpha-volgende `drop-shadow()` worden ondersteund.

### Stap 8 — isoleer de eigenaar van iedere kaart

Behoud `overflow: visible` en `isolation: isolate` op de kaart. Geef iedere
showcase- of carousel-cell daarnaast `position: relative`,
`isolation: isolate` en `overflow: clip`. Zo blijft breakout mogelijk zonder
dat effecten tussen kaarten lekken.

### Stap 9 — test structuur én beeld

Voeg minimaal tests toe voor:

- laagvolgorde;
- één gedeelde bron;
- inside-parent;
- afwezigheid van interactieve of toegankelijke ruis.

Maak daarnaast een vaste desktop- en mobiele screenshot. Een visuele
acceptatiecheck blijft verplicht voor massa, overlap, belichting en
leesbaarheid.

### Toepassing op bestaande edities

**On Fire**

De On-Fire-kaart gebruikt inmiddels dezelfde drie-masterstructuur via
`OnfireEffect.tsx`. `onfire-master.webp` combineert lavabrokken links, een
verbonden lavabed onderaan, de vulkaan rechtsmidden en de rookkolom
rechtsboven. `onfire-front-mask.svg` selecteert twee basaltzones links en een
beperkte eruptiezone rechts. De bestaande metalen crest, V-vinnen,
puntmedaillon, skin, watermerk en content zijn behouden als afzonderlijke
vector-/kaartlagen.

De gedeelde On Fire-transform staat uitsluitend op `.fut-kaart--onfire`:

```css
--onfire-master-left: -16%;
--onfire-master-top: -24%;
--onfire-master-width: 132%;
--onfire-master-scale: 1;
--onfire-master-rotate: 0deg;
```

De vaste controle gebeurt via `/dev/onfire`,
`scripts/onfire-screenshot.sh` en `?debugOnfire=1`. De finale beelden staan
in `screenshots/onfire/final-desktop.png` en
`screenshots/onfire/final-mobile.png`.

**El Padelissimo / Dictator**

De Dictator-tier gebruikt dezelfde drie-masterstructuur via
`DictatorEffect.tsx`. `dictator-master.webp` houdt de centrale kaartzone
grotendeels transparant en combineert twee bordeauxrode vaandels achter de
bovenhoeken, een gedetailleerde officierspet, donkere goudrode rook en
embers, volle gouden lauwerkransen, een rood-gouden stermedaille, een
compacte tank linksonder en een doorlopend ceremonieel lint onder/rechts. De
vroegere Dictator-pet, -lauweren en het lakzegel worden niet meer als losse
SVG-ornamentlaag gemonteerd; het frontmask selecteert hun artworkpixels uit
dezelfde gedeelde master.

De gedeelde registratie staat uitsluitend op `.fut-kaart--dictator`:

```css
--dictator-master-left: -15%;
--dictator-master-top: -18%;
--dictator-master-width: 130%;
--dictator-master-scale: 1;
--dictator-master-rotate: 0deg;
```

`dictator-front-mask.svg` laat de pet, lauweren, stermedaille, tank, lage
rook en geselecteerde lintplooien vóór de relevante framedelen door. De
vaste controle gebeurt via `/dev/dictator`,
`scripts/dictator-screenshot.sh` en `?debugDictator=1`. De finale beelden
staan in
`screenshots/dictator/final-desktop.png` en
`screenshots/dictator/final-mobile.png`.

**Big Daddy**

Big Daddy wordt als de `icon`-editie behandeld en gebruikt dezelfde
drie-masterstructuur via `BigDaddyEffect.tsx`. `bigdaddy-master.webp` is een
1280 × 1727 WebP met alpha en combineert één grote juwelenkroon, pluchen wolken
in beide bovenhoeken, een hart- en sterballon met strik rechtsboven, een tweede
gespiegelde hartballon halverwege links, satijnlinten met neonharten en de
pluchen ster op de rechterflank, een volledige gekroonde teddy linksonder,
linten linksonder én rechtsonder en een gevleugeld hartmedaillon in de
schildpunt. De centrale zone blijft grotendeels leeg voor rating, avatar, naam
en editie-informatie.

De gedeelde registratie staat uitsluitend op `.fut-kaart--icon`:

```css
--bigdaddy-master-left: -20%;
--bigdaddy-master-top: -22%;
--bigdaddy-master-width: 140%;
--bigdaddy-master-scale: 1;
--bigdaddy-master-rotate: 0deg;
```

`bigdaddy-inside-mask.webp` laat binnen het schild alleen wolken, linten en
ondergloed door; daardoor verschijnt de teddy niet als bleke afdruk in het
kaartvlak. `bigdaddy-front-mask.webp` selecteert de kroon, de volledige maar
naar de buitenflank verplaatste teddy, de ballonpartijen, de pluchen ster, het
onderste medaillon en twee lintpartijen vóór het frame. Dit is een belangrijk
verschil met een masker dat slechts een halve teddy toont: samengestelde
herkenbare objecten worden in het artwork zelf responsief veilig geplaatst en
niet geometrisch doormidden geknipt.

Beide maskers zijn raster in plaats van SVG, omdat hun vorm de **alfa van de
onderdelen zelf** is. Een eerdere versie tekende SVG-vormen op de bounding box
van elk onderdeel; daarmee schilderde de frontlaag hele rechthoeken artwork
(wolk, gloed, naburige onderdelen) over kaart en frame, met rechte randen dwars
over de lijst — exact de fout die stap 7 hieronder verbiedt. Wie dit patroon
kopieert: houd de versterkingsfactor op de alfa laag (1,3–1,8), anders wordt de
geveerde snederand van een onderdeel alsnog een rechte kant in het masker.

**Gegenereerde master en maskers (#834).** Big Daddy is de eerste editie waar
master én maskers uit één script komen:

```bash
node scripts/bigdaddy-master-compose.mjs [--preview]
```

De oorspronkelijke master was één dichte ornamentkrans óm de kaart: het gouden
frame verdween links en rechts volledig achter satijn en de kroon bedekte een
derde van het kaartvlak. De referentie doet het omgekeerd — het frame blijft
rondom leesbaar en objecten raken het frame alleen plaatselijk. Die krans is
daarom bewaard als onderdelenblad (`bigdaddy-onderdelen.webp`, niet
geïmporteerd en dus niet gebundeld); het script snijdt de objecten eruit en zet
ze terug op posities die als fractie van het kaartvlak zijn gemeten aan
[`referentie_big_daddy.png`](./referentie_big_daddy.png).

Dat levert drie eigenschappen die de andere edities niet hebben:

- de compositie is reproduceerbaar zonder gelaagd bronbestand — het bezwaar
  onder "Het master-artwork is een afgeleid rasterasset" geldt hier niet meer;
- `bigdaddy-front-mask.svg` en `bigdaddy-inside-mask.svg` zijn *afgeleid* van de
  onderdelenlijst. Elk onderdeel draagt een `voor`-selectie (het hele object of
  een paar vakken ervan), zodat een maskervorm nooit los van een objectpositie
  kan verschuiven. Het middenstuk van het rechterlint heeft bewust géén
  selectie: daardoor weeft het satijn zichtbaar achter én vóór het frame;
- `BigDaddyEffect.test.tsx` vergelijkt de canvasmarges in het script met de
  `--bigdaddy-master-*`-waarden in de CSS en met de `viewBox` van beide
  maskers. Een desync valt daardoor in de tests om, niet pas op een screenshot.

Twee valkuilen die het script expliciet afhandelt en die bij een volgende
editie terugkomen:

- een snede die volledig binnen een massa ligt (de wolken) is overal dekkend.
  Alleen uitdoven van de randen maakt daar een zachte rechthoek van; zo'n
  snede heeft een gelobd silhouetmasker nodig;
- veer, silhouet, alfa en kleurcorrectie rekenen met de hand op de rauwe
  RGBA-buffer. Sharps `dest-in` liet de gemaskeerde randen in deze pijplijn
  ongemoeid en `modulate` gooide het alfakanaal plat — beide leverden een
  onderdeel dat als dichte rechthoek op de kaart landde.

Twee CSS-details die de aansluiting maken: het matelas-weefsel zit in de
`background` van `.fut-kaart__vlak` en niet in een `::after`, want een
pseudo-element schildert ná de kaartinhoud — daar lag de ruit over de avatar en
de letters. En de icon-editie krijgt een magenta getinte contactschaduw in
plaats van de gedeelde donkergroene: tegen roze artwork las die als een donkere
goot tussen kaart en decor, waardoor de ornamenten niet meer op de lijst leken
aan te sluiten.

**Kaartvlak (#834).** Naast het artwork week ook de skin af: het vlak stond op
bijna-wit met de gedeelde stralenkrans, terwijl de referentie verzadigd roze
satijn met donkermagenta letters toont. De `--bigdaddy-kaart-*`-tokens in
`index.css` staan daarom op dat diepere roze, de icon-editie brengt een eigen
`matelas`-weefsel mee (een gequilt ruitraster dat de stralenkrans vervangt, net
zoals het brokaat dat bij de dictator doet) en de lijst is zwaarder: goud,
magenta liner, goud keyline op 0,026/0,017/0,007 × kaartbreedte. Vlakkleuren,
liner, keyline, weefsel, randgloed en randdiktes staan gespiegeld in
`EDITIE_REGISTERS.icon` in `futKaartCanvas.ts`, onder de bestaande synctest.

De vroegere live Big Daddy-SVG's voor kroon, lint, ballonnen en
puntornament worden bij `editie === "icon"` niet meer gemonteerd. Ze blijven
wel beschikbaar voor de canvas/posterfallback. De vaste controle gebeurt via
`/dev/bigdaddy`, `scripts/bigdaddy-screenshot.sh` en
`?debugBigDaddy=1`. De finale beelden staan in
`screenshots/bigdaddy/final-desktop.png` en
`screenshots/bigdaddy/final-mobile.png`; de drie #834-checkpoints in
`bigdaddy-v4-krans-baseline.png` (de dichte krans vóór #834),
`bigdaddy-v5-referentie-compositie.png` (objecten op referentieposities, roze
vlak) en `bigdaddy-v6-vlak-en-lijst.png` (zwaardere goud-magenta lijst).

**Piet**

De Piet-editie gebruikt `PietEffect.tsx` en `PietEffect.css` met één
`piet-master.webp` van 1024 × 1536 pixels. Het master-artwork bevat een
relatief smalle, doorlopende noir-omlijsting: zwarte rook met goudstof,
complete speelkaarten, veren en geschenken, twee zware kettingtrajecten, een
gevleugelde bovencrest en een onderste rozet met medaillon. De grote
transparante middenopening (ongeveer x 15–85%, y 14–84%) is een expliciet
assetcontract; rating, avatar en tekst worden dus niet met een toevallig
frontmask “teruggewonnen”.

De gedeelde registratie staat uitsluitend op `.fut-kaart--piet`:

```css
--piet-master-left: -18%;
--piet-master-top: -18%;
--piet-master-width: 136%;
--piet-master-scale: 1;
--piet-master-rotate: 0deg;
```

`piet-inside-mask.svg` dempt de veilige middenzone verder en laat alleen de
randgebonden rook, gouddeeltjes en objectaansluitingen in het echte
kaartschild door. `piet-front-mask.svg` selecteert complete objectgroepen:
de bovencrest, beperkte zijgroepen, kleine kettingpartijen en de volledige
onderste rozet. Dit voorkomt zowel halve herkenbare objecten als een dikke
ornamentring die de kaart visueel verdringt.

De onderste kettingen draaien in het artwork al rond 64–68% van de canvashoogte
naar binnen. Dat is bewust geen afwijkende CSS-transform voor de frontlaag:
kettingbogen en rozet sluiten daardoor in back, inside en front op exact
dezelfde plek tegen de schildpunt aan.

Het master-artwork bevat daarnaast een open rookcrescent rond het
avatarregister (ongeveer x 68%, y 36%). `piet-inside-mask.svg` laat die
selectief achter de echte avatar door, terwijl de content zelf later in de
DOM wordt geschilderd. Daardoor krijgt de profielfotorand het donkere
rookvolume uit de referentie zonder een algemene grijze overlay over de kaart.
Het inside-mask gebruikt hiervoor vier overlappende, asymmetrische lobben in
plaats van één gesloten ovaal. De Piet-specifieke avatarstijl in
`PietEffect.css` vervangt bovendien de generieke lichte ring door drie
materiaalbanden: fijn goud, donker metaal en antiek goud. Avatarinhoud,
diameter en positie blijven die van de gedeelde kaartcomponent.

De oude `fut-orn-piet-*`-SVG's worden voor de live React-kaart niet meer
gemonteerd, maar blijven bestaan voor canvas-/postercompatibiliteit. De
afzonderlijke `pias`-editie wordt niet geraakt. De vaste controle gebeurt via
`/dev/piet`, `scripts/piet-screenshot.sh` en `?debugPiet=1`. De finale
beelden staan in `screenshots/piet/final-desktop.png` en
`screenshots/piet/final-mobile.png`.

**Pias**

De pias-editie gebruikt `PiasEffect.tsx` en `PiasEffect.css` met één
`pias-master.webp` van 768 × 1024 pixels. Anders dan de andere masters is dit
artwork niet los aangeleverd maar volledig afgeleid van
[`referentie_pias.png`](./referentie_pias.png) door
[`scripts/pias-master.py`](../scripts/pias-master.py). Dat script is daarmee de
bron van waarheid: het snijdt de kaart, het frame en alle kaartinhoud uit de
referentie weg en houdt de ornamentring over — narrenkroon met strikken,
klaverteken, schaakpion, twee speelkaarten, lintboog met rozet en
clownmedaillon, narrenkop met kap en plooikraag, aangebeten bagel, poederwolken,
kolengruis en confetti.

Twee keyings maken dat mogelijk. Buiten de kaart staat de referentie op zwart:
daar levert een luminantiekey zachte randen voor rook en stof, terwijl donkere
massieve objecten via een floodfill worden dichtgezet (wat binnen hun ROI niet
vanaf de ROI-rand via bijna-zwart bereikbaar is, hoort bij het object). Binnen de
kaart wordt per handgetekende objectcontour een lokaal perkamentmodel gefit op de
ring rond die contour; wat daar ver genoeg vanaf ligt is object. Zo blijven
kroon, rozet, lint, narrenkop, bagel, speelkaarten, pion en klaver compleet in
plaats van op de framerand af te breken — precies de fout die
`bigdaddy-front-mask.svg` bij de halve teddy moest voorkomen.

De gedeelde registratie staat uitsluitend op `.fut-kaart--pias`:

```css
--pias-master-left: -14.6%;
--pias-master-top: -9.9%;
--pias-master-width: 129.3%;
--pias-master-scale: 1;
--pias-master-rotate: 0deg;
```

Die waarden zetten het kaartvak van de referentie exact op het echte kaartvlak.
Er is geen inside-mask: het lege midden van het artwork en het echte
`clip-path: var(--schild)` doen dat werk al. `pias-front-mask.svg` selecteert de
negen objectgroepen die vóór het frame komen; tussen die groepen blijft de
gouden rand zichtbaar. Het gruis op het perkament blijft beperkt tot de band
tussen 26 en 132 pixels binnen de kaartrand en komt nooit over rating, avatar,
naamplaat, statistiek of badgerij.

Ook de pias loopt tegen het vormverschil van hierboven aan, en de oplossing is
dezelfde soort: de onderste helft van de ring schuift horizontaal mee met de rand
van het echte schild (per rij het verschil met de referentierand, begrensd op
120 px, alleen van y afhankelijk). Twee dingen wijken bewust af van de Piet:

- de schuif staat **niet** uit binnen het schild. De kettingen van de Piet hangen
  volledig naast de kaart, maar de pias-props liggen met opzet half erover —
  speelkaarten rechts, plooikraag linksonder. Een schuif die op de schildrand op
  nul valt, scheurt zo'n prop precies daar in twee. Het kaartvlak is in de master
  toch transparant, dus binnen het schild valt er niets te beschermen;
- de ramp opent ruim bóven de hoogte waar de schuif inzet. De zachte aanloop komt
  al uit de meetkunde — daar lopen schild en referentierand nog samen — en een
  ramp die pas dáár opent, telt zijn eigen helling bij de meetkundige op. De
  schuif klom dan 1,2 px per rij en dat scheert de lintlussen zichtbaar schuin.

Het centrale medaillon schuift niet mee (het hoort op de onderas) en gaat 5 px
terug naar die as; die zone dekt tegelijk de plek waar de schuif van teken
wisselt, zodat de doorlopende lintboog daar geen naad krijgt. Ná de schuif komt
materiaal dat buiten de referentiekaart lag binnen het schild terecht — voor de
props de bedoeling, voor los gruis niet — dus een dieptepoort handhaaft de
132-pixelband ook achteraf. Zonder die poort liep de roetsliert onder de
narrenkop tot ~200 px in het vlak, tot tegen de editieregel.

`pias-front-mask.svg` is daarom niet langer handwerk: het script schrijft het mee,
met dezelfde schuif op de vensters van de onderste groepen. Een masker dat blijft
staan terwijl het artwork schuift, laat de verschoven prop half achter het frame
vallen en snijdt hem op de framerand af — precies wat de breakout kapotmaakt. Het
script rekent daarvoor in een werkcanvas van 1024 × 1365 (ook de viewBox van het
masker) en schrijft het WebP op 768 × 1024; het register is percentagegebaseerd,
dus aan die rastermaat hangt alleen de scherpte.

De profielfoto volgt hier het artwork in plaats van omgekeerd (zie
§"Avatarregister" bij de Piet voor de tegenovergestelde keuze). Op de referentie is
de cirkel 0,429 kaartbreedte en hangt hij op 0,752 / 0,404; de gedeelde kaart zet
0,36 op 0,747 / 0,453. Horizontaal klopt het dus al, en `PiasEffect.css` corrigeert
maat en hoogte vanaf de heromaat (≥168 px). Dat staat op `.fut-kaart--pias` en niet
in de gedeelde kaart om twee redenen: `FutKaart.css` heeft voor die maten al een
`@container`-blok met 0,44, maar dat staat vóór de basisregel
`.fut-kaart { --fut-avatar: 0.36 }` en een `@container`-blok voegt geen
specificiteit toe — dezelfde cascadeval als #654, dus die 0,44 doet niets. Dat
rechttrekken raakt élke kaart, en de Piet heeft zijn rookkraag in het artwork op de
huidige 0,36-maat gesneden.

De vroegere live pias-SVG's (narrenkap, belletjes, maskermedaillon) worden bij
`editie === "pias"` niet meer gemonteerd; ze blijven bestaan voor de
canvas-/posterfallback. De vaste controle gebeurt via `/dev/pias`,
`scripts/pias-screenshot.sh` en `?debugPias=1`. De finale beelden staan in
`screenshots/pias/final-desktop.png` en `screenshots/pias/final-mobile.png`; het
kale artwork staat in `screenshots/pias/master-preview.png` en dezelfde plaat mét
de rand van het app-schild erover in `screenshots/pias/master-contouren.png` —
dát is het beeld waarop te zien is of de props de kaartvorm raken in plaats van
die van de referentie.

**GOAT**

De GOAT is geen editie maar een tier (`tier.key === "legende"`, rating
1400–1599) en gebruikt dezelfde drie-masterstructuur via `GoatEffect.tsx`.
`goat-master.webp` is 1024 × 1664 pixels en volledig afgeleid van
[`referentie_goat.png`](./referentie_goat.png) door
[`scripts/goat-master.py`](../scripts/goat-master.py). Dat script is daarmee de
bron van waarheid: het snijdt per element een uitsnede uit de referentie,
sleutelt de bijna-zwarte achtergrond via luminantie naar alpha, isoleert het
element met een organisch polygoonmasker en plaatst het op het gedeelde canvas.
Donkere massieve delen (de rots onder de geit, de bergflank) krijgen daarbij een
tweede polygoon die hun alpha opaak forceert: een luminantiekey alleen maakt van
bijna-zwart gesteente een halftransparante vlek.

Het artwork draagt zeven groepen: twee spiraalvormige bokhoorns, het
geitenmonument op zijn rots, kristalclusters langs beide flanken, de bergscene
in het kaartvlak en de kristalchevron met edelsteen in de schildpunt. De
compositie is bewust geen 1:1-overname van de referentie: het schild van de
referentie is verhoudingsgewijs breder dan de echte kaart (0,77 tegen 0,72), dus
de hoorns staan iets verder naar buiten en het monument staat op 95% van zijn
referentieschaal. Alleen zo past de hele groep binnen een breakout van 53%
kaarthoogte.

De gedeelde registratie staat uitsluitend op `.fut-kaart--legende`:

```css
--goat-master-left: -20%;
--goat-master-top: -53%;
--goat-master-width: 140%;
--goat-master-scale: 1;
--goat-master-rotate: 0deg;
```

Die eerste drie waarden bepalen het kaartvak in het canvas (x 146..877,
y 539..1556). `ASSET_SPEC.md` legt per element de canvaspositie vast, want de
maskers zijn erop gekalibreerd: `goat-inside-mask.svg` laat binnen het schild
alleen de bergscene door en `goat-front-mask.svg` selecteert de kristalpunten op
de flanken plus de volledige edelsteen-chevron. Beide maskerranden vallen
bewust bínnen de bijbehorende uitsnede. Dat is het leerpunt van deze breakout:
een masker dat rúimer is dan zijn artwork toont juist de rechte uitsnederand,
terwijl een masker dat er bínnen eindigt die rand verbergt.

Een tweede leerpunt zit in de bovenrand. De topgroep mag geen framepixels uit de
referentie meenemen: het schild van de echte kaart zakt bij de bovenhoeken 4,5%
van de kaarthoogte, dus een meegesneden referentieframe komt daar bóven de
kaartrand uit en leest als een tweede, verschoven lijst. De uitsnedes stoppen
daarom op referentie-y 566 en de rots wordt zo geplaatst dat zijn snijrand onder
de diepste framerand van het schild valt.

Twee dingen zijn buiten het artwork aangepast. De hoorn- en
baardfiligraan-SVG's worden bij `tier.key === "legende"` zonder editie niet meer
gemonteerd (met een editie erop wint die editie, en dan blijven de vector-hoorns
staan zoals voorheen). En de lijst van de kaart is zwaarder gezet —
`--kaart-frame-dikte/-liner-dikte/-keyline-dikte` op 2,8/1,2/0,6% van de
kaartbreedte, met `randDiktes: [0.028, 0.012, 0.006]` als canvas-spiegel. Op de
referentie is die rosé metaalband ruim vier keer zo dik als een gewone
divisiekaart, en juist die massa laat de hoorns er geloofwaardig achter
verdwijnen. De ondergrens blijft 3/1,5/1 px, zodat een 130px-kaart in het
klassement niet dichtslibt.

De vaste controle gebeurt via `/dev/goat`, `scripts/goat-screenshot.sh` en
`?debugGoat=1`. Omdat de breakout hoger is dan bij de andere kaarten gebruikt
het desktopscript een venster van 700 × 1300 en houdt de dev-stage 330px (mobiel
62vw) ruimte boven de kaart. De finale beelden staan in
`screenshots/goat/final-desktop.png` en `screenshots/goat/final-mobile.png`; het
kale artwork staat in `screenshots/goat/master-preview.png`.

**Wannabe**

De Wannabe is de goud-divisie (`tier.key === "goud"`, rating 1000–1099) en
gebruikt dezelfde drie-masterstructuur via `WannabeEffect.tsx`.
`wannabe-master.webp` is 1024 × 1440 pixels en, net als bij de pias en de GOAT,
volledig afgeleid van [`referentie_wannabe.png`](./referentie_wannabe.png) door
[`scripts/wannabe-master.py`](../scripts/wannabe-master.py). Het artwork draagt de
bronzen racketcrest op de bovenrand, het megafoonmedaillon in de schildpunt, twee
plakstroken, de briefjes "ALMOST THERE?" en "NOT BAD" met hun pijlen, een kruis,
een stiftkroontje met krassenbundel, drie inktdruipers en het rasterpuntvuil met
het getekende tekstballonnetje in het kaartvlak. Het volledige assetcontract staat
in [`ASSET_SPEC.md`](../src/features/rating/components/wannabe/ASSET_SPEC.md).

De gedeelde registratie staat uitsluitend op `.fut-kaart--goud`:

```css
--wannabe-master-left: -9.53%;
--wannabe-master-top: -12.55%;
--wannabe-master-width: 119.07%;
--wannabe-master-scale: 1;
--wannabe-master-rotate: 0deg;
```

Die waarden zijn de uitvoer van het script (kaartvak x 82..942, y 150..1345 in
het canvas) en dus een rekenuitkomst, geen smaakinstelling.

### Een referentie op wit vraagt drie poorten in plaats van één

Dit is de eerste referentie die niet op zwart maar op **wit** staat. Een
luminantiesleutel houdt daar precies het verkeerde vast. Het model is
`P = a·C + (1−a)·BG` met `BG` een lokale papierschatting: een maximumfilter
(elke stiftstreek is smaller dan het venster, dus het maximum ís het
onbeschreven papier) gevolgd door een lichte vervaging. Dat werkt in één keer op
het witte buitenveld én op het perkament van het kaartvlak — nodig, want dezelfde
streek loopt hier van buiten de kaart tot over de lijst.

Alleen: die lijst is even donker als de stift. Donkerte alleen levert daarom de
halve onderhoek van de referentie als zwarte plaat op de kaart. De inktsleutel
heeft twee extra poorten nodig, en die scheiden **materiaal**, niet onderdelen:

- *chroma* (max − min kanaal): alles wat getekend is, is neutraal zwart (5–14),
  de walnoten lijst is warm bruin (40–65). Waar de lijst zó diep in de schaduw
  staat dat hij óók neutraal wordt, is hij ook bijna zwart en valt het verschil
  met inkt weg — dan is het kopiëren ervan onschadelijk;
- *lokaal contrast* tegenover een straal-12-vervaging: een streek is smal en
  springt eruit, het vlak van de lijst is breed en glad.

Voor de massieve voorwerpen (`vast`) is er één poort in de andere richting: het
witte veld en de grijze slagschaduw búiten de kaart vallen binnen elke contour
die over de kaartrand loopt. Wat licht én neutraal is valt daarom weg — papier is
warm (chroma 30–60) en blijft staan. Zonder die poort krijgt elk briefje een
witte halo op de kaart, en dan staat er bovendien een tweede, meegekopieerde
slagschaduw onder de CSS-contactschaduw.

Het perkamentvuil gebruikt alleen de **donkere** helft van twee detailschalen.
Vuil maakt papier donkerder; de lichte helft meenemen levert een bleke waas over
het kaartvlak in plaats van slijtage. De avatarzone wordt als cirkel uitgespaard
en niet als rechthoek: precies in de hoeken van zijn bounding box zit het
dichtste rasterpuntveld van de referentie.

### Het frontmasker mag geen zwarte achtergrond hebben

Hier viel een val op die de andere maskers ontlopen omdat hun master in het
midden leeg is. CSS `mask` met een SVG-*image* valt in `match-source` terug op
**alpha**, niet op luminance. Een dekkende zwarte `<rect>` als achtergrond heeft
alpha 1 en laat dus de héle master door — het rasterpuntvuil stond daardoor vóór
de avatar in plaats van erachter. `wannabe-front-mask.svg` heeft daarom geen
achtergrondrect: transparant werkt in béide modi (alpha 0 én luminance 0).
`storm-front-mask.svg` en `goat-front-mask.svg` doen het al zo; wie een nieuw
masker genereert, moet die rect dus weglaten.

### De taps zit 24 procentpunt hoger dan bij de referentie

De referentiekaart loopt tot ~84% kaarthoogte op volle breedte door en tapst dan
naar de punt; `#fut-schild-notch` begint zijn taps al op 60%. Alles wat in de
referentie in die onderhoek staat — kroontje, krassenbundel, druipers, megafoon —
zou op zijn referentieplek naast de kaart hangen. Die onderdelen krijgen daarom
in het script een verschuiving in kaartfracties (`dfx`/`dfy`). Datzelfde geldt
voor de rechterflank: de app zet zijn avatar lager en groter dan de referentie
(0,35 tegen 0,23 kaarthoogte), dus het "NOT BAD"-briefje en het kruis zakken 7,5
respectievelijk 9 procentpunt mee — anders ligt hun bovenhoek over de foto. Dit
is een correctie in de **asset**, niet in CSS: de vier CSS-waarden blijven voor
alle drie de lagen gelijk, en §5 blijft dus gelden.

### Kaartvlak en lijst

Ook hier week de skin af, en verder dan bij de andere divisies. Het oude register
was champagnefolie over mosterdmessing: op afstand een dure gouden kaart, van
dichtbij verguld messing. De referentie doet het grapje anders — daar is de kaart
geen namaakgoud maar een *uitgeprint* trofee-certificaat: grauw karton, een zware
walnoten lijst met een crème binnenband, en er is met stift op gekalkt. De
imitatie zit in de pretentie, niet in het materiaal, en dat verdraagt geen
holografische glansbaan en geen stralenkrans. De `--kaart-*`-tokens in
`divisies/goud.css` staan daarom op verweerd karton met donkerbruine inkt, de
`::before`-glansbaan is één brede kleurloze streep zonder animatie en de
`::after`-stralenkrans is vervangen door vlekwerking (lichtkern linksboven,
warme hoekschaduw rechtsonder). De lijst is zwaarder: 2,9/1,7/0,4% van de
kaartbreedte, met `randDiktes` als canvas-spiegel.

Drie details waar het bijna misging:

- de **liner** wisselt van donker naar crème, want op de referentie is de
  binnenband het lichte deel. De donkere haarlijn tussen band en kaartvlak zou
  dan logisch in de *keyline* horen — maar de keyline is per definitie de
  lijnkleur op-gemixt naar warm wit (#666) en `futKaartCanvas.test.ts` heeft daar
  een invariant op. Een donkere keyline zou die omkeren voor élke goud-kaart, ook
  mét editie. De haarlijn zit daarom in `--kaart-binnenlijn`;
- de **tanne strook** onder de divisieregel is bewust géén uitsnede uit het
  artwork: de strook van de referentie heeft "WANNABE II" ingebakken, en die
  letters zouden als spookkopie naast de echte regel staan. Hij staat in CSS,
  groeit met de tekst mee en blijft op élke kaartmaat scherp. De scheefstand zit
  op de strook en wordt op de tekst teruggedraaid;
- alles wat alleen bij de *kale* Wannabe hoort — de zwaardere lijstdiktes, de
  avatarring, de tanne strook, de naamplaatbalken en de twee vlak-pseudo's —
  staat achter `:has(.wannabe-effect)`. Die laag wordt alleen zonder editie
  gemonteerd, dus dat is precies de juiste poort. Zonder die scoping krijgt een
  Wannabe met een Big Daddy- of Kampioen-editie er een tanne strook en een
  walnoten lijstdikte bij, dwars door zijn eigen editieskin heen. De
  canvasrenderer doet hetzelfde: het divisieregister wordt daar pas bereikt als
  geen editieregister matchte.

De vroegere live goud-SVG's (folieranden met losgekomen hoekje, racketcrest,
lauwermedaillon) en het racketwatermerk worden bij `tier.key === "goud"` zonder
editie niet meer gemonteerd; ze blijven bestaan voor de canvas-/posterfallback.
De vaste controle gebeurt via `/dev/wannabe`, `scripts/wannabe-screenshot.sh` en
`?debugWannabe=1`. De finale beelden staan in
`screenshots/wannabe/final-desktop.png` en
`screenshots/wannabe/final-mobile.png`; de tussenstappen in `baseline.png` (de
vectorkaart vóór #834), `v1-artwork.png` (het artwork op de oude gouden skin),
`v2-skin.png` (verweerd karton met walnoten lijst), `v3-masker.png` (het
frontmasker zonder zwarte rect), `v4-textuur.png` (perkamentvuil en de tanne
strook), `v5-raster.png` (de rasterpunten, na de ronde avataruitsparing) en
`v7-lijst.png` (zwaardere lijst, papierpoort tegen de witte halo's). Het kale
artwork staat in `screenshots/wannabe/master-preview.png`, met de
onderdeelcontouren in `master-contouren.png`.

**Andere special editions**

Gebruik het patroon voor effecten met fysieke continuïteit: sneeuwstorm,
rook, energie, confettiwolk of verfspatten. Gebruik het niet automatisch voor
ieder decoratief icoon. Een los embleem heeft geen drie identieke
registraties nodig.

## 13. Veelvoorkomende fouten en diagnose

| Symptoom | Waarschijnlijke oorzaak | Controle |
| --- | --- | --- |
| Dubbele bliksem bij de rand | Een laag heeft een andere transform | Vergelijk alle `--effect-master-*`-waarden en gebruik `?debugStorm=1` |
| Wolk staat naast de kaart | Master te ver naar rechts of te weinig interne massa in artwork | Beoordeel het artwork zelf en verschuif alleen de gedeelde transform |
| Frame blijft overal zichtbaar | Frontmask mist de framezone of front-z-index is te laag | Open het mask op de master-viewBox en controleer stacking context |
| Frame lijkt rechthoekig weggeknipt | Maskerrand dekt het frame-einde niet met zichtbare wolkpixels | Vergroot/verschuif de organische maskerlob; knip het frame zelf niet |
| Kaarttekst wordt grijs | Inside-effect te licht/dekkend of algemene overlay boven content | Houd inside onder content en maak de kern lokaal in het artwork |
| Frontwolk bedekt naam/rating | Frontmask is te groot | Verklein het mask; wijzig niet de gedeelde mastertransform voor één laag |
| Effect lekt naar buurkaart | Cell mist `isolation` of `overflow: clip` | Inspecteer de directe carousel-cell, niet alleen de kaart |
| Mobiele registratie wijkt af | Pixel-offsets of aparte media-querytransform | Gebruik percentages en `--fut-kw`; deel één transform op alle viewports |
| Schaduw heeft een rechthoekige doos | `box-shadow` op de masterwrapper | Gebruik `filter: drop-shadow()` op gemaskeerde alpha |

## 14. Bekende beperkingen en open eindes

### DOM en canvas/poster zijn niet dezelfde renderer

De live React-kaart gebruikt voor In-Form `storm-master.webp`, voor On Fire
`onfire-master.webp`, voor Dictator `dictator-master.webp`, voor Big Daddy
`bigdaddy-master.webp`, voor Piet `piet-master.webp`, voor de pias
`pias-master.webp`, voor de GOAT `goat-master.webp` en voor de Wannabe
`wannabe-master.webp`. De
canvas/posterroute in `futKaartCanvas.ts` tekent nog
`INFORM_STORM_ACHTER`, `INFORM_STORM_BINNEN` en `INFORM_STORM_VOOR` uit
`ornamentenInform.ts`, plus de oudere On Fire-pluimen/randvlammen uit
`ornamentenOnfire.ts` en de bestaande vectorornamenten van de Dictator, Big
Daddy en Piet. Voor de GOAT tekent `drawGoatOrnament()` daar dus nog de
vector-bokhoorns; alleen de lijstdiktes zijn met `randDiktes` gelijkgetrokken.
Hetzelfde geldt voor de Wannabe: de poster tekent nog de folieranden, de
racketcrest en het lauwermedaillon uit `divisies/goud.ts`. Het `register`
daarin — vlakkleuren, lijst, inkt, randdiktes — is wél gelijkgetrokken met de
CSS, dus kaart en poster delen in ieder geval hun materiaal.

Daarom is vorm- en lichtpariteit tussen live kaart en geëxporteerde poster
niet gegarandeerd. Een toekomstige verbetering kan:

- het WebP-masterwerk ook in de canvasrenderer laden en op dezelfde
  relatieve transform tekenen; of
- bewust twee renderers behouden, maar ze met aparte referentiescreenshots
  en expliciete tolerantie testen.

Tot die keuze is gemaakt, mogen de vectortests niet als bewijs voor de
live WebP-composities worden gebruikt.

### De GOAT-breakout is hoger dan de cellen die hem tonen

Met `--goat-master-top: -53%` staat het monument ruim een halve kaarthoogte
boven de kaart. In de dev-stage en de kaart-preview is daar ruimte voor, maar
`.kaart-raster__cel` in het klassement heeft alleen `position: relative` — geen
`overflow: clip` — en de rijafstand is kleiner dan die 53%. Een GOAT in de
kaartenwand kan dus over de rij erboven schilderen, net zoals de bestaande
Dictator- (18%) en Big Daddy-breakouts (34%) dat in mindere mate al doen.

De cel kan niet zonder meer worden geclipt: de rangmunt hangt bewust op
`top: -10px` buiten de kaart en zou dan wegvallen. Een oplossing hoort dus in de
cel zelf (bijvoorbeeld een aparte clip-laag rond alleen de kaart, of meer
rijafstand voor de toptiers), niet in de gedeelde registratie van het effect —
één transform voor alle drie de lagen blijft de harde regel.

### Legacy-SVG's zijn nog aanwezig

De losse oudere stormassets zijn niet verwijderd. Ze kunnen verwarring
veroorzaken bij codezoekopdrachten. `MANIFEST.md` is daarom de bron van
waarheid voor de huidige browsercompositie.

### Het master-artwork is een afgeleid rasterasset

Voor drie edities geldt dit niet. De pias en de GOAT worden door
`scripts/pias-master.py` respectievelijk `scripts/goat-master.py` uit hun
referentie-PNG gesneden; Big Daddy komt uit
`scripts/bigdaddy-master-compose.mjs`, dat master én beide maskers uit het
onderdelenblad `bigdaddy-onderdelen.webp` bouwt. Die drie composities zijn dus
wél reproduceerbaar. Voor de overige edities bevat de repository het
productie-WebP en een specificatie, maar geen gelaagd bronbestand uit een
beeldbewerkingspakket. Grote inhoudelijke
wijzigingen aan wolk of bliksem moeten daarom via een nieuwe
assetgeneratie/-bewerking gebeuren en vervolgens opnieuw op alpha,
resolutie, compressie en registratie worden gecontroleerd.

### Visuele kwaliteit blijft gedeeltelijk handmatig

DOM-tests kunnen bronidentiteit, montage en clipping bewaken. Ze kunnen niet
betrouwbaar vaststellen of een wolk “zwaar” leest of een frameonderbreking
natuurlijk oogt. De vaste screenshotworkflow blijft onderdeel van de
architectuur, niet alleen van de eenmalige ontwikkeling.

## 15. Definition of done voor een nieuwe breakout-card

Een nieuwe special card volgens dit patroon is pas gereed wanneer:

- de effectmassa zichtbaar binnen het kaartvlak begint;
- dezelfde massa achter het frame en buiten de kaart doorloopt;
- minstens één beperkt, organisch detail vóór het frame ligt;
- alle instanties dezelfde bron en transform gebruiken;
- het echte `var(--schild)` de inside-layer clipt;
- frame-einden nergens geometrisch afgesneden lijken;
- rating, avatar, naam en kaartteksten leesbaar blijven;
- kaart- en carousel-cells eigen stacking contexts hebben;
- geen horizontale documentoverflow ontstaat;
- desktop- en mobiele screenshots op vaste viewports zijn vergeleken;
- gerichte laagtests, lint, TypeScript-check, build en `git diff --check`
  slagen;
- eventuele afwijking tussen DOM- en canvas/posterweergave expliciet is
  vastgelegd.

De architectuur is daarmee geen storm-specifieke truc. Het is een
herhaalbaar compositingpatroon: één visuele bron, één register, meerdere
diepteselecties en een duidelijke eigenaar voor clipping.
