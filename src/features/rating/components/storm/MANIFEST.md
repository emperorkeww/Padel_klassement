# Asset-manifest — In-Form stormeffect (#834)

De storm van de In-Form kaart is opgebouwd uit losse transparante assets in
vier lagen (back → card → inside → front), gepositioneerd door
`InformStorm.tsx` + `InformStorm.css`. De `.svg`-bestanden in `assets/` zijn
**placeholders** voor de fotorealistische `.webp`-assets hieronder, behalve de
twee bliksems — die zijn definitief als SVG. Een aangeleverde webp vervangt de
placeholder door het bestand ernaast te zetten en de import in
`InformStorm.tsx` om te wijzen; posities/maten blijven staan (de CSS rekent in
procenten van de kaartstage).

Belichtingsconventie voor álle assets: de lichtbron is de **gouden bliksem**
in het kanaal tussen kaartrand en buitenmassa. Wolken zijn bijna-zwart
blauwgrijs (#0a0e18 → #2c3448); alleen randen en delen nabij de bliksem
lichten goud (#ffd97a) op. Nooit volledig gele wolken.

## Nog aan te leveren (webp, transparante achtergrond)

| Asset | Inhoud | Richtmaat | Licht |
|---|---|---|---|
| `storm-cloud-back-right.webp` | Grote volumetrische cumulonimbus, verticaal gestapeld (aambeeld boven, torens onder). Vormt de massa die rechts uit de kaart breekt. | ~800×1120, alpha | Van links (bliksemkanaal); gouden randlicht op linkerflank en lobtoppen |
| `storm-cloud-inside-right.webp` | Wolkenmassa voor ín het kaartvlak: dichte kant rechts, naar links uitrafelend in rook zodat de kaartinhoud vrij blijft. | ~640×960, alpha | Centraal (interne bliksem) |
| `storm-cloud-front-right.webp` | Drie losse, scherpere wolkendelen die vóór het gouden frame hangen; sterkste randlicht. | ~480×840, alpha | Van links, fel |
| `storm-cloud-bottom-left.webp` | Klein secundair wolkje voor linksonder. | ~520×400, alpha | Van rechts |
| `storm-glow-right.webp` | Zachte goudgele lichtvlek (alleen licht, geen vorm) — wordt met `mix-blend-mode: screen` over wolken en frame gelegd. | ~800×1120, alpha | n.v.t. |
| `storm-debris.webp` | Enkele kleine opgetilde brokstukken, goud belicht aan de bliksemzijde. Detail, geen hoofdonderwerp. | ~480×800, alpha | Van links |
| `storm-sparks.webp` | Vonken/gloeiende deeltjes rond de ontlading. | ~480×800, alpha | n.v.t. |

## Definitief (SVG)

- `lightning-back-right.svg` — hoofdbliksem met vertakkingen; vier strokes
  over hetzelfde pad (gloed 26 → band 11 → kern 4,5 → witheet hart 1,8).
- `lightning-front-right.svg` — kortere segmenten vóór het frame, zelfde
  recept.

## Lagen en montagepunten

1. **stormBackLayer** (`InformStormAchter`, vóór `.fut-kaart__zijde` in de
   DOM): glow → grote massa → hoofdbliksem → tweede massa-instantie onder →
   wolkje linksonder.
2. **cardLayer**: de bestaande kaart, ongewijzigd.
3. **stormInsideLayer** (`InformStormBinnen`, ín `.fut-kaart__vlak`, dus
   automatisch gemaskeerd met de exácte schildvorm via `clip-path:
   var(--schild)`): binnenmassa → interne bliksem → interne glow. Ligt vóór de
   vlakachtergrond maar ónder de kaartinhoud — tekst blijft leesbaar.
4. **stormFrontLayer** (`InformStormVoor`, ná `.fut-kaart__ornament--voor`):
   frameglow (screen) → voorste wolkendelen → voorste bliksem → debris →
   sparks.

Posities via CSS custom properties op `.fut-kaart--inform`
(`--storm-right-x/-y/-scale`, `--storm-front-x/-y`, `--lightning-x/-y`,
`--storm-left-x/-y`, `--frame-glow-opacity`) — allemaal procentueel t.o.v. de
kaartstage.

## Bekende beperking

De **deel-poster** (canvas, `futKaartCanvas.ts`) tekent een vector-benadering
van dezelfde storm (`INFORM_STORM_*` in `ornamentenInform.ts`): canvas kan de
geblurde webp-lagen en blend-modes niet 1-op-1 spiegelen zonder de
poster-pipeline async te maken. Zodra de definitieve webp's er zijn, kan de
poster desgewenst op `drawImage` van dezelfde assets over (follow-up).

## Debug

`/dev/storm?debugStorm=1` (alleen development) toont per laag een gekleurde
bounding box (rood = back, groen = inside, cyaan = front), labels en het
ankerpunt van elk asset.
