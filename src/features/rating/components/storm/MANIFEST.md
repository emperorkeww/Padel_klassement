# Asset-manifest — In-Form stormeffect (#834)

De browsercompositie gebruikt één bronbestand:
`assets/in-form/storm-master.webp`. `InformStorm.tsx` rendert ditzelfde
artwork drie keer met exact dezelfde CSS-positie, schaal en rotatie:

1. volledig achter kaart en frame;
2. binnen `.fut-kaart__vlak`, gemaskeerd door het bestaande dynamische
   `clip-path: var(--schild)`;
3. vóór het frame, beperkt door `storm-front-mask.svg`.

De binnenlaag gebruikt bewust geen statisch `card-interior-mask.svg`: de
bestaande `var(--schild)` is het exacte kaartmasker en ondersteunt ook de
verschillende responsive schildvarianten. Een los SVG-masker zou daarvan
kunnen afwijken.

Alle geometrie komt uitsluitend uit deze gedeelde properties op
`.fut-kaart--inform`:

```css
--storm-master-left: 25%;
--storm-master-top: -16%;
--storm-master-width: 110%;
--storm-master-scale: 1;
--storm-master-rotate: 0deg;
```

De oude losse wolk-, glow-, bliksem-, puin- en vonkassets in `assets/`
worden niet meer door de React-compositie gebruikt.

Zie `STORM_MASTER_SPEC.md` voor de reproduceerbare art-direction en
technische eisen van het masterbestand.
