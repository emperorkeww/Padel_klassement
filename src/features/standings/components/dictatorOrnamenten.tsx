// Ornamenten van De Troon (#769) — losse SVG-lagen voor de dictator-kaart in
// het klassement. Ze staan hier en niet in de component zelf omdat het pure,
// dataloze vormen zijn: zo blijft DictatorThrone.tsx over de gegevens gaan en
// is de vormtaal apart te lezen (en te hergebruiken).
//
// Waarom SVG en geen emoji: een 🐐 of 🫡 rendert per platform anders (Apple,
// Google, Windows tekenen elk hun eigen glyph) en de geit hoort bovendien bij
// GOAT, niet bij de dictator (#769). De commandoster-in-lauwerkrans hieronder
// is één vectorvorm en ziet er op iOS, Android en desktop identiek uit.
//
// De kleuren komen bewust uít futKaartOrnamenten.ts (het #710-regime van de
// El Padelissimo-FUT-kaart): één antiekgoudpalet voor de hele dictator-familie
// is beter dan een tweede goudtint die er net naast zit. De kroon boven het
// portretkader is letterlijk hetzelfde pad als op de FUT-kaart.

import {
  DICTATOR_GOUD_VERLOOP,
  DICTATOR_GOUD_CONTOUR,
  DICTATOR_GEM,
  DICTATOR_KROON,
  DICTATOR_KROON_BAND,
  DICTATOR_KROON_BOLLEN,
} from "@/features/rating/components/futKaartOrnamenten";

/** Id van het gedeelde goudverloop. De troon staat één keer per pagina, dus
 *  één vaste id volstaat — dezelfde afspraak als de defs-sprite van FutKaart. */
const GOUD = "dictator-troon-goud";
const GOUD_URL = `url(#${GOUD})`;

const rond = (n: number) => Math.round(n * 100) / 100;
const rad = (graden: number) => (graden * Math.PI) / 180;

/** Symmetrische stervorm. Hoeken in SVG-graden (0 = rechts, 90 = omlaag); de
 *  startdraai van -90° zet de eerste punt recht omhoog. */
function sterPad(
  cx: number,
  cy: number,
  buiten: number,
  binnen: number,
  punten = 5,
): string {
  const hoeken: string[] = [];
  for (let i = 0; i < punten * 2; i++) {
    const r = i % 2 === 0 ? buiten : binnen;
    const a = rad(-90 + i * (180 / punten));
    hoeken.push(`${rond(cx + Math.cos(a) * r)} ${rond(cy + Math.sin(a) * r)}`);
  }
  return `M ${hoeken.join(" L ")} Z`;
}

/** Eén lauwerblad: spitse ovaal met twee bogen, geplaatst op (u,v) en gedraaid.
 *  Zelfde constructie als de bladeren op de FUT-kaart, maar die versie zit vast
 *  aan de schild-viewBox van #710; hier moet hij op elke straal kunnen staan. */
function lauwerBlad(
  u: number,
  v: number,
  hoek: number,
  lengte: number,
): string {
  const cos = Math.cos(rad(hoek));
  const sin = Math.sin(rad(hoek));
  const breed = lengte * 0.36;
  const P = (langs: number, dwars: number) =>
    `${rond(u + langs * cos - dwars * sin)} ${rond(v + langs * sin + dwars * cos)}`;
  return `M ${P(0, 0)} C ${P(lengte * 0.3, breed)} ${P(lengte * 0.72, breed * 0.8)} ${P(
    lengte,
    0,
  )} C ${P(lengte * 0.72, -breed * 0.8)} ${P(lengte * 0.3, -breed)} ${P(0, 0)} Z`;
}

/** Halve lauwerkrans: een stengel langs een cirkelboog met bladeren die schuin
 *  naar buiten wijzen. Alleen de linkerhelft — de rechterhelft is in de SVG een
 *  gespiegelde `<use>`, zodat de krans per constructie symmetrisch is. */
function halveKrans(opties: {
  cx: number;
  cy: number;
  straal: number;
  /** Beginhoek (bovenaan, waar de krans open staat) en eindhoek (onderaan). */
  van: number;
  tot: number;
  bladen: number;
  lengte: number;
}): { stengel: string; bladen: string[] } {
  const { cx, cy, straal, van, tot, bladen, lengte } = opties;
  const punt = (hoek: number) => [
    cx + Math.cos(rad(hoek)) * straal,
    cy + Math.sin(rad(hoek)) * straal,
  ];
  const [x1, y1] = punt(van);
  const [x2, y2] = punt(tot);
  // large-arc=0, sweep=0: de korte kant linksom — de bocht die de krans vormt.
  const stengel = `M ${rond(x1)} ${rond(y1)} A ${straal} ${straal} 0 0 0 ${rond(x2)} ${rond(y2)}`;
  const lijst: string[] = [];
  for (let i = 0; i < bladen; i++) {
    const t = i / (bladen - 1);
    const hoek = van + (tot - van) * t;
    const [bx, by] = punt(hoek);
    // Raaklijn in de looprichting van de stengel, en dan ~42° naar buiten
    // gedraaid: dat leest als een krans i.p.v. als blaadjes op een lijn.
    const raak = Math.atan2(-Math.cos(rad(hoek)), Math.sin(rad(hoek))) / rad(1);
    // Uiteinden iets korter — een echte tak dunt naar de punt uit.
    const schaal = 0.72 + 0.28 * Math.sin(Math.PI * t);
    lijst.push(lauwerBlad(bx, by, raak + 42, lengte * schaal));
    lijst.push(lauwerBlad(bx, by, raak - 34, lengte * 0.62 * schaal));
  }
  return { stengel, bladen: lijst };
}

/* ------------------------------ gedeelde defs ------------------------------ */

/** Het goudverloop dat alle ornamenten op de kaart delen. Staat één keer in de
 *  DOM; SVG-verwijzingen via `url(#id)` zijn documentbreed, dus de losse SVG's
 *  eromheen kunnen er gewoon bij. */
export function DictatorGoudDefs() {
  return (
    <svg
      className="dictator-throne__defs"
      width="0"
      height="0"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={GOUD} x1="0" y1="0" x2="0.35" y2="1">
          {DICTATOR_GOUD_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ------------------------- commandoster in lauwerkrans ---------------------- */

// Bewust grof voor z'n formaat: het embleem staat op de plaquette maar ~24px
// groot, en fijne blaadjes vallen dan weg tegen het goud eronder.
const EMBLEEM_KRANS = halveKrans({
  cx: 50,
  cy: 52,
  straal: 31,
  van: 242,
  tot: 96,
  bladen: 5,
  lengte: 17,
});
const EMBLEEM_STER = sterPad(50, 50, 21, 8.6);

function EmbleemTak() {
  return (
    <g>
      <path
        d={EMBLEEM_KRANS.stengel}
        fill="none"
        stroke={GOUD_URL}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      {EMBLEEM_KRANS.bladen.map((d) => (
        <path key={d} d={d} fill={GOUD_URL} />
      ))}
    </g>
  );
}

/** Het dictator-embleem: een symmetrische vijfpuntige commandoster in twee
 *  kleine lauwertakken. Vervangt het geiticoon (dat hoort bij GOAT) en elke
 *  emoji op deze kaart. */
export function DictatorEmbleem({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {/* Beide takken tekenen we uit, i.p.v. één tak met een gespiegelde
          `<use>`: het embleem staat mogelijk twee keer op de kaart (plaquette
          én leeg portretkader) en dan zouden twee gelijke id's in de DOM staan. */}
      <EmbleemTak />
      <g transform="translate(100,0) scale(-1,1)">
        <EmbleemTak />
      </g>
      {/* Oxblood ster met een dunne gouden rand — de rand doet het werk, want
          op een gouden plaquette zou een massief gouden ster verdwijnen. */}
      <path
        d={EMBLEEM_STER}
        fill={DICTATOR_GEM}
        stroke={GOUD_URL}
        strokeWidth="3.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --------------------------------- lakzegel -------------------------------- */

const ZEGEL_KARTEL = Array.from({ length: 32 }, (_, i) => {
  const a = rad(i * (360 / 32));
  return [rond(50 + Math.cos(a) * 44), rond(50 + Math.sin(a) * 44)] as const;
});

/** Klein lakzegel aan de rechterkant van de titelplaquette: gekartelde waslak
 *  in oxblood met opnieuw de commandoster. */
export function DictatorZegel({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {/* Kartelrand: kleine bolletjes langs de omtrek, zoals lak dat onder een
          stempel wegvloeit. */}
      {ZEGEL_KARTEL.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" fill={DICTATOR_GEM} />
      ))}
      <circle cx="50" cy="50" r="45" fill={DICTATOR_GEM} />
      <circle
        cx="50"
        cy="50"
        r="41"
        fill="none"
        stroke={GOUD_URL}
        strokeWidth="3"
      />
      <circle
        cx="50"
        cy="50"
        r="34"
        fill="none"
        stroke={DICTATOR_GOUD_CONTOUR}
        strokeWidth="1.2"
        opacity="0.55"
      />
      <path d={sterPad(50, 50, 24, 10)} fill={GOUD_URL} />
    </svg>
  );
}

/* -------------------------------- watermerk -------------------------------- */

const WATERMERK_KRANS = halveKrans({
  cx: 100,
  cy: 104,
  straal: 68,
  van: 250,
  tot: 92,
  bladen: 11,
  lengte: 26,
});

function WatermerkTak() {
  return (
    <g fill="currentColor">
      <path
        d={WATERMERK_KRANS.stengel}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {WATERMERK_KRANS.bladen.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** Grote lauwerkrans met commandoster als watermerk achter het informatie-
 *  paneel. Getekend in lijn i.p.v. vlak en op lage dekking (zie CSS), zodat de
 *  statusomschrijving eroverheen leesbaar blijft. */
export function DictatorWatermerk({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <WatermerkTak />
      <g transform="translate(200,0) scale(-1,1)">
        <WatermerkTak />
      </g>
      <g transform="translate(100,98) scale(1.1) translate(-50,-50)">
        <path d={EMBLEEM_STER} fill="currentColor" />
      </g>
    </svg>
  );
}

/* ------------------------------ krooncrest --------------------------------- */

/** Lauwervleugels links en rechts van de kroon: de crest hoort in de bovenrand
 *  van het kader te liggen, en zonder die vleugels leest de kroon als een los
 *  puntig silhouet i.p.v. als een medaillon. */
const CREST_VLEUGEL = halveKrans({
  cx: 20,
  cy: -12,
  straal: 15,
  van: 200,
  tot: 355,
  bladen: 5,
  lengte: 8,
});

/** De ceremoniële kroon uit het #710-regime, hier als crest boven het portret-
 *  kader. Letterlijk hetzelfde pad als op de FUT-kaart: de troon en de kaart
 *  van dezelfde speler horen dezelfde kroon te dragen. De viewBox snijdt het
 *  stuk uit dat op de FUT-kaart bóven de schildrand uitsteekt (negatieve y). */
export function DictatorKroonCrest({ className }: { className?: string }) {
  const vleugel = (
    <g>
      <path
        d={CREST_VLEUGEL.stengel}
        fill="none"
        stroke={GOUD_URL}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {CREST_VLEUGEL.bladen.map((d) => (
        <path key={d} d={d} fill={GOUD_URL} />
      ))}
    </g>
  );
  return (
    <svg
      className={className}
      viewBox="2 -33 96 41"
      aria-hidden="true"
      focusable="false"
    >
      {vleugel}
      <g transform="translate(100,0) scale(-1,1)">{vleugel}</g>
      <path d={DICTATOR_KROON_BAND} fill={GOUD_URL} stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.6" />
      <path d={DICTATOR_KROON} fill={GOUD_URL} stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.6" />
      {DICTATOR_KROON_BOLLEN.flatMap(([cx, cy, r]) =>
        (cx === 50 ? [cx] : [cx, 100 - cx]).map((x) => (
          <circle
            key={`${x}-${cy}`}
            cx={x}
            cy={cy}
            r={r}
            fill={GOUD_URL}
            stroke={DICTATOR_GOUD_CONTOUR}
            strokeWidth="0.5"
          />
        )),
      )}
      <circle cx="50" cy="2.5" r="2.2" fill={DICTATOR_GEM} stroke={DICTATOR_GOUD_CONTOUR} strokeWidth="0.4" />
    </svg>
  );
}

/* ------------------------------ hoekfiligraan ------------------------------ */

/** Gegraveerd hoekornament (linksboven getekend; de andere drie hoeken zijn in
 *  CSS gespiegeld). Lijnwerk, geen vlak: het moet als gravure in het emaille
 *  lezen en niet als een tweede rand concurreren met de kaartranden. */
export function DictatorFiligraan({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
    >
      {/* Twee concentrische kwartbogen — de gravure die de hoek volgt. */}
      <path d="M 6 62 C 6 30 30 6 62 6" strokeWidth="2.2" />
      <path d="M 15 70 C 15 40 40 15 70 15" strokeWidth="1" opacity="0.6" />
      {/* Voluten: aan elk booguiteinde rolt de lijn naar binnen weg, zodat de
          gravure niet abrupt afbreekt. */}
      <path
        d="M 6 62 C 5 73 12 80 19 76 C 24 73 23 66 18 66 C 14 66 13 70 16 71"
        strokeWidth="1.5"
      />
      <path
        d="M 62 6 C 73 5 80 12 76 19 C 73 24 66 23 66 18 C 66 14 70 13 71 16"
        strokeWidth="1.5"
      />
      {/* Fleuron op het midden van de boog, wijzend naar de hoekpunt: twee
          blaadjes en een hart — de echo van de lauwerkrans. */}
      <path d="M 27 27 C 20 19 22 11 30 10 C 33 17 32 23 27 27 Z" strokeWidth="1.2" />
      <path d="M 27 27 C 19 20 11 22 10 30 C 17 33 23 32 27 27 Z" strokeWidth="1.2" />
      <circle cx="30" cy="30" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------- lauwerhoek op het kader ------------------------- */

const KADERHOEK = halveKrans({
  cx: 4,
  cy: 4,
  straal: 34,
  van: 88,
  tot: 4,
  bladen: 4,
  lengte: 13,
});

/** Klein lauwerdetail in de hoeken van het portretkader (linksboven getekend;
 *  CSS spiegelt naar de andere drie hoeken). */
export function DictatorKaderHoek({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 46 46"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={KADERHOEK.stengel}
        fill="none"
        stroke={GOUD_URL}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {KADERHOEK.bladen.map((d) => (
        <path key={d} d={d} fill={GOUD_URL} />
      ))}
    </svg>
  );
}

/* ------------------------------ randruit ----------------------------------- */

/** Ruitje midden op de boven- en onderrand: het kleine sluitstuk dat de dubbele
 *  gouden filet in de referentie onderbreekt. */
export function DictatorRandRuit({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M 20 2 L 33 20 L 20 38 L 7 20 Z" fill={GOUD_URL} />
      <path
        d="M 20 8 L 28.5 20 L 20 32 L 11.5 20 Z"
        fill={DICTATOR_GEM}
        stroke={DICTATOR_GOUD_CONTOUR}
        strokeWidth="0.8"
      />
    </svg>
  );
}
