# On Fire master — assetcontract

- Bron: `assets/onfire-master.webp`
- Huidig canvas: 1024 × 1536 px, 2:3, sRGB WebP met alpha
- Eén ondeelbaar artwork voor back, inside en front
- Zwaartepunten: lavabrokken links, vulkaan rechtsmidden, rook rechtsboven,
  verbonden lavabed onderaan
- Open corridor in het midden voor rating, avatar en naam
- Bijna zwart basalt en houtskoolrook; oranje lava; wit-geel alleen bij de
  eruptiekern
- Geen kaart, frame, tekst, icoon, medaillon of rechthoekige achtergrond

Alle instanties gebruiken uitsluitend:

```css
--onfire-master-left: -16%;
--onfire-master-top: -24%;
--onfire-master-width: 132%;
--onfire-master-scale: 1;
--onfire-master-rotate: 0deg;
```

`onfire-front-mask.svg` deelt de 1024 × 1536-viewBox en selecteert twee
basaltzones links en één beperkte eruptiezone rechts. De inside-instantie
gebruikt geen statisch kaartmasker: `.fut-kaart__vlak` en `var(--schild)` zijn
de bron van waarheid.
