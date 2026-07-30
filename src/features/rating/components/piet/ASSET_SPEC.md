# Piet master artwork

`assets/piet-master.webp` is het enige live rasterartwork voor het
Piet-breakout-effect.

- Canvas: 1024 × 1536 px (2:3), sRGB WebP met alpha.
- Transparantie: volledig transparante achtergrond; rook mag gedeeltelijke
  alpha aan de buitenrand houden.
- Register: back, inside en front gebruiken exact dezelfde CSS-positie,
  breedte, schaal en rotatie.
- Veilige zone: het midden blijft leeg voor rating, naam en kaartdata. Alleen
  rond x 68%, y 36% loopt een open rookcrescent om de toekomstige avatarrand;
  het hart daarvan blijft transparant.
- Compositie: een relatief smalle band volumetrische zwarte rook boven en langs
  de buitenste zijkanten; complete
  zwarte veren, speelkaarten en zwart-gouden geschenken; zware stalen kettingen
  die rond 64–68% van de canvashoogte naar binnen draaien; een gevleugelde
  bovencrest; een complete onderste rozet die tegen de kaartpunt aansluit en
  uiterlijk rond 90% van het canvas eindigt.
- Materiaal: bijna zwarte kernen, gunmetal, beperkt antiek goud, warme
  randlichten en fijne gouddeeltjes. Geen menselijke figuren, tekst, rating,
  avatar, kaartframe of achtergrond.
- Maskers: `piet-inside-mask.svg` houdt de contentzone rustig;
  `piet-front-mask.svg` selecteert uitsluitend complete herkenbare groepen die
  vóór het kaartframe mogen komen.
- Avatarregister: de rook wordt niet met één gesloten ovaal geselecteerd maar
  met vier asymmetrische lobben. De live avatarrand zelf gebruikt een fijne
  goudlijn, donkere metaalband en antiek-gouden buitenlijn.

Bij vervanging moet het canvasregister ongewijzigd blijven. Een gewijzigde
uitsnede vereist een bewuste herkalibratie van beide maskers én alle drie de
lagen in dezelfde desktop- en mobiele screenshotviewport.
