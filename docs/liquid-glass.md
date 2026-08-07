# Liquid Glass-materiaal

> Issue [#1062](https://github.com/emperorkeww/Padel_klassement/issues/1062).
> Bekijk het levend op `/dev/glas` (alleen in development).

Eén gedeeld doorschijnend materiaal voor navigatiebalken, overlays, panelen en
knoppen. Het benadert het karakter van Apple's Liquid Glass met
browsertechniek — het ís dat materiaal niet, zie [Wat er mist](#wat-er-mist).

## Hoe het in elkaar zit

Het materiaal is **CSS-eerst**. `src/components/ui/glas.css` definieert een
class `.glas` met varianten en vormen; `LiquidGlass.tsx` is een dunne wrapper
die diezelfde classes samenstelt.

Dat onderscheid is opzettelijk. Bestaande vlakken (`.topbar`, `.tabbar`,
`.sheet`, `.card--next`) krijgen de classes er gewoon bij — een extra element
eromheen zou hun layout veranderen. Voor nieuw werk is het component handiger,
omdat dat ook de inhoudslaag en de aanwijzer-hook meebrengt.

De grondstof staat als tokens in `src/app/index.css`, per thema:

| Token | Betekenis |
|---|---|
| `--glas-tint` | rgb-kanalen van het materiaal zelf |
| `--glas-glans` | rgb-kanalen van rand- en aanwijzerlicht |
| `--glas-diep` | rgb-kanalen van de binnenschaduw |
| `--glas-dekking-basis` | hoeveel materiaal dit thema wil |
| `--glas-blur-basis` | hoe wazig dit thema wil |
| `--glas-glans-kracht` | hoe hard het randlicht mag aanzetten (donker: zwakker) |
| `--glas-saturatie`, `--glas-helderheid` | de rest van de backdrop-filter |
| `--glas-sheet-factor` | wat het sheet van de basisdekking afneemt |
| `--overlay-glas` | de scrim onder een glazen paneel |
| `--glas-vast` | ondoorzichtige terugval |

**Dekking en blur zijn een basis, geen eindwaarde** (#1083). De varianten
hieronder drukken er een *verhouding* op uit — `.glas--sterk` is
`calc(var(--glas-dekking-basis) * 0.93)` en niet `0.8`. Dat is geen stijlkeuze
maar een reparatie: een custom property die op het element zelf staat wint
altijd van dezelfde property op `:root`. Zolang elke variant er een kaal getal
neerzette, kon een thema het materiaal helemaal niet bijstellen — de donkere
`--glas-dekking: 0.8` uit #1062 kwam nergens aan en donker draaide gewoon op de
lichte dekking. Zet dus nooit een getal neer waar een basis-token bestaat;
`glas.contract.test.ts` bewaakt dat.

Om dezelfde reden heeft een vlak dat het materiaal bijstelt **gewicht** nodig:
`glas.css` komt ná `ui.css` in de cascade, dus `.sheet { --glas-dekking: … }`
verliest van `.glas--sterk` en doet niets. Het sheet stelt zichzelf daarom bij
vanuit `.sheet.glas`.

De lagen, van achter naar voor: geblurde backdrop → materiaalverloop →
binnengloed en diepte (inset-schaduwen) → refractierand (`::before`) →
hooglicht (`::after`) → inhoud (`.glas__inhoud`).

## Gebruik

```tsx
import { LiquidGlass } from "@/ui/LiquidGlass";

<LiquidGlass variant="standaard" vorm="paneel">
  <VolgendeMatch />
</LiquidGlass>;

<LiquidGlass as="button" type="button" variant="interactief" vorm="pil">
  Jouw positie
</LiquidGlass>;
```

Of, op een bestaand vlak, alleen met classes:

```css
.tabbar {
  /* … bestaande layout … */
}
```

```tsx
<nav className="tabbar glas glas--sterk">…</nav>
```

### Varianten

| Variant | Waarvoor | Blur |
|---|---|---|
| `subtiel` | grote vlakken en achtergronden | 8px |
| `standaard` | kaarten en panelen | 16px |
| `sterk` | overlays en zwevende navigatie | 22px |
| `interactief` | knoppen en chips | 16px |

### Vormen

`paneel` (radius `--radius-lg`), `pil` (999px), `cirkel` (50%) en `eigen` — die
laatste laat de afronding aan het element zelf, voor bestaande vlakken met hun
eigen hoeken.

### Extra modifiers

- `glas--scrollbaar` — voor een vlak met `overflow-y: auto`. Absoluut
  gepositioneerde lagen schuiven daar mee met de inhoud, dus `::before` en
  `::after` gaan uit en het randlicht komt uit inset-schaduwen, die wél op de
  border-box blijven staan. Twee hoekschaduwen benaderen het verloop van
  `::before` — sterk linksboven en rechtsonder, zwak langs de flanken — en de
  buitenhaarlijn staat er los bij, want deze `box-shadow` overschrijft die van
  `.glas` volledig. Let op: hier werkt `glas--levend` dus niet.
- `glas--balk` — voor een navigatiebalk van schermrand tot schermrand: geen
  afronding, geen zijranden, geen haarlijn rondom. De rand naar de pagina toe
  zet de balk zelf.
- `glas--levend` — laat het hooglicht zien zónder aanwijzer. Het hooglicht van
  `glas--interactief` hangt aan hover, en hover bestaat op een telefoon niet;
  op een mobile-first app bleef daarmee alleen rand en blur over. Zwakker dan de
  hover-stand, want dit staat altijd aan. Zonder verdere hulp is het een
  stilstaande glans; met `useGlasScrollLicht` loopt hij mee (zie hieronder).

### Licht dat op een telefoon ook bestaat

`useGlasAanwijzer` laat het hooglicht de muis volgen en geeft op een grove
aanwijzer lege handlers terug. `useGlasScrollLicht` is de tegenhanger voor
vlakken die vaststaan terwijl de pagina eronderdoor schuift: hij zet
`--glas-aanwijzer-x` op de voortgang door het document, zodat het licht één
keer over het vlak trekt van boven naar beneden.

```tsx
const topbarRef = useGlasScrollLicht<HTMLElement>();

<header className="topbar glas glas--sterk glas--balk glas--levend" ref={topbarRef}>
```

Zelfde afspraken als de aanwijzer-hook: rechtstreeks op het element schrijven
(nul rerenders), hoogstens één keer per frame, passieve listener. Met
`prefers-reduced-motion: reduce` komt er geen listener en blijft het licht op de
rustpositie staan — `glas--levend` geeft dan nog steeds een stilstaande glans.
Past de pagina in beeld, dan is er niets te volgen en hangt het licht in het
midden; een licht dat dan in de hoek blijft staan zou als een fout lezen.

### Een eigen kleur meebrengen

`--glas-laag` is een laag vóór het materiaal, standaard leeg. Zo hoeft niemand
de materiaalformule te kopiëren om er iets overheen te leggen:

```css
.card--next {
  --glas-laag: radial-gradient(
    110% 130% at 0% 0%,
    color-mix(in srgb, var(--accent) 14%, transparent) 0%,
    transparent 55%
  );
}
```

Houd die laag doorschijnend. Een dekkende laag maakt van het glas weer een
gewone kaart — behalve waar dat expres is, zoals bij de positie-chip hieronder.

### Waar het materiaal zich koest houdt

Twee dingen die `.glas` bewust *niet* met gewicht oplegt, omdat het bestaande
vlakken zou breken:

- **`position`** staat in een `:where(.glas)`, dus zonder gewicht. `.glas` komt
  ná `ui.css` in de cascade; met gewicht zou de zwevende "Jouw positie"-knop
  (`position: fixed`) gewoon terugvallen in de pagina.
- **`overflow: hidden`** hangt aan de vórm-modifiers, niet aan `.glas`. De
  onderbalk heeft een bal die bewust bóven de balk uitsteekt.

De decoratieve lagen staan om dezelfde reden op `z-index: -1`: de meeste
vlakken dragen alleen de classes en hebben geen `.glas__inhoud`, dus hun tekst
staat er los in. Binnen de eigen stapelcontext schildert een laag op -1 wél
over de achtergrond van het vlak, maar niet over die tekst.

## Toegankelijkheid

- **Terugval zonder `backdrop-filter`** (`@supports not …`): een dicht vlak in
  `--glas-vast` met een `--line-strong`-rand. Nooit halftransparant zónder
  blur — dan leest de tekst van de pagina dwars door de inhoud heen.
- **`prefers-reduced-transparency: reduce`** en **`prefers-contrast: more`**:
  hetzelfde dichte vlak, en de decoratieve lagen gaan uit.
- **`prefers-reduced-motion`**: alle overgangen staan achter
  `no-preference`, conform de rest van de repo. Er zijn geen keyframes.
- **Focus**: `.glas--interactief:focus-visible` krijgt een
  `outline: 2px solid var(--focus-ring)`, los van de glasrand — die verandert
  namelijk al bij hover en is dus geen betrouwbaar focussignaal. `--focus-ring`
  en niet `--accent`: sinds #1074 wijst dat token op donker naar `--lime`, waar
  het accent te weinig van het glas afsteekt.
- **Uitgeschakeld**: `aria-disabled`, doffer materiaal, geen hooglicht, geen
  indrukbeweging.
- Status wordt nooit alléén met transparantie aangegeven.

Contrast van tekst óp glas is niet door CI te bewaken:
`scripts/contrast-check.mjs` rekent met hex-tokens en het glasvlak hangt af van
wat eronder ligt. Meet het daarom op `/dev/glas`, waar het materiaal op zes
achtergronden naast elkaar staat.

## De valkuil: opacity in de buurt van glas

Een element met `opacity < 1` — ook maar even, in een animatie — is een
**backdrop root**. Wat daarbinnen staat kan niet meer voorbij die grens kijken,
en Chrome houdt die laag ook ná de animatie vast. Een `backdrop-filter`
erbinnen doet dan letterlijk niets: het vlak wordt alleen doorschijnend, zónder
blur, en de pagina leest er scherp doorheen.

Het sheet liep er meteen tegenaan: zowel de scrim (`sheet-fade`) als het paneel
(`sheet-up`) vervaagde via `opacity`. Beide animaties zijn daarom omgebouwd —
de scrim vervaagt nu via zijn `background-color`, het paneel schuift alleen nog
omhoog. `Sheet.test.tsx` bewaakt dat, want in jsdom is het onzichtbaar en in de
browser zie je het pas als het glas al kapot is.

Zet dus geen `opacity`-animatie op een glasvlak of op een van zijn voorouders.
Moet er iets vervagen, doe het dan op een laag die het glas niet omsluit.

## Performance-afwegingen

- `backdrop-filter` is de dure kant. Daarom: geen stapels geblurde lagen over
  elkaar, en op vaste balken (die bij elke scrollframe opnieuw blurren) blijft
  de blur bewust laag.
- `backdrop-filter` en `filter` worden **nooit** geanimeerd. Alleen `opacity`,
  `transform` en — eenmalig bij hover — `box-shadow`.
- Het aanwijzer-hooglicht loopt buiten React om: `useGlasAanwijzer` schrijft
  `--glas-aanwijzer-x/y` rechtstreeks op het element, hoogstens één keer per
  `requestAnimationFrame`. Muisbewegingen kosten dus geen enkele rerender.
- Op aanraakschermen (`(hover: hover) and (pointer: fine)` is onwaar) geeft de
  hook lege handlers terug: geen listener, geen werk.
- `useGlasScrollLicht` doet hetzelfde voor de scrollpositie: één passieve
  listener per vlak, gedempt op `requestAnimationFrame`, en met een
  bewegingsvoorkeur helemaal geen listener. Hij hangt alleen op de twee vaste
  balken, die tijdens scrollen tóch al opnieuw geschilderd worden.
- `will-change` staat er bewust niet op. Dat pas toevoegen als een profiel laat
  zien dat het helpt.

### Wat de app er nu voor betaalt

Zeven glasvlakken, waarvan er hooguit drie tegelijk in beeld staan:

| Vlak | Variant | Blur | Kost per frame? |
|---|---|---|---|
| `.topbar` (mobiel) | sterk + balk + levend | 14px | ja, plakt tijdens scrollen |
| `.tabbar` (mobiel) | sterk + balk + levend | 14px | ja, staat vast tijdens scrollen |
| `.sheet` | sterk + scrollbaar | 16px | alleen zolang hij open is |
| `.wizard-footer` | sterk + balk | 22px | alleen in de poll-wizard |
| `.card--next` | standaard | 16px | nee, scrollt gewoon mee |
| `.me-chip` | interactief + pil | uit | nee |

De twee balken zijn de enige die de blur elke scrollframe opnieuw laten
uitrekenen; daarom staan ze op 14px in plaats van de 22px die `sterk` normaal
geeft. Het sheet zakte in #1083 van 22 naar 16px, maar om een andere reden: op
22px bleef er van de pagina eronder geen herkenbare vorm over. Op de
positie-chip staat de blur helemaal uit: die heeft een dekkende vulling, dus er
zou toch niets van te zien zijn.

De selectiebalk van de poll-wizard is de enige geneste blur in de app: hij zit
ín een sheet dat zelf al `backdrop-filter` draagt. Dat is geen verspilde laag —
een element met `backdrop-filter` is zelf een backdrop root, dus de balk frost
de wizard-inhoud die eronderdoor scrollt plus het materiaal van het sheet. Hij
bestaat alleen zolang de wizard open staat.

Waar meerdere glasvlakken elkaar overlappen — een geopend sheet boven de
balken — kost dat geen dubbele blur: de balken vallen onder de scrim en worden
gewoon meegeblurd als achtergrond.

### De uitzondering: dekkend glas op de positie-chip

De "Jouw positie"-chip draagt het materiaal, maar met een **dekkende**
accentvulling. Wit op `--accent` haalt net AA; laat je daar ook maar tien
procent achtergrond doorheen schijnen, dan zakt het eronder. Op zo'n vlak zit
het glas dus in de rand, het hooglicht en de indrukbeweging — niet in de
doorkijk. Dat is de regel, niet de uitzondering: leesbaarheid wint van
transparantie, en dat is precies wat de `@media`-terugvallen ook doen.

## Wat er mist

Dit is een benadering, geen port. Ten opzichte van het native Liquid Glass van
Apple ontbreekt:

- **Echte refractie.** Het native materiaal buigt het beeld erachter; hier is
  het een blur met een verlopende rand die refractie *suggereert*. Een
  SVG-`feDisplacementMap` zou dichterbij komen, maar is in Safari en Firefox
  onvoorspelbaar en duur, en op onze achtergronden (effen kleur en zachte
  verlopen) is er nauwelijks iets om te vervormen. Bewust niet gebouwd.
- **Reactie op de omgeving.** Native glas reageert op de systeemverlichting en
  op beweging van het toestel. Hier zijn er twee vervangers — de muispositie en,
  sinds #1083, de scrollpositie — maar geen van beide is de omgeving. Van het
  toestel zelf weten we niets: `deviceorientation` zou dichterbij komen, maar
  vraagt op iOS een permissieprompt en is dat voor een glans niet waard.
- **Specular highlights per rand.** De rand is één verlopende ring, geen
  per-hoek berekend lichtpunt.
- **Compositor-integratie.** Het native materiaal is gratis voor de GPU omdat
  het in de systeemcompositor zit; hier betaalt de pagina voor elke blur.
