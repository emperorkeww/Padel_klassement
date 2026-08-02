# Glazenwasser-artwork

Eén doorlopend referentie-artwork met twee afnemers:

| asset | afnemer | script |
| --- | --- | --- |
| `gw-ring.webp`, `gw-glasvlak.webp`, `gw-strip-*.webp` | `GlazenwasserKaart` (kaart-modal, `/dev/glazenwasser`) | `scripts/glazenwasser-onderdelen.py` |
| `glazenwasser-master.webp` + `glazenwasser-front-mask.svg` | `GlazenwasserEffect` op `FutKaart` (klassement, opstelling, legenda) | `scripts/glazenwasser-onderdelen.py` |

Alles wordt gegenereerd uit
[`docs/fut-kaarten/referentie_glazenwasser.png`](../../../../../docs/fut-kaarten/referentie_glazenwasser.png).
Het script is de bron van waarheid: bij een gewijzigde referentie of een andere
uitsnede draai je het opnieuw in plaats van een WebP met de hand bij te werken.

```bash
python3 scripts/glazenwasser-onderdelen.py --preview
```

## De herbouw: alles in één doek

Sinds de herbouw worden er géén voorwerpen meer uitgesneden en teruggeplakt.
Elke knip was een naad: een gat dat gevuld moest worden, een voorwerp dat los op
de kaart kwam te staan, een contactschaduw die nagebouwd moest worden — terwijl
de referentiepixels dat allemaal al dragen. De lagen zijn nu:

| bestand | inhoud |
| --- | --- |
| `gw-ring.webp` | het volledige artwork op kaartverhouding: lijst, ijs, crest, trekker, ophanging met emmer, ondergroep en waterexplosie — ingebakken zoals de referentie ze monteert. Binnen de glascontour blijft alleen wat óp het glas ligt (water, voorwerpen met krappe marge); de ingebakken kaarttekst is eruit. |
| `gw-glasvlak.webp` | het natte glas op kaartmaat: toonveld, condens, druppels en waterstrepen, samengesteld uit uitsluitend schone referentiedelen (`glasvlak()`). |
| `gw-strip-trekker/-emmer/-ondergroep.webp` | drie zones uit exact het ringdoek, nóg een keer geplaatst bóven de kaartinhoud — de voorwerpen horen vóór de tekst (de emmer hangt over de statkolom). Zelfde pixels op dezelfde plek, dus per constructie naadloos. Krap gesneden: elke rij te veel dekt kaarttekst af. |
| `gw-glas.webp` | geweven glastegel (92 × 160 px schoon glas) — weef-ingrediënt voor de tekstvulling in de ring. |

De kaart is hoger dan de referentie (100:139 tegen 0,875), dus de ring wordt
verticaal stuksgewijs herbemonsterd (`_naar_kaart_y`). De flankzones met een
massief voorwerp — trekker en emmer — krijgen daarbij een eigen kolomband met
een aspect-behoudende helling over de hoogte van het voorwerp; het rek gaat naar
het glas en de rail erboven en eronder, waar het als extrusie onzichtbaar is.
Buiten de middenzone (0,15–0,85) volgt elke band exact de globale afbeelding,
zodat kap, schouders, punt en waterrand aan de bandgrenzen niet verspringen.

Wat blijft gelden: **kaartinhoud van de referentie is verboden gebied** —
rating, subniveau, avatarcirkel, glaslat, naam, divisieregel, statblok en het
losse raampje zitten in het bronbeeld ingebakken en gaan er via `INHOUD` uit,
met een vulling die verticaal doorloopt (`inpaint_verticaal`): rails en
glasstrepen zijn verticale structuren.

## De master (`glazenwasser-master.webp`)

> Deze master komt uit `scripts/glazenwasser-onderdelen.py`
> (`compacte_master()`) en wordt opgebouwd uit dezelfde ring en hetzelfde
> glasvlak als de brede kaart, zodat wat spelers in de app zien hetzelfde
> artwork is. Het kaartvak in dit doek heeft dezelfde 100:139 als het stelsel
> van de ring, dus de lagen gaan er één op één in. Twee verschillen met de
> brede kaart, beide voor de leesbaarheid van FutKaart-tekst: de waterexplosie
> blijft beperkt tot onder 80% kaarthoogte mét een heldere zone achter de
> divisieregel, en het voormasker (raster-alfa uit de compositie, met een écht
> transparant gat boven het kale glas) bepaalt wat de voor-laag over de
> kaartinhoud mag tonen.

De compacte kaart in het klassement blijft de drie-lagenbreakout gebruiken: één
master op drie diepten, met `glazenwasser-front-mask.svg` als voorselectie. Canvas
1024 × 1440, kaartvak x 72..952 / y 160..1383 — dat volgt exact uit
`--glazenwasser-master-left: -8.18%`, `--glazenwasser-master-top: -13.08%` en
`--glazenwasser-master-width: 116.36%` in `GlazenwasserEffect.css`. Wijzigt een van
die drie, dan moet het canvas opnieuw worden opgebouwd; het script rekent ze uit
dezelfde constanten en print ze.
