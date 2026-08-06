# Zwarte Piet-artwork

De bron van waarheid is [`docs/referentie_zwarte_piet.png`](../../../../../docs/referentie_zwarte_piet.png)
(1086 × 1448): een gewatteerd donker paneel in een dubbele gouden lijst, met
daaromheen rook, goudstof, kettingen, kolen, een sterrenzak, een cadeau, een
staf met strik, veren, een crest met Piet-silhouet en een gevleugelde medaille.

Alle productie-assets worden reproduceerbaar gebouwd met:

```bash
python3.13 scripts/piet-onderdelen.py --preview
```

(`python3.13`, niet `python3` — de standaardinterpreter mist numpy/Pillow/scipy.)

| asset | inhoud | afnemer |
| --- | --- | --- |
| `piet-vlak.webp` | naadloze tegel van de gewatteerde ruit | kaartvlak (`PietEffect.css`, `.hero--piet`) |
| `piet-master.webp` | de gouden lijst plus alles buiten de kaart, mínus de voorwerpen die de lijst kruisen | achter- en binnenlaag van `PietEffect` |
| `piet-front.webp` | uitsluitend die kruisende voorwerpen | voorlaag van `PietEffect` |
| `piet-onderdelen.json` | maten, alfa, dekking, restmetingen en registratie | `pietAssets.test.ts` |

## Canvas en register

- Canvas: 1086 × 1448 px — het coördinatenstelsel van de referentie zelf.
- De kaartbox ligt daarin op x[146, 931] en y[133, 1224], gemeten door
  [`scripts/piet_schild.py`](../../../../../scripts/piet_schild.py). Daaruit
  volgen de drie registratiewaarden:
  `left: -18,60%`, `top: -12,19%`, `width: 138,34%`.
- Die drie staan op drie plekken — `piet-onderdelen.json`, `PietEffect.css` en
  `kaartMasters.ts` — en `pietAssets.test.ts` vergelijkt ze. Loopt er één weg,
  dan staat het artwork náást de kaart: in de DOM, op de poster, of allebei een
  beetje.
- Achter, binnen en voor gebruiken exact dezelfde positie, breedte, schaal en
  rotatie. Alleen de bron verschilt (master of front) en de clipping.

## Het schild komt uit dezelfde meting als het artwork

`piet_schild.py` drukt het pad af dat in `FutKaart.tsx` als `#fut-schild-piet`
staat, én levert diezelfde contour aan `piet-onderdelen.py`. Dat is de kern van
deze herbouw: omdat kaartclip en artwork op één contour staan, valt de gouden
lijst van het bronbeeld precies op de kaartrand. De vorige versie moest de
frameband van de referentie wegsnijden en opnieuw opbouwen op het afstandsveld
van het app-schild, omdat de toenmalige referentie een ogeeboog met vlakke
onderrand had en het schild een vlakke bovenrand met een punt.

De boogpunten zijn níet puur automatisch bepaald. Een goudmasker vindt hierboven
net zo goed de kettingen, de crest en de veren, en die liggen precies op de boog.
De reeks is met de hand gelegd en nageregeld met:

```bash
python3.13 scripts/piet_schild.py --overlay /tmp/piet-schild.png
```

tot hij overal net *binnen* de gouden band valt — binnen, want de lijst komt uit
het artwork en moet de kaartrand kunnen overlappen.

De onderkant loopt weer naar een punt op (0.5, 1) — het anker waar de chemielijn
in de Opstelling op mikt — maar laat en breed: het paneel blijft vol tot 80%
hoogte, want daar staan het statblok en de badge-rij van de referentie nog in.
Een taper vanaf 60%, zoals de gedeelde schilden hebben, snijdt die twee aan.

## Eén snede in plaats van een dozijn killzones

Het hele kaartvlak — alles meer dan een lijstbreedte (44 px) binnen het schild —
gaat uit het artwork. Daarmee verdwijnen rating, portret, kroon, naam, spreuk,
statblok en badge-rij van de referentie in één keer, en is de master per
constructie content-veilig. `piet-onderdelen.json` meet dat ook: `restVlak` van
de master hoort 0 te zijn.

Wat overblijft komt uit de tegel: het kaartvlak is sinds deze herbouw geen
CSS-verloop meer maar `piet-vlak.webp`, precies één periode van de watteernaad
(103 × 94 px, gemeten met autocorrelatie op een schone strook). De losse
goudspikkels in die uitsnede worden naar een mediaanversie toegetrokken —
anders komt dezelfde spikkel bij élke herhaling terug.

Twee blokken vallen búiten het vlak en gaan daarom apart weg: de chipstrip onder
de kaart (de app zet daar zijn eigen vormchips) en de badge-rij, die zo laag in
het paneel staat dat hij binnen een lijstbreedte van de onderrand valt.

## Atmosfeer achter, voorwerpen voor

De splitsing tussen master en front volgt de diepte van de referentie zelf:

- de **master** draagt de gouden lijst, de rook en het goudstof;
- de **front** draagt de voorwerpen die de lijst kruisen — crest, medaille,
  staf, cadeau, zak, kolen en kettingen.

Voorwerpen volgen daarbij hun eigen silhouet (afwijking tegenover een lokaal
achtergrondmodel), niet een handgetrokken contour: kettingen, kolen, staf en
cadeau hebben veel lokaal contrast, rook heeft dat niet. Zonder die
silhouetselectie blijven de donkere flanken van een schakel half doorzichtig en
kijk je dwars door de ketting heen.

Twee dingen die daaruit volgden:

- **de gouden lijst blijft in de master.** Hij is net zo massief als de
  voorwerpen, dus band × silhouet pakt hem anders gewoon mee — en dan wordt het
  frame vóór de kaartinhoud getekend en loopt de boog dwars door de rating. In
  de master landt hij via de binnenlaag juist ónder de tekst, waar hij hoort.
- **waar een voorwerp de lijst kruist gaat dat stukje voorwerp mee de master
  in.** Dat blijft kloppen: master en voorlaag delen één registratie, dus de
  ketting loopt zichtbaar door — alleen die paar pixels liggen een laag dieper,
  en daar ligt niets bovenop behalve de lijst waar ze toch al overheen gingen.
  Crest en medaille zijn uitgezonderd: die liggen in de referentie in hun geheel
  óp de lijst.

Er is geen frontmask meer (`piet-front-mask.svg` is vervallen): de fysiek
gescheiden voorgrondbron ís het masker. Hetzelfde contract als de Glazenwasser.

## De kaart geeft zijn eigen lijst op

Dit is de correctie waar het uiteindelijk op vastliep, en hij zit niet in het
artwork maar in de kaart eronder.

De gedeelde kaart bouwt zijn rand als vier geneste vlakken (`zijde` › `liner` ›
`keyline` › `vlak`), elk met een eigen padding en elk met
`clip-path: var(--schild)` op zíjn eigen doos. Op 450 px kaartbreedte is dat
samen ~7,9 px, dus het schild van het vlak is een paar procent kleiner dan dat
van de kaart. Het artwork is geregistreerd op de kaartdoos, dus de gouden lijst
werd binnen de kaart precies die paar procent te vroeg afgesneden — en in de
strook die overbleef schilderde de kaart zijn eigen donkere liner met een gouden
keyline erop. Dat leest als een tweede, dunnere lijst náást de echte.

`.fut-kaart--piet .fut-kaart__zijde--voor` zet die drie diktes daarom op nul.
Dan vallen de vier dozen samen, draagt het vlak het échte schild en landt de
lijst uit het artwork exact op de kaartrand. `--piet-master-inset` wordt daarmee
vanzelf 0. Alleen de vóórkant: de achterkant (statvlak) draagt geen artwork en
houdt zijn gewone gelaagde rand.

Om dezelfde reden zijn `--kaart-echo` en `--kaart-binnenlijn` van deze editie
verdwenen: de uitstekende onderplaat en de haarlijn binnen het vlak waren er
voor een kaart die zijn lijst zelf tekende.

De lijst moet daar dan ook dekkend zijn. Binnen het schild wordt de alfa in de
lijstring op een steilere key gezet; op de 0,85 die de gewone zwartkey gaf,
scheen de ruit er doorheen en las de lijst als een sluier over het paneel in
plaats van als metaal erop.

## De inhoud staat verder naar binnen

`.fut-kaart--piet .fut-kaart__vlak` heeft `padding: 21% 11,5% 16%` in plaats van
de gedeelde `12% 9% 24%`. Dat is geen smaak:

- **boven** hangt de crest met zijn punt tot v 0,146 over het paneel en duikt de
  ogeeboog aan de flanken tot v 0,115 het vlak in; op de gedeelde bovenpadding
  liep "1050" tegen allebei aan;
- **opzij** reikt de voorgrondband van het artwork tot 9,9% van de kaartbreedte
  naar binnen. Op de gedeelde 9% viel de eerste letter van de naam achter de
  kolen. De referentie doet hetzelfde: zijn titel en statblok lopen van u 0,13
  tot 0,90, niet van rand tot rand;
- **onder** loopt de kaart naar een veel bredere punt dan de gedeelde kaart, dus
  de 24% bodem liet een leeg stuk paneel staan.

## Avatarregister

De avatarpositie is gemeten, niet gekozen. De lichte portretschijf van de
referentie loopt over x[570, 854] met middelpunt 712/434 en straal 142; de
gouden ring eromheen tot straal 173. Kaartrelatief: middelpunt 0,721 breed en
0,384 (in kaartbreedtes), schijf 0,362 × kaartbreedte. Die drie waarden staan in
`PietEffect.css` als `--fut-avatar`, `--piet-avatar-rechts` en
`--piet-avatar-boven`.

Anders dan bij de vorige versie hangt het artwork er níet meer aan vast: de
rookkraag die om precies díe cirkel was opgebouwd zat in het oude kaartvlak, en
dat vlak is nu weg. Verplaatsen kost dus geen artworkfout meer, alleen afstand
tot de referentie.

## Waarop te controleren na een herbouw

1. Het controlebeeld van `--preview`: staat er nog tekst van de referentie op
   het kaartvlak, en zijn de onderdelen strak gesneden (geen witte franje langs
   rooklobben — die ontstaat zodra de kleur niet voorgemultipliceerd wordt
   gefilterd)?
2. Volgt de gouden lijst de kaart overal — bovenboog, zijkanten en de brede punt?
   Controleer met `piet_schild.py --overlay`.
3. Ligt de staf vóór de lijst en loopt de ketting door zonder zichtbare knip?
4. Blijven rating, naam, divisieregel en editieregel vrij van de voorlaag?
5. Vaste screenshots op `/dev/piet`, desktop én mobiel
   (`scripts/piet-screenshot.sh`), plus de kleine maten op `/dev/kaarten`.

## Bekende afwijking: canvas en poster

De canvasroute (`futKaartCanvas.ts`) tekent hetzelfde artwork, dezelfde kleuren
én sinds deze herbouw hetzelfde silhouet. `schildVorm()` kent alleen tiers, dus
de vorm komt hier uit het kleurregister: `FutKaartKleuren.vorm` mag de doorgegeven
vorm overschrijven, en de Piet zet `"piet"`. Zo hoeft geen enkele posteraanroep
zijn editie door te geven. Hetzelfde geldt voor `randDiktes: [0, 0, 0]` en
`vlakInzet`, de spiegels van de nul-randdiktes en de ruimere padding hierboven.

Wat wél verschilt: de avatar. De DOM zet hem absoluut op de gemeten
referentiepositie, de canvasroute houdt de gedeelde gridplek en zet hem daardoor
hoger en dichter tegen de rating. Dat verschil bestond al vóór deze herbouw; het
staat in
[`docs/special-card-visual-effects-architecture.md`](../../../../../docs/special-card-visual-effects-architecture.md)
§14.
