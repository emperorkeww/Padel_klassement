# Piet master artwork

`assets/piet-master.webp` is het enige live rasterartwork voor het
Piet-breakout-effect. Het is geen los gegenereerd beeld: het wordt
gereproduceerd uit `docs/referentie_zwarte_piet.png` door
[`scripts/piet-master.py`](../../../../../scripts/piet-master.py).

```bash
python3 scripts/piet-master.py
# met controlebeelden op donker én op perkament:
PIET_CHECK_DIR=/tmp/piet python3 scripts/piet-master.py
```

## Canvas en register

- Canvas: 1086 × 1448 px — het coördinatenstelsel van de referentie zelf.
- sRGB WebP met alpha, kwaliteit 78 (~560 kB).
- De kaartbox van de app ligt in dat stelsel op x[152, 936] en y[155, 1245].
  Daaruit volgen de drie CSS-waarden in `PietEffect.css`:
  `left: -19.39%`, `top: -14.22%`, `width: 138.52%`.
- Back, inside en front gebruiken exact dezelfde positie, breedte, schaal en
  rotatie. Een andere uitsnede vereist herberekening van alle drie én een
  hercontrole van `piet-front-mask.svg`.

## Wat er in zit

- De volledige ornamentring: zwarte rook met goudstof, complete speelkaarten,
  veren, zwart-gouden geschenken, twee zware stalen kettingtrajecten, de
  gevleugelde bovencrest met hoedsilhouet en de onderste rozet met
  geldbuidelmedaillon en lauwer.
- De binnenrook: de kolom die van de crest naar beneden loopt, en de rookkraag
  om de avatar.
- De stadssilhouet in het kaartvlak. Die vervangt het vectorwatermerk van de
  live kaart (`FutKaart.tsx` zet `motief` voor `editie === "piet"` op `null`);
  `PIET_WATERMERK` blijft de bron voor de canvas-/posterroute.
- Een randlijst — de gouden haarlijn met zijn donkere keyline — en een
  rookschaduw langs de onderste helft van het silhouet. Die twee zijn *niet*
  meegeërfd uit de referentie maar opnieuw opgezet op het afstandsveld van het
  échte app-schild. Zie hieronder.

## De vormen van referentie en kaart lopen uiteen

Dit is het punt waar het meeste werk zit. De referentiekaart heeft een ogeeboog
als bovenrand en een **vlakke onderrand**; het app-schild (`#fut-schild-notch`)
heeft een vlakke bovenrand en loopt vanaf 60% hoogte **naar een punt**. Die punt
op 50%/100% is structureel — het is het anker van de chemielijn in de Opstelling
— dus het schild wijkt niet.

Alles wat in de referentie de kaartrand markeert, loopt daardoor rechtdoor waar
de kaart schuin naar binnen gaat. Meeërven kan dus niet. Het script:

1. **verwijdert** de frameband van de referentie (een ring van ~50 px rond zijn
   kaartvlak), behalve waar een compleet ornament hem kruist — daar zou
   wegsnijden de kettingen, geschenken, crest of rozet doormidden knippen;
2. **tekent de randlijst opnieuw** vanuit `distance_transform_edt` van het
   app-schild. Het profiel is gemeten, niet verzonnen: het wordt uit de
   referentie zelf gehaald, langs de rechte zijkanten waar de lijst schoon vrij
   ligt. Alleen het bínnenste stuk van dat profiel wordt overgenomen — de kaart
   heeft zijn eigen frame met bone liner en zandkleurige keyline, en een tweede
   donkere band van 30 px daarbinnen maakt van die liner een felle witte streep
   tussen twee zwarte balken. Dat leest als een schermbezel, niet als een lijst;
3. legt een **rookschaduw** langs de onderste helft van het silhouet, ook vanuit
   het afstandsveld van het app-schild. Zonder die schaduw valt het gebied
   tussen de vlakke onderrand van de referentie en de punt van de kaart op als
   een rechthoekig donker plaatje: het is transparant, terwijl er net buiten wél
   rook staat. Een vulling die op het vlak van de *referentie* is begrensd geeft
   juist rechte randen op x=191 en y≈980 — de vorm van de bron, niet die van de
   kaart. De schaduw blijft licht (alfa 0,4): zwaarder vult hij de gaten tussen
   de kettingschakels en gaat de ketting als één donkere massa lezen;
4. **schuift de kettingen mee met de schuine rand.** In de referentie hangen ze
   langs een vlakke onderkant: ze lopen recht naar beneden en zwenken pas ónder
   de kaart naar binnen. Bij het app-schild staan die rechte trajecten vanaf 60%
   hoogte naast de kaart in de lucht. De onderste helft van de ring wordt daarom
   horizontaal meegetrokken met het verschil tussen de rand van het echte schild
   en die van het referentievlak (begrensd op 120 px, over een ramp van y 860 tot
   1170). Twee details die eruit volgden:
   - de verschuiving mag alléén van y afhangen. Loopt ze ook met x mee, dan rékt
     ze de schakels uit tot vegen; hangt ze alleen van y af, dan kantelen ze —
     en kantelen is precies wat een hangende ketting langs een schuine rand doet.
     Daarom is ze buiten het schild actief en binnen het schild nul: daar staat
     op die hoogte alleen kaartvlak, dus een harde sprong is onzichtbaar;
   - de volle afstand tot de rand geeft een helling van ~1,4 en dan smeren de
     schakels alsnog uit. Met de begrenzing blijft de helling ~0,45.

De ogeeboog van de referentie is dus niet overgenomen. Een eerdere versie deed
dat wel (de boog dekkend in het artwork, vóór het rechte frame gemaskerd) maar
dan sluit het artwork zichtbaar niet aan op de kaartrand.

## Wat er expres niet in zit

- Rating, divisiecijfer, vormemoji, naam, tier, editieregel en statblok. Twee
  sets zones, met verschillende begrenzing:
  - de zones van de **referentie** (die tekst zit in het bronbeeld ingebakken)
    worden op zijn kaartvlak geclipt — daar is de master toch al transparant,
    dus wissen kost niets;
  - de zones van de **app** (gemeten op `/dev/piet`, `--fut-kw: 450px`) worden
    op het app-schild geclipt. Buiten de kaart hóórt daar rook te staan, en een
    rechthoek die doorloopt tot buiten de punt slaat een zichtbaar recht gat.
  Daardoor is de master zelf content-veilig en is er geen apart binnenmasker:
  de inside-laag gebruikt het echte `clip-path: var(--schild)`.
- De avatarfoto van de referentie met zijn gouden ring, weggehaald op precies de
  buitenrand van die ring (gemeten: middelpunt 744/426, r 191). Eén pixel ruimer
  en de rook die de ring raakt sneuvelt mee — dan staat er een ring rook op
  afstand van de foto met perkament ertussen.

## De rookkraag om de avatar

De dikke zwarte rookkraag om de profielfoto is een van de sterkste kenmerken van
de referentie. Hij kan niet één op één worden overgenomen. De avatar van de kaart
staat lager en is kleiner (kaartrelatief 0,747 / 0,327 met r 0,178 tegenover
0,742 / 0,239 met r 0,227), en in de referentie *rákt* de foto de rechterrand van
de kaart — daar zit dus helemaal geen kraag, terwijl de kleinere avatar van de
kaart aan alle kanten ruimte heeft.

De rook wordt daarom met een **gelijkvormige warp** om de échte avatarpositie
gelegd, met de hóek intact: bron [191, 430] gaat naar doel [155, 349], en het
middelpunt van de warp is de avatar zelf. Daardoor komt de rook uit dezelfde
richting als in de referentie, waaiert hij radiaal vanaf de foto naar buiten, en
blijft leeg wat in de referentie leeg is — dik linksboven en links, een lob
erboven naar de crest, dun rechts (daar raakt de foto de kaartrand) en onderaan
nauwelijks, want daar begint de stadssilhouet.

Die asymmetrie is het punt. Een tussenversie legde één schone bronboog met een
driehoeksgolf over de volle 360° om de avatar. Dat sluit overal netjes aan, maar
levert precies wat het niet mag zijn: een gelijkmatige donut, die de cirkel juist
nóg meer als losstaand element laat lezen.

Vier dingen bleken daarbij nodig:

- **poorten op de bron.** De crest, de rechtergroep (veren, kaarten, geschenk) en
  de stadssilhouet worden uitgesloten — herkenbare objecten die er anders een
  tweede keer bij komen te staan. Een generieke detailpoort (`solid`) werkt hier
  níet: die dooft ook de rooklobben zelf, en dan blijft er boven de avatar niets
  over;
- **een smalle veiligheidsmarge langs de vlakrand** (6–26 px in plaats van
  26–54). Recht boven de avatar loopt de bron al na ~270 px tegen de ogeeboog
  aan; met de ruime marge viel juist de rook weg die naar de crest moet lopen;
- **de tekstzones van de app dempen pas ná de warp.** De dichtste rook van de
  referentie ligt onder het ratingblok; zat de demping er al in, dan kopieerde de
  warp verdunde rook naar de rand van de avatar — een bleke sluier precies waar
  het roet tegen de gouden rand hoort te zitten. De demping vloeit bovendien uit:
  een harde rechthoekrand tekent zich in dichte rook af als een lichte hoek, en
  dan zie je het kader in plaats van de rook;
- **een S-curve op de bemonsterde alfa.** Warp en resampling smeren de korte
  franje van de referentierook uit; zonder die curve leest het geheel als grijze
  waas in plaats van als roet.

De ingebakken rating van de referentie moet hiervoor écht weg zijn, niet half.
Zolang "1050" nog in de master stond, warpte deze stap er een tweede, verschoven
kopie van naast de avatar. En wordt alleen de letter*rand* gewist, dan blijven er
lettervormige gáten in de rook staan die net zo goed opvallen. Daarom: een
massieve donkerdrempel binnen de drie tekstkaders, en de gaten daarna in twee
passages (σ 34 en 12) dichttrekken met de rook eromheen.

Dat alles is bewerking in de asset, niet in CSS: de drie lagen blijven één bron
met één register.

**De avatarpositie hangt hieraan vast.** De kraag is om een specifieke cirkel
opgebouwd, dus de kaart moet zijn avatar daar ook zetten: kaartrelatief
0,747 / 0,327 met een diameter van 35,6% (schijf + de driedelige rand van
`PietEffect.css` sluit dan aan op de binnenrand van de kraag op r 0,194). Die
waarden staan in `PietEffect.css` en horen bij dít artwork. Wie de avatar
verplaatst of verkleint zonder `AV_APP` hier mee te veranderen, legt een strook
kaal perkament tussen de gouden rand en het roet.

## Waarop te controleren na een herbouw

1. Het controlebeeld **op perkament** (`check-licht.png`) — daar valt op of rook
   of lijst als bleke waas leest in plaats van als roet. Dat is de belangrijkste
   test; op zwart ziet bijna elke extractie er goed uit. Let specifiek op witte
   randen rond rooklobben: die ontstaan zodra de kleur níet
   voorgemultipliceerd wordt gefilterd.
2. Volgt de randlijst de kaart overal — bovenrand, zijkanten, en de taps
   toelopende onderkant tot in de punt?
3. Sluit de rookkraag aan tegen de avatarring, zonder perkament ertussen en
   zonder concentrische ringen?
4. Geen spookkopie van de referentietekst naast de echte tekst van de kaart, en
   geen rechte gaten in de rook buiten het kaartsilhouet.
5. Vaste screenshots op `/dev/piet`, desktop én mobiel
   (`scripts/piet-screenshot.sh`).
