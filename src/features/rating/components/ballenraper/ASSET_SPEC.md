# Ballenraper artwork-register

De bron van waarheid is `docs/referentie_ballenraper.png`. Dynamische inhoud
(rating, subniveau, avatar, naam, titel en vijf eigenschappen) staat nooit in
een bitmap maar wordt door `DivisieVoorkant` gerenderd.

De tekstloze master is op het volledige kaartregister geplaatst:

- linkerzijde: `-10%`
- bovenzijde: `-7,2%`
- breedte: `120%`
- hoogte: `115,1%`

De broncanvas is `1086 × 1448`; bij 50% alpha liggen de zichtbare pixels in
`907 × 1224 +83 +22`. Het register compenseert dus de transparante canvasmarge
zonder `object-fit`-vervorming. De dev-stage gebruikt 84vw (maximaal 600px),
zodat de zichtbare kaart dezelfde schermvulling heeft als de referentie.

De volledige master staat rechtstreeks in het `binnen`-slot op de
`.fut-kaart__flipper`. Dat slot is hier bewust full-bleed en ongeclipt: het
artwork vormt zelf de buitenste kaartlaag. De generieke frame-, liner-,
keyline- en vlaklagen zijn voor Ballenraper transparante inhoudsdragers en
kunnen dus nergens als een tweede gouden shell door de alpha heen verschijnen.

Controleer de echte, dynamische kaart via `/dev/ballenraper`.
