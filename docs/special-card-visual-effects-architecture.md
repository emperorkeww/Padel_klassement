# Special Card Visual Effects Architecture

Dit document beschrijft de daadwerkelijk geïmplementeerde architectuur van
het In-Form-stormeffect en de daarop gebaseerde On Fire-vulkaanbreakout. Het
is tegelijk een technische naslag en een
herbruikbare blauwdruk voor special cards waarvan decoratie niet alleen ín de
kaart staat, maar ook achter de kaart verdwijnt en plaatselijk vóór het frame
komt.

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

Big Daddy wordt in de huidige code als de `icon`-editie behandeld en heeft
bestaande ornamenten, waaronder voorliggende details. Die ornamenten hoeven
niet vervangen te worden. De masterarchitectuur is aanvullend bruikbaar
voor bijvoorbeeld één doorlopende aura of rookmassa, mits het nieuwe effect
de bestaande frontornamenten en kaartinhoud respecteert.

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
`onfire-master.webp` en voor Dictator `dictator-master.webp`. De
canvas/posterroute in `futKaartCanvas.ts` tekent nog
`INFORM_STORM_ACHTER`, `INFORM_STORM_BINNEN` en `INFORM_STORM_VOOR` uit
`ornamentenInform.ts`, plus de oudere On Fire-pluimen/randvlammen uit
`ornamentenOnfire.ts` en de bestaande vectorornamenten van de Dictator.

Daarom is vorm- en lichtpariteit tussen live kaart en geëxporteerde poster
niet gegarandeerd. Een toekomstige verbetering kan:

- het WebP-masterwerk ook in de canvasrenderer laden en op dezelfde
  relatieve transform tekenen; of
- bewust twee renderers behouden, maar ze met aparte referentiescreenshots
  en expliciete tolerantie testen.

Tot die keuze is gemaakt, mogen de vectortests niet als bewijs voor de
live WebP-composities worden gebruikt.

### Legacy-SVG's zijn nog aanwezig

De losse oudere stormassets zijn niet verwijderd. Ze kunnen verwarring
veroorzaken bij codezoekopdrachten. `MANIFEST.md` is daarom de bron van
waarheid voor de huidige browsercompositie.

### Het master-artwork is een afgeleid rasterasset

De repository bevat het productie-WebP en een specificatie, maar geen
gelaagd bronbestand uit een beeldbewerkingspakket. Grote inhoudelijke
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
