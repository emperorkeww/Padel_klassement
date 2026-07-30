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

De mand en losse ballen zijn uitsneden uit dezelfde master. Ze gebruiken exact
hetzelfde register, maar staan in het voor-slot
zodat de onderdelen zichtbaar buiten het eigen Ballenraper-silhouet mogen
uitsteken. De bitmaplaag binnen het kaartvlak wordt door
`#fut-schild-ballenraper` geclipt.

Controleer de echte, dynamische kaart via `/dev/ballenraper`.
