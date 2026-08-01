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
export const GW_CANVAS = { breedte: 1024, hoogte: 1440 } as const;

/** Verhouding van het schild in de referentie (hoogte / breedte): 975 × 1114
 *  pixels in het bronbeeld. Alle y-maten hieronder staan in dít stelsel. */
const REF_RATIO = 1114 / 975;

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
  | "glasvlak"
  | "trekker-boven"
  | "ophanging"
  | "emmer"
  | "onderschild";

/** De lagen, in paintvolgorde. `doel` komt uit
 *  `python3 scripts/glazenwasser-onderdelen.py`; `schaal` en `verzet` zijn de
 *  bewuste afwijkingen van de referentie, met de reden erbij. */
/** De dozen komen uit `scripts/glazenwasser-onderdelen.py`, dat ze naast de assets
 *  wegschrijft. Zo kan de plek van een onderdeel niet uit de pas lopen met de
 *  uitsnede ervan; de layout voegt er alleen bewuste afwijkingen aan toe. */
const doos = (naam: GwBron) =>
  DOZEN[naam].doos as unknown as readonly [number, number, number, number];

export const GW_LAGEN: readonly GwLaag[] = [
  // Het natte glasvlak: één samengesteld, dekkend vlak op kaartmaat —
  // toonveld, condens, druppels en waterstrepen uit schone referentiedelen
  // (scripts/glazenwasser-onderdelen.py, `glasvlak()`). Dit verving de kleine
  // geweven tegel: die las op kaartmaat als behang en droeg geen strepen. Al
  // in kaartfracties opgebouwd, dus `voorbewerkt`.
  {
    naam: "wetGlassSurface",
    bron: "glasvlak",
    doel: [0, 0, 1, 1],
    clip: true,
    voorbewerkt: true,
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
    z: 40,
  },
  // Trekker schuin langs de linkerflank: iets forser dan de referentie en met
  // zijn blad búiten het schild, zoals daar — blad en steel houden dan
  // dezelfde visuele lengte-balans op de smallere kaart. Het gat in de ring
  // zit op de ingebakken plek en wordt gevuld, dus de trekker mag hier vrij
  // schuiven en schalen.
  {
    naam: "leftSqueegee",
    schaduw: 0.004,
    bron: "trekker-boven",
    doel: doos("trekker-boven"),
    schaal: 1.12,
    verzet: [-0.035, 0.012],
    z: 70,
  },
  // Haak met ketting waar de emmer aan hangt; die moet aan de lijst vastzitten,
  // dus hij schuift met de emmer mee naar buiten.
  {
    naam: "bucketHanger",
    bron: "ophanging",
    doel: doos("ophanging"),
    // Vóór de lijst, niet erachter: op de referentie is de klem op de rail
    // geschroefd en ligt de ketting er zichtbaar overheen. Achter de lijst
    // (z 19) verdween hij eronder en hing de emmer nergens aan.
    z: 66,
  },
  // Sopemmer: groter, lager en verder over de rechterrand dan op de referentie.
  {
    naam: "rightBucket",
    bron: "emmer",
    doel: doos("emmer"),
    // Op referentiemaat: op 1,22 dekte de emmer de rechterhelft van de
    // divisieregel en de kolom CONCENTRATIE af. Iets omhoog, zodat de ketting
    // uit de ophanging de beugel raakt in plaats van er een gat boven te laten:
    // een emmer die náást zijn ketting hangt leest als los plaatje.
    verzet: [0.004, -0.022],
    z: 70,
  },
  // Onderschild mét de tweede trekker: op de referentie is dat één brandpunt, dus
  // het is ook één asset. Het water eromheen loopt er in dezelfde uitsnede
  // overheen, zodat er geen naad tussen crest, trekker en splash overblijft.
  {
    naam: "bottomShield",
    schaduw: 0.01,
    bron: "onderschild",
    doel: doos("onderschild"),
    verzet: [0, 0.012],
    // Geen eigen anker meer: het water waar dit schild in ligt zit nu in de ring,
    // en die is met de gewone afbeelding herbemonsterd. Een afwijkend anker zou
    // het schild 1,8% kaarthoogte boven zijn eigen plas leggen.
    z: 100,
  },
];

/** Buitencontour van het schild, opgemeten aan de silhouetrijen van
 *  docs/fut-kaarten/referentie_glazenwasser.png en genoteerd in referentiehoogtes: gebogen
 *  bovenrand, brede schouders, licht bollende flanken, een taille op 82% en een
 *  brede punt. `gwSchildPad` zet die y-waarden door dezelfde verdeling als de
 *  lagen, zodat de vorm meegroeit met de langere kaart in plaats van uit te
 *  rekken — de kap blijft even diep, de flanken worden langer. */
const SCHILD_PUNTEN: ReadonlyArray<readonly number[]> = [
  // Linkerschouder: gehoekt omhoog, niet afgerond.
  [0.072, 0.062],
  [0.108, 0.028, 0.170, 0.010, 0.286, 0.008],
  [0.330, 0.008, 0.362, 0.008, 0.392, 0.009],
  // Verzonken inkeping: de rand duikt hier diep het kaartvlak in, zodat de
  // raamcrest erín valt en de lijst er aan beide kanten omheen loopt. Zonder
  // deze recess blijft elke crest een badge die op de kaart is geplakt.
  [0.404, 0.052, 0.412, 0.086, 0.436, 0.092],
  [0.472, 0.098, 0.528, 0.098, 0.564, 0.092],
  [0.588, 0.086, 0.596, 0.052, 0.608, 0.009],
  // Rechterschouder, gespiegeld.
  [0.638, 0.008, 0.670, 0.008, 0.714, 0.008],
  [0.830, 0.010, 0.892, 0.028, 0.928, 0.062],
  [0.952, 0.076, 0.972, 0.100, 0.974, 0.170],
  [0.978, 0.330, 0.978, 0.520, 0.972, 0.640],
  [0.968, 0.720, 0.960, 0.780, 0.952, 0.820],
  [0.900, 0.910, 0.700, 0.965, 0.500, 1.000],
  [0.300, 0.965, 0.100, 0.910, 0.048, 0.820],
  [0.040, 0.780, 0.032, 0.720, 0.028, 0.640],
  [0.022, 0.520, 0.022, 0.330, 0.026, 0.170],
  [0.028, 0.100, 0.048, 0.076, 0.072, 0.062],
];

export function gwSchildPad(): string {
  const paar = (x: number, y: number) =>
    `${x.toFixed(4)} ${naarKaartY(y).toFixed(4)}`;
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
    left: 0.1,
    top: 0.075,
    breedte: 0.42,
    ratingFont: 0.17,
    subFont: 0.078,
    subMarge: 0.014,
    icoonFont: 0.1,
    icoonMarge: 0.022,
  },
  /** Portretcirkel rechtsboven: middelpunt (0,704 · 0,190) met een buitenmaat van
   *  34% van de kaartbreedte — ruim drie keer de generieke avatar. De ringen zijn
   *  opgemeten op de horizontale as: 0,8% blauw en 1,6% wit rond de foto. */
  portret: { left: 0.5333, top: 0.058, breedte: 0.3405, blauw: 0.009, wit: 0.016 },
  /** Horizontale glaslat tussen identiteit en naam. */
  scheiding: { left: 0.193, top: 0.433, breedte: 0.611, dikte: 0.012 },
  /** Naam tussen de trekker (tot 33%) en de emmer (vanaf 77%): een lange naam mag
   *  nooit ónder een prop verdwijnen, en de props staan bewust vóór de tekst. */
  naam: { left: 0.16, breedte: 0.62, top: 0.455, font: 0.09 },
  divisie: {
    top: 0.554,
    font: 0.052,
    lijn: 0.1,
    /** Zelfde versmalling als de statistieklabels: de divisieregel van de
     *  referentie is 33% kaartbreedte breed, en ongeknepen schuift hij hier onder
     *  de trekker door. */
    smal: 0.8,
  },
  /** Statistiekenrij: zes kolommen. Iets breder dan de referentie (78% tegen
   *  75,7%), omdat de labels hier in een niet-condensed lettertype staan. */
  stats: {
    left: 0.105,
    breedte: 0.755,
    top: 0.674,
    labelFont: 0.026,
    /** De labels van de referentie staan in een sterk versmald lettertype: twaalf
     *  tekens in één kolom van 13% kaartbreedte. --font-rounded kan dat niet, dus
     *  ze worden horizontaal geschaald — precies wat een condensed snit doet. */
    labelSmal: 0.42,
    waardeFont: 0.062,
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
