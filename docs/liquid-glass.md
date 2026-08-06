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
| `--glas-dekking` | basisdekking van het materiaal |
| `--glas-glans-kracht` | hoe hard het randlicht mag aanzetten (donker: zwakker) |
| `--glas-blur`, `--glas-saturatie`, `--glas-helderheid` | de backdrop-filter |
| `--glas-vast` | ondoorzichtige terugval |

De lagen, van achter naar voor: geblurde backdrop → materiaalverloop →
binnengloed en diepte (inset-schaduwen) → refractierand (`::before`) →
aanwijzer-hooglicht (`::after`) → inhoud (`.glas__inhoud`).

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
  gepositioneerde lagen schuiven daar mee met de inhoud, dus het randlicht komt
  uit een inset-schaduw die wél op de border-box blijft staan.

## Toegankelijkheid

- **Terugval zonder `backdrop-filter`** (`@supports not …`): een dicht vlak in
  `--glas-vast` met een `--line-strong`-rand. Nooit halftransparant zónder
  blur — dan leest de tekst van de pagina dwars door de inhoud heen.
- **`prefers-reduced-transparency: reduce`** en **`prefers-contrast: more`**:
  hetzelfde dichte vlak, en de decoratieve lagen gaan uit.
- **`prefers-reduced-motion`**: alle overgangen staan achter
  `no-preference`, conform de rest van de repo. Er zijn geen keyframes.
- **Focus**: `.glas--interactief:focus-visible` krijgt de gewone
  `outline: 2px solid var(--accent)` uit `ui.css`, los van de glasrand — die
  verandert namelijk al bij hover en is dus geen betrouwbaar focussignaal.
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
- `will-change` staat er bewust niet op. Dat pas toevoegen als een profiel laat
  zien dat het helpt.

## Wat er mist

Dit is een benadering, geen port. Ten opzichte van het native Liquid Glass van
Apple ontbreekt:

- **Echte refractie.** Het native materiaal buigt het beeld erachter; hier is
  het een blur met een verlopende rand die refractie *suggereert*. Een
  SVG-`feDisplacementMap` zou dichterbij komen, maar is in Safari en Firefox
  onvoorspelbaar en duur, en op onze achtergronden (effen kleur en zachte
  verlopen) is er nauwelijks iets om te vervormen. Bewust niet gebouwd.
- **Reactie op de omgeving.** Native glas reageert op de systeemverlichting en
  op beweging van het toestel. Hier is er alleen een hooglicht dat de muis
  volgt, en op mobiel dus niets.
- **Specular highlights per rand.** De rand is één verlopende ring, geen
  per-hoek berekend lichtpunt.
- **Compositor-integratie.** Het native materiaal is gratis voor de GPU omdat
  het in de systeemcompositor zit; hier betaalt de pagina voor elke blur.
