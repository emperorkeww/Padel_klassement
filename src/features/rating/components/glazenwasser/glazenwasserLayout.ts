// Layoutconfiguratie van de brede Glazenwasser-kaart (#834).
//
// Waarom een eigen configuratie en niet de gedeelde FutKaart-layout: het schild
// van de referentie is bijna vierkant (0,875 breed × hoog) terwijl het
// gedeelde schild 0,72 is, en de inhoud staat er compleet anders in — rating
// linksboven met een kolom eronder, een grote portretcirkel rechtsboven, een
// scheidingslijn op 43%, naam op 47%, zes statistieken op 65% en een waterlaag
// die de onderste vijfde van de kaart vult. Die compositie in het smalle schild
// persen kostte precies de dingen die de referentie kenmerken: de
// statistiekenrij paste niet, de waterexplosie moest naar 70% krimpen en de
// emmer moest van de flank af.
//
// Alle getallen hieronder zijn fracties van het kaartvak (x van de kaartbreedte,
// y van de kaarthoogte), zodat er één stabiel coördinatenstelsel is en de kaart
// als geheel schaalt. Er staat nergens een pixelwaarde of een breakpoint.
//
// De artworklagen komen uit het bestaande `glazenwasser-master.webp`: elke laag
// is een uitsnede uit dát canvas, geen nieuw bestand. `bron` is die uitsnede in
// canvaspixels, `doel` is waar hetzelfde onderdeel in de referentie staat. Beide
// reeksen komen uit `python3 scripts/glazenwasser-master.py --layout`; wie het
// artwork opnieuw genereert, kopieert die uitvoer hierheen.

/** Canvasmaat van glazenwasser-master.webp. */
export const GW_CANVAS = { breedte: 1105, hoogte: 1536 } as const;

/** Verhouding van het schild in de referentie (hoogte / breedte): 975 × 1114
 *  pixels in het bronbeeld. Alle y-maten hieronder staan in dít stelsel. */
const REF_RATIO = 139 / 100;

/** Verhouding van de kaart in de app. Dezelfde als élke andere kaart, zodat de
 *  Glazenwasser naast een GOAT of een Wannabe niet als een afgeknot blokje leest.
 *  De referentie is breder dan hoog; de kaart is dat niet, dus de compositie moet
 *  worden verdeeld in plaats van uitgerekt — zie `naarKaartY`. */
export const GW_RATIO = 139 / 100;

/** Verhouding tussen beide stelsels: een maat in referentiehoogtes is op deze
 *  kaart deze factor kleiner, want de kaart is hoger. Artwork wordt daarmee nooit
 *  uitgerekt — alleen verplaatst. */
const KRIMP = REF_RATIO / GW_RATIO;

/** Referentiehoogte → kaarthoogte.
 *
 *  De referentie is breder dan hoog, de kaart niet: er komt 22% hoogte bij. Waar
 *  die ruimte landt, bepaalt hoe de kaart oogt, en daarom is dit een stuksgewijze
 *  afbeelding in plaats van één schaal:
 *
 *  * tot 10% hangt alles aan de bovenrand (raamcrest, hoekschuim, ratinggroep,
 *    portretcirkel) — die horen tegen de lijst;
 *  * van 20% tot 70% blijft alles op zijn relatieve hoogte staan, dus de extra
 *    ruimte verdeelt zich gelijkmatig over het glas rond scheidingslijn, naam,
 *    divisieregel en statistieken;
 *  * vanaf 80% hangt alles aan de onderrand (waterlaag, onderschild, tweede
 *    trekker) — anders blijft er een leeg stuk glas onder de punt staan.
 *
 *  Daartussen loopt het vloeiend over, zodat niets verspringt.
 *
 *  `ankerY` houdt een groep bij elkaar: de drie lagen van de ondergroep moeten
 *  dezelfde verschuiving krijgen, anders drijven water, onderschild en trekker
 *  uit elkaar. */
export function naarKaartY(y: number, ankerY: number = y): number {
  const boven = y * KRIMP;
  const onder = 1 - (1 - y) * KRIMP;
  const meng = (a: number, b: number, t: number) => a + (b - a) * t * t * (3 - 2 * t);
  const klem = (t: number) => Math.min(1, Math.max(0, t));
  if (ankerY < 0.2) return meng(boven, y, klem((ankerY - 0.1) / 0.1));
  if (ankerY > 0.7) return meng(y, onder, klem((ankerY - 0.7) / 0.1));
  return y;
}

/** Referentiemaat → kaartmaat in de hoogte, met behoud van de pixelverhouding:
 *  artwork wordt nooit uitgerekt, alleen verplaatst. */
export function naarKaartH(h: number): number {
  return h * KRIMP;
}

/** Eén artworklaag: een los, strak bijgesneden onderdeel uit
 *  `scripts/glazenwasser-onderdelen.py`. Elk onderdeel heeft zijn eigen alfa en
 *  geen overtollige transparante rand, dus het kan los worden geschaald en
 *  geplaatst zonder masker en zonder de buren mee te slepen. */
export interface GwLaag {
  naam: string;
  /** Bestandsnaam-sleutel; `GW_BRONNEN` koppelt hem aan het WebP. */
  bron: GwBron;
  /** Plek in de kaart: [left, top, breedte, hoogte] als fractie van het
   *  kaartvak, in het coördinatenstelsel van de referentie. `doos` uit het
   *  script is het vertrekpunt; een correctie erop staat in `verzet`. */
  doel: readonly [number, number, number, number];
  /** Vergroting rond het middelpunt van `doel`. De referentie is breder dan deze
   *  kaart, dus de voorwerpen aan de flanken mogen forser: zo houden ze dezelfde
   *  visuele massa als op de referentie. */
  schaal?: number;
  /** Verschuiving in kaartfracties, ná de schaal. */
  verzet?: readonly [number, number];
  /** Rotatie in graden, met de klok mee. Alleen voor het aanhaken van een
   *  voorwerp aan de lijst — de referentiehoek zit al in de pixels. */
  draai?: number;
  /** Binnen de schildclip houden — alleen de natte glaswand. Gereedschap, schuim
   *  en water horen juist over de lijst heen te lopen. */
  clip?: boolean;
  /** Herhalende textuur in plaats van één afbeelding op zijn plek. Alleen de
   *  natte glaswand: die is geen voorwerp maar materiaal, en in de referentie is
   *  er te weinig onbedekt glas om hem als één vlak uit te snijden — de tekst
   *  staat er ingebakken overheen. `laagVensterStijl` geeft zo'n laag geen
   *  afbeelding maar een achtergrond; de maat staat in de CSS, in procenten van
   *  de laag, zodat de textuur met de kaart meeschaalt. */
  tegel?: boolean;
  /** Hoogte waarop deze laag met zijn groep meeschuift. */
  ankerY?: number;
  /** `doel` staat al in kaartfracties in plaats van in referentiefracties: de
   *  verticale afbeelding is dan al in de pixels gebakken. Alleen de ring, die
   *  in `scripts/glazenwasser-onderdelen.py` met exact dezelfde stuksgewijze
   *  afbeelding is herbemonsterd — hem hier nóg een keer verschuiven zou hem
   *  dubbel verrekenen. */
  voorbewerkt?: boolean;
  /** Contactschaduw: een tweede, zwart geblurde kopie van hetzelfde onderdeel
   *  eronder. Dat is wat een voorwerp op de lijst laat rusten in plaats van
   *  erop geplakt — de schaduw volgt de alfa, dus hij heeft exact de vorm van het
   *  onderdeel. Waarde is de blur als fractie van de kaartbreedte. */
  schaduw?: number;
  z: number;
}

import DOZEN from "./assets/gw-onderdelen.json";

export type GwBron =
  | "ring"
  | "water-back"
  | "glas";

/** De lagen, in paintvolgorde. `doel` komt uit
 *  `python3 scripts/glazenwasser-onderdelen.py`; `schaal` en `verzet` zijn de
 *  bewuste afwijkingen van de referentie, met de reden erbij. */
/** De dozen komen uit `scripts/glazenwasser-onderdelen.py`, dat ze naast de assets
 *  wegschrijft. Zo kan de plek van een onderdeel niet uit de pas lopen met de
 *  uitsnede ervan; de layout voegt er alleen bewuste afwijkingen aan toe. */
const doos = (naam: GwBron) =>
  DOZEN[naam].doos as unknown as readonly [number, number, number, number];

export const GW_LAGEN: readonly GwLaag[] = [
  {
    naam: "waterBack",
    bron: "water-back",
    doel: doos("water-back"),
    voorbewerkt: true,
    z: 10,
  },
  // Natte glaswand op het kaartvlak: strepen, condens en druppels. Een
  // herhalende tegel, geen uitsnede — zie `tegel` hierboven. Niet uitrekken
  // dus: de tegel houdt op elke kaartmaat dezelfde korrel.
  {
    naam: "wetGlassSurface",
    bron: "glas",
    doel: [0.02, 0.03, 0.96, 0.95],
    clip: true,
    tegel: true,
    z: 30,
  },
  // De hele omlijsting als één illustratie: lijst, ijs, flankdruppels, schuim,
  // bellen, condens en de waterexplosie onderin. Dit verving vijf losse lagen
  // (topFoamLeft/Right, sideDripsLeft/Right, bottomWater) én de in CSS gebouwde
  // lijst. Op de referentie zijn dat geen aparte dingen — het ijs ligt op de
  // rail, het water loopt van de bovenhoek langs de flank naar de plas onderin —
  // en elke knip daartussen was een zichtbare naad. In één stuk is er niets om
  // naadloos te maken, en het licht klopt overal met zichzelf omdat het uit één
  // render komt.
  {
    naam: "cardRing",
    bron: "ring",
    doel: doos("ring"),
    voorbewerkt: true,
    z: 70,
  },
];

/** Buitencontour van het schild, opgemeten aan de silhouetrijen van
 *  docs/fut-kaarten/referentie_glazenwasser.png en genoteerd in referentiehoogtes: gebogen
 *  bovenrand, brede schouders, licht bollende flanken, een taille op 82% en een
 *  brede punt. `gwSchildPad` zet die y-waarden door dezelfde verdeling als de
 *  lagen, zodat de vorm meegroeit met de langere kaart in plaats van uit te
 *  rekken — de kap blijft even diep, de flanken worden langer. */
const SCHILD_PUNTEN: ReadonlyArray<readonly number[]> = [
  [0.104, 0.185],
  [0.145, 0.135, 0.26, 0.098, 0.39, 0.085],
  [0.43, 0.13, 0.47, 0.16, 0.5, 0.175],
  [0.53, 0.16, 0.57, 0.13, 0.61, 0.085],
  [0.74, 0.098, 0.855, 0.135, 0.896, 0.185],
  [0.915, 0.34, 0.915, 0.62, 0.9, 0.79],
  [0.84, 0.9, 0.66, 0.955, 0.5, 0.988],
  [0.34, 0.955, 0.16, 0.9, 0.1, 0.79],
  [0.085, 0.62, 0.085, 0.34, 0.104, 0.185],
];

export function gwSchildPad(): string {
  /* De referentie laat rondom veel vrije poster-marge staan. Die marge hoort
   * niet bij het schild: in een rij met de gedeelde FUT-kaarten zou de
   * Glazenwasser daardoor circa 17% smaller lezen, hoewel zijn DOM-vak exact
   * even breed is. Trek alleen de x-coordinaten rond het midden open. De
   * karakteristieke schouders en taille blijven zo identiek, maar de uiterste
   * flanken komen — net als bij de andere schilden — vrijwel tegen de rand van
   * het 100 x 139-kaartvak. */
  const naarKaartX = (x: number) => 0.5 + (x - 0.5) * 1.18;
  const paar = (x: number, y: number) =>
    `${naarKaartX(x).toFixed(4)} ${naarKaartY(y).toFixed(4)}`;
  const delen = SCHILD_PUNTEN.map((seg, i) => {
    const paren: string[] = [];
    for (let k = 0; k < seg.length; k += 2) paren.push(paar(seg[k], seg[k + 1]));
    return `${i === 0 ? "M" : "C"} ${paren.join(" ")}`;
  });
  return `${delen.join(" ")} Z`;
}

/** Plaatsing van de dynamische inhoud, in dezelfde fracties. `font` is een
 *  fractie van de kaartbreedte, zodat typografie meeschaalt met de kaart.
 *  Alle waarden zijn opgemeten aan de referentie. */
export const GW_INHOUD = {
  /** Ratinggroep linksboven: rating, Romeins subniveau, raamicoon onder elkaar.
   *  De maat van de rating volgt de bréedte van de referentie (vier cijfers over
   *  38% van de kaart); --font-rounded is breder dan het cijferbeeld daar, dus op
   *  zijn hoogte gezet zou "1150" tot over de portretcirkel lopen. */
  ratinggroep: {
    left: 0.14,
    top: 0.215,
    breedte: 0.29,
    ratingFont: 0.135,
    subFont: 0.042,
    subMarge: 0.012,
    icoonFont: 0.062,
    icoonMarge: 0.018,
  },
  /** Portretcirkel rechtsboven: middelpunt (0,704 · 0,190) met een buitenmaat van
   *  34% van de kaartbreedte — ruim drie keer de generieke avatar. De ringen zijn
   *  opgemeten op de horizontale as: 0,8% blauw en 1,6% wit rond de foto. */
  portret: { left: 0.505, top: 0.235, breedte: 0.305, blauw: 0.009, wit: 0.014 },
  /** Horizontale glaslat tussen identiteit en naam. */
  scheiding: { left: 0.18, top: 0.477, breedte: 0.64, dikte: 0.006 },
  /** Naam tussen de trekker (tot 33%) en de emmer (vanaf 77%): een lange naam mag
   *  nooit ónder een prop verdwijnen, en de props staan bewust vóór de tekst. */
  naam: { left: 0.14, breedte: 0.72, top: 0.515, font: 0.075 },
  divisie: {
    top: 0.587,
    font: 0.034,
    lijn: 0.12,
    /** Zelfde versmalling als de statistieklabels: de divisieregel van de
     *  referentie is 33% kaartbreedte breed, en ongeknepen schuift hij hier onder
     *  de trekker door. */
    smal: 0.88,
  },
  /** Statistiekenrij: zes kolommen. Iets breder dan de referentie (78% tegen
   *  75,7%), omdat de labels hier in een niet-condensed lettertype staan. */
  stats: {
    left: 0.295,
    breedte: 0.505,
    top: 0.684,
    labelFont: 0.025,
    /** De labels van de referentie staan in een sterk versmald lettertype: twaalf
     *  tekens in één kolom van 13% kaartbreedte. --font-rounded kan dat niet, dus
     *  ze worden horizontaal geschaald — precies wat een condensed snit doet. */
    labelSmal: 0.82,
    waardeFont: 0.048,
  },
} as const;

/** Vensterstijl van één laag: plek en maat binnen het kaartvak, met de schaal en
 *  de verschuiving erin verrekend. Percentages, dus dit werkt op elke kaartmaat
 *  zonder pixelrekenwerk en zonder breakpoint. */
export function laagVensterStijl(laag: GwLaag) {
  const [left, top, breedte, hoogte] = laag.doel;
  if (laag.voorbewerkt) {
    return {
      left: `${left * 100}%`,
      top: `${top * 100}%`,
      width: `${breedte * 100}%`,
      height: `${hoogte * 100}%`,
      zIndex: laag.z,
    };
  }
  const s = laag.schaal ?? 1;
  const [dx, dy] = laag.verzet ?? [0, 0];
  const b = breedte * s;
  const h = naarKaartH(hoogte * s);
  return {
    left: `${(left - (b - breedte) / 2 + dx) * 100}%`,
    top: `${(naarKaartY(top, laag.ankerY ?? top) -
      (h - naarKaartH(hoogte)) / 2 +
      dy) * 100}%`,
    width: `${b * 100}%`,
    height: `${h * 100}%`,
    zIndex: laag.z,
    ...(laag.draai ? { transform: `rotate(${laag.draai}deg)` } : {}),
  };
}
