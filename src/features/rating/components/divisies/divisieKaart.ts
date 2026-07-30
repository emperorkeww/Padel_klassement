// Divisiekaarten (#710): het pluggable register voor de negen basisdivisies.
//
// Tot #710 kwamen alle divisiekaarten uit één formule: de tierkleur gemixt
// richting warm wit (zie `kaartSkin` in futKaartCanvas.ts). Elke divisie krijgt
// nu een eigen materiaal en eigen ornamenten, en dat zou betekenen dat negen
// registers zich in dezelfde vier bestanden persen — FutKaart.tsx, FutKaart.css,
// futKaartCanvas.ts en de showcase.
//
// Daarom is de divisiekaart hier *data* i.p.v. code: één module per divisie
// levert zijn kleurregister, gradient-definities en ornamentdelen als platte
// beschrijving, en twee generieke tekenaars — `FutDivisieDefs` in FutKaart.tsx
// en `drawDivisieOrnament` in futKaartCanvas.ts — zetten die om in SVG en
// canvas. Dat houdt de DOM↔poster-pariteit by construction (beide lezen
// letterlijk dezelfde paden en stops) en maakt een nieuwe divisie een kwestie
// van één bestand vullen.
//
// Coördinaten: kaart-units, 100 breed × 139 hoog, oorsprong linksboven op de
// kaart — hetzelfde stelsel als de ornamentlaag van de edities. Motieven hebben
// hun eigen viewBox 0 0 100 100, gecentreerd op het vlak.

import type { TierKey } from "@/features/rating/tiers";
import type { VlakTextuur } from "@/lib/utils/futKaartCanvas";
import type { OrnamentPad } from "../futKaartOrnamenten";

/** Eén gradient-definitie, in kaart-units (userSpaceOnUse). Zo kantelt het
 *  licht mee met de spiegeling van een gespiegeld deel — precies wat de
 *  canvas-spiegel met `ctx.scale(-1, 1)` doet. */
export interface DivisieGradient {
  /** Uniek id; gebruik het prefix `fut-div-<key>-` om botsingen te voorkomen. */
  id: string;
  /** [x1, y1, x2, y2] in kaart-units. */
  as: readonly [number, number, number, number];
  stops: ReadonlyArray<readonly [number, string]>;
}

/** Eén vorm in de ornamentlaag: een pad met vulling en/of contour. */
export interface DivisieDeel {
  /** Pad in kaart-units (absolute M/L/C/A-commando's). */
  d: string;
  /** SVG-paint: `url(#id)` van een eigen gradient, of een vaste kleur. */
  vulling?: string;
  contour?: string;
  /** Contourdikte in kaart-units; default 0.5. */
  contourBreedte?: number;
  /** Ook gespiegeld om x=50 tekenen — voor symmetrische paren volstaat dus
   *  één helft, en links en rechts kunnen per constructie niet uit elkaar
   *  lopen. */
  spiegel?: boolean;
  /** Dekking van dit deel; default 1. */
  alpha?: number;
}

/** Kleurregister van één divisie — de canvas-spiegel van het
 *  `.fut-kaart--<key>`-blok in de bijbehorende CSS. Laat het weg om op de
 *  generieke metaalladder te blijven. Velden komen letterlijk overeen met
 *  `FutKaartKleuren`, zodat `kaartSkin` ze kan doorgeven. */
export interface DivisieRegister {
  frame: ReadonlyArray<readonly [number, string]>;
  liner: string;
  keyline?: string;
  /** [hi, mid, lo] van de vlak-gradient. */
  vlak: readonly [string, string, string];
  /** Positie van de middelste stop; default 0.56. */
  vlakMid?: number;
  glow: string;
  sheen?: string;
  sheenSpreiding?: number;
  ink: string;
  inkSoft: string;
  lijn: string;
  /** Zie `FutKaartKleuren`: echo-contour en binnenlijnen van de rand. */
  echo?: ReadonlyArray<readonly [number, number, string]>;
  binnenlijn?: ReadonlyArray<readonly [number, string]>;
  textuur?: VlakTextuur;
  satijnAlpha?: number;
  /** Stralenkrans; default false voor een divisie zonder eigen register. */
  stralen?: boolean;
  /** Dikte van frame, liner en keyline als fracties van de kaartbreedte;
   *  default [1/70, 1/280, 1/280]. Spiegel van de drie `--kaart-*-dikte`-clamps
   *  in `divisies/<key>.css` — een divisie met een zwaardere lijst dan de
   *  standaardhaarlijn moet ze hier herhalen, anders lopen kaart en poster
   *  uiteen. */
  randDiktes?: readonly [frame: number, liner: number, keyline: number];
}

/** Alles wat één divisiekaart bijdraagt. */
export interface DivisieKaart {
  key: TierKey;
  /** Korte toelichting op het materiaal — verschijnt in de dev-showcase. */
  naam: string;
  register?: DivisieRegister;
  gradienten?: readonly DivisieGradient[];
  /** Ornamentdelen áchter de kaart (uitsteeksels komen van achter het schild). */
  achter?: readonly DivisieDeel[];
  /** Ornamentdelen vóór de kaart — voor vormen die achter het schild half
   *  zouden verdwijnen (een crest in de bovenrand, een medaillon in de punt). */
  voor?: readonly DivisieDeel[];
  /** Geëtst watermerk in het vlak, onder de inkt. */
  motief?: {
    paden: readonly OrnamentPad[];
    kleur: string;
    /** Breedte als fractie van het vlak; default 0.92. */
    breedte?: number;
    /** Verticale plaatsing als background-position-fractie; default 0.2. */
    positie?: number;
  };
}
