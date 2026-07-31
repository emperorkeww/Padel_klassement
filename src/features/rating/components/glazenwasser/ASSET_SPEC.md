# Glazenwasser-artwork

Twee generaties artwork naast elkaar, met elk hun eigen afnemer:

| asset | afnemer | script |
| --- | --- | --- |
| `gw-*.webp` — losse onderdelen | `GlazenwasserKaart` (kaart-modal, `/dev/glazenwasser`) | `scripts/glazenwasser-onderdelen.py` |
| `glazenwasser-master.webp` + `glazenwasser-front-mask.svg` | `GlazenwasserEffect` op `FutKaart` (klassement, opstelling, legenda) | `scripts/glazenwasser-master.py` |

Beide worden gegenereerd uit
[`docs/fut-kaarten/referentie_glazenwasser.png`](../../../../../docs/fut-kaarten/referentie_glazenwasser.png).
Die scripts zijn de bron van waarheid: bij een gewijzigde referentie of een andere
uitsnede draai je ze opnieuw in plaats van een WebP met de hand bij te werken.

```bash
python3 scripts/glazenwasser-onderdelen.py --preview   # losse onderdelen + contactblad
python3 scripts/glazenwasser-master.py --preview       # master + voormasker
```

## De losse onderdelen (`gw-*.webp`)

Elk onderdeel is een eigen, strak op zijn alfa bijgesneden WebP — geen
transparante rand, geen gedeeld canvas. Dat is het verschil met de master: die is
één platte compositie, dus elke rechthoekige uitsnede eruit sleepte de buren en de
natte-glastextuur mee. Losse onderdelen kunnen los worden geschaald, gedraaid en
geplaatst.

| bestand | inhoud | plek in de referentie (fractie van het kaartvak) |
| --- | --- | --- |
| `gw-crest.webp` | raamcrest met koperen raam | 0,408 · −0,081 · 0,172 × 0,142 |
| `gw-trekker-boven.webp` | trekker met blad, ferrule, steel en schuim | −0,017 · 0,365 · 0,325 × 0,271 |
| `gw-ophanging.webp` | haak met ketting | 0,870 · 0,189 · 0,116 × 0,336 |
| `gw-emmer.webp` | sopemmer met beugel, schuim en druppels | 0,802 · 0,413 · 0,194 × 0,238 |
| `gw-water-onder.webp` | waterexplosie, schuim en zeepbellen over de volle breedte | −0,013 · 0,688 · 1,028 × 0,338 |
| `gw-badge.webp` | onderschild met raamicoon | 0,345 · 0,808 · 0,289 × 0,186 |
| `gw-trekker-onder.webp` | tweede trekker | 0,337 · 0,740 · 0,404 × 0,207 |
| `gw-schuim-links/rechts.webp` | ijs en schuim over de bovenhoeken | −0,001 / 0,693 · −0,026 |
| `gw-glas.webp` | natte glaswand: strepen, condens, druppels | 0,109 · 0,052 · 0,780 × 0,582 |

Drie regels die het script afdwingt en die bij een volgende kaart terugkomen:

- **kaartinhoud van de referentie is verboden gebied.** Rating, subniveau,
  avatarcirkel, glaslat, naam, divisieregel, statblok en het losse raampje zitten
  in het bronbeeld ingebakken. `INHOUD` snijdt ze uit élk onderdeel, anders staat
  er een spookkopie naast de echte tekst;
- **een onderdeel dat als eigen asset terugkomt, hoort niet in de uitsnede van
  zijn buurman.** `water-onder` wordt daarom gesneden mét de badge en de tweede
  trekker eruit (`zonder=`), en `gw-glas.webp` zonder álle voorwerpen. Zonder dat
  verschijnt elk onderdeel twee keer zodra de lagen los worden geplaatst;
- **massieve voorwerpen volgen hun eigen silhouet, niet de handgetrokken lijn.**
  Binnen de contour bepaalt de afwijking tegenover een lokaal achtergrondmodel
  welke pixels bij het voorwerp horen, met gaten dicht (`vul_gaten`). Een dunne
  steel vraagt daarbij een fijnere ontkorreling (`korrel=1`) — op de grove stand
  knipte hij de steel van de trekker weg.

De plek van elk onderdeel op de kaart staat in `glazenwasserLayout.ts`; de `doos`
hierboven is het vertrekpunt, `schaal` en `verzet` daarin zijn de bewuste
afwijkingen (grotere crest, lagere trekker, emmer verder over de rand).

## De master (`glazenwasser-master.webp`)

De compacte kaart in het klassement blijft de drie-lagenbreakout gebruiken: één
master op drie diepten, met `glazenwasser-front-mask.svg` als voorselectie. Canvas
1024 × 1440, kaartvak x 72..952 / y 160..1383 — dat volgt exact uit
`--glazenwasser-master-left: -8.18%`, `--glazenwasser-master-top: -13.08%` en
`--glazenwasser-master-width: 116.36%` in `GlazenwasserEffect.css`. Wijzigt een van
die drie, dan moet het canvas opnieuw worden opgebouwd; het script rekent ze uit
dezelfde constanten en print ze.
