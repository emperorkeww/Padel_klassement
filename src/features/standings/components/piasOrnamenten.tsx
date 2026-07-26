// Ornamentlagen van De Schandpaal (#770): het verweerde theateraffiche van de
// gevallen joker. Alles hier is puur decoratief — `aria-hidden`, geen
// `pointer-events` — en alles komt uit hetzelfde materiaal als de 🤡-FUT-kaart
// van #710 (ornamentenPias.ts): dezelfde narrenkap, dezelfde belletjes,
// hetzelfde gebarsten maskermedaillon, dezelfde harlekijnruit en hetzelfde
// maskerwatermerk. Dat is geen zuinigheid maar de kern van de opdracht: het is
// dezelfde speler in hetzelfde register, dus als de kaart ooit hertint wordt
// moet de poster meebewegen. Zou dit bestand eigen paden en hexen dragen, dan
// drijven ze stil uit elkaar.
//
// Wat hier wél nieuw is, is de uitleg: de FUT-kaart is een schild van 100×139
// units, deze poster is breed en vloeiend. De ornamenten worden daarom per stuk
// in een eigen SVG met een viewBox rond hún bbox gezet en met CSS geplaatst,
// i.p.v. in één kaart-brede laag. Zo blijft elk ornament onvervormd, ongeacht
// hoe breed de kaart uitvalt.
//
// Bewust geen beweging: schande glimt niet en zwaait niet mee (#705/#710). Er is
// dus ook niets dat `prefers-reduced-motion` moet dempen.

import {
  belPaden,
  PIAS_GOUD_CONTOUR,
  PIAS_GOUD_GLANS,
  PIAS_GOUD_GRAVURE,
  PIAS_GOUD_SCHADUW,
  PIAS_GOUD_VERLOOP,
  PIAS_KAP_BAND,
  PIAS_KAP_BELLEN,
  PIAS_KAP_MIDDENLOB,
  PIAS_KAP_NERVEN,
  PIAS_KAP_ZIJLOB,
  PIAS_KAP_ZOOM,
  PIAS_MED_BARST,
  PIAS_MED_HAARLIJN,
  PIAS_MED_MASKER,
  PIAS_MED_RING,
  PIAS_MED_TRAAN,
  PIAS_MED_TREKKEN,
  PIAS_MED_VLAK,
  PIAS_MED_VOLUTE,
  PIAS_MOTIEF_INK,
  PIAS_MOTIEF_INKTEN,
  PIAS_RUIT,
  PIAS_STOF_BIES,
  PIAS_STOF_GLANS,
  PIAS_STOF_SCHADUW,
  PIAS_STOF_VERLOOP,
  PIAS_WATERMERK,
  type PiasBel,
} from "@/features/rating/components/ornamentenPias";
import type { Streng } from "@/features/rating/components/futKaartOrnamenten";

/* ------------------------------ gedeelde defs ------------------------------ */

// Vaste id's i.p.v. useId(): De Schandpaal is per definitie één kaart per
// pagina (de globale pias), en een `url(#…)`-verwijzing moet binnen dezelfde
// SVG-root blijven om betrouwbaar te zijn — vandaar dat elke ornament-SVG zijn
// eigen kopie van de twee verlopen draagt in plaats van er één te delen.
function PiasVerlopen({ id }: { id: string }) {
  return (
    <>
      {/* Recht van boven naar onder, net als op de kaart: dit goud is dof
          geworden en heeft geen schuine glansbaan. */}
      <linearGradient
        id={`${id}-goud`}
        x1="0"
        y1="0"
        x2="0"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        {PIAS_GOUD_VERLOOP.map(([offset, kleur]) => (
          <stop key={offset} offset={offset} stopColor={kleur} />
        ))}
      </linearGradient>
      <linearGradient
        id={`${id}-stof`}
        x1="0"
        y1="0"
        x2="0"
        y2="1"
        gradientUnits="objectBoundingBox"
      >
        {PIAS_STOF_VERLOOP.map(([offset, kleur]) => (
          <stop key={offset} offset={offset} stopColor={kleur} />
        ))}
      </linearGradient>
    </>
  );
}

/** Eén stoffen streng (kaplob) met bies, ribbelloos. Spiegelt `FutStreng` uit
 *  FutKaart.tsx; die staat daar lokaal en is niet te importeren, en het bestand
 *  is in #710 in handen van een andere kaart. De vórm komt wél uit dezelfde
 *  `Streng`-generator, dus de silhouetten blijven identiek. */
function PiasStofStreng({ streng, id }: { streng: Streng; id: string }) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={`url(#${id}-stof)`}
        stroke={PIAS_STOF_BIES}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path
        d={streng.schaduw}
        fill="none"
        stroke={PIAS_STOF_SCHADUW}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d={streng.highlight}
        fill="none"
        stroke={PIAS_STOF_GLANS}
        strokeWidth="0.9"
        strokeLinecap="round"
      />
    </>
  );
}

/** Eén narrenbelletje: bol, naad, klepelgat en glans — de vier paden komen uit
 *  `belPaden`, dus een bel op de poster is letterlijk een bel van de kaart. */
function PiasBelletje({ bel, id }: { bel: PiasBel; id: string }) {
  const p = belPaden(bel);
  return (
    <>
      <path
        d={p.bol}
        fill={`url(#${id}-goud)`}
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.4"
      />
      <path
        d={p.naad}
        fill="none"
        stroke={PIAS_GOUD_GRAVURE}
        strokeWidth="0.35"
        strokeLinecap="round"
      />
      <path d={p.gat} fill={PIAS_GOUD_CONTOUR} />
      <path
        d={p.glans}
        fill="none"
        stroke={PIAS_GOUD_GLANS}
        strokeWidth="0.4"
        strokeLinecap="round"
      />
    </>
  );
}

/* ------------------------------- narrenkap ------------------------------- */

// Omhullende van de kap-paden in kaart-units: de zijlob loopt (met zijn halve
// dikte van 1,9) van x≈24,6 tot x≈75,4 na spiegeling, de middenlob tot y≈-20,9
// en de zoom tot y≈10,5. Iets ruimer genomen zodat de contourlijnen niet net
// tegen de viewBox-rand aanlopen.
const KAP_VIEWBOX = "23 -22.5 54 35";

/** De narrenkap die over de bovenrand van de portretlijst hangt: twee slappe
 *  zijlobben (gespiegeld om de as), een scheve middenlob, de gouden kraag die
 *  hem in de rand klemt, en drie belletjes. De CSS schuift de kaart zó dat de
 *  onderkant van de kraag ín de bovenrand valt — dát maakt hem geïntegreerd
 *  i.p.v. erop geplakt. */
export function PiasNarrenkap({ className }: { className?: string }) {
  const id = "pias-kap";
  return (
    <svg
      className={className}
      viewBox={KAP_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <PiasVerlopen id={id} />
      </defs>
      {/* Achterlaag: de lobben komen van achter de lijst vandaan. */}
      <PiasStofStreng streng={PIAS_KAP_ZIJLOB} id={id} />
      <g transform="translate(100,0) scale(-1,1)">
        <PiasStofStreng streng={PIAS_KAP_ZIJLOB} id={id} />
      </g>
      {/* De middenlob leunt scheef en staat dus niet op de as: niet spiegelen. */}
      <PiasStofStreng streng={PIAS_KAP_MIDDENLOB} id={id} />
      {/* Voorlaag: de kraag ligt over de lobben én over de lijst. */}
      {[PIAS_KAP_ZOOM, PIAS_KAP_BAND].map((d) => (
        <path
          key={d}
          d={d}
          fill={`url(#${id}-goud)`}
          stroke={PIAS_GOUD_CONTOUR}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
      ))}
      {PIAS_KAP_NERVEN.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIAS_GOUD_GRAVURE}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      ))}
      {PIAS_KAP_BELLEN.map((bel) => (
        <PiasBelletje key={`${bel.cx}-${bel.cy}`} bel={bel} id={id} />
      ))}
    </svg>
  );
}

/* ---------------------------- maskermedaillon ---------------------------- */

// Omhullende van ring (cx 50, cy 126,8, rx 10,2 / ry 9,8), de twee voluten
// (x 37,8–62,2) en het masker (y 118,9–135).
const MEDAILLON_VIEWBOX = "37.4 116.3 25.2 21";

/** Het compacte gebarsten maskermedaillon in de onderhoek van de portretlijst:
 *  gouden ring, bordeaux binnenvlak en daarin één masker dat middendoor
 *  gebarsten is — links de komedie, rechts de tragedie. De voluten zetten het
 *  zegel aan de lijst vast, zodat het erbij hoort en er niet op ligt. */
export function PiasMaskerMedaillon({ className }: { className?: string }) {
  const id = "pias-med";
  return (
    <svg
      className={className}
      viewBox={MEDAILLON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <PiasVerlopen id={id} />
      </defs>
      <g id="pias-med-volute">
        {PIAS_MED_VOLUTE.map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={`url(#${id}-goud)`}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        ))}
      </g>
      <use href="#pias-med-volute" transform="translate(100,0) scale(-1,1)" />
      <path
        d={PIAS_MED_RING}
        fill={`url(#${id}-goud)`}
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.6"
      />
      <path
        d={PIAS_MED_VLAK}
        fill={`url(#${id}-stof)`}
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.4"
      />
      <path
        d={PIAS_MED_HAARLIJN}
        fill="none"
        stroke={PIAS_GOUD_GLANS}
        strokeWidth="0.3"
      />
      <path
        d={PIAS_MED_MASKER}
        fill={`url(#${id}-goud)`}
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      {PIAS_MED_TREKKEN.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIAS_GOUD_GRAVURE}
          strokeWidth="0.55"
          strokeLinecap="round"
        />
      ))}
      <path d={PIAS_MED_TRAAN} fill={PIAS_GOUD_SCHADUW} />
      <path
        d={PIAS_MED_BARST}
        fill="none"
        stroke={PIAS_GOUD_CONTOUR}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------- badge-icoon ------------------------------- */

/** Het icoontje links in de titelbadge: hetzelfde gebarsten masker als het
 *  medaillon, maar vlak en in de tekstkleur van de badge. Een eigen SVG i.p.v.
 *  de 🤡-emoji uit #682: die rendert per platform anders (en op sommige zelfs
 *  als eng clownsgezicht), terwijl dit masker het register van de kaart draagt.
 *  `currentColor` houdt het per definitie op hetzelfde contrast als de titel. */
export function PiasBadgeIcoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="42.1 118.5 15.8 16.9"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PIAS_MED_MASKER} fill="currentColor" />
      {/* Dunner dan op het medaillon en zónder traan: op ±16 px zou elk extra
          detail het maskertje tot een vlek maken. De barst blijft — dát is wat
          een komisch masker van een gevállen masker onderscheidt. */}
      {PIAS_MED_TREKKEN.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke="rgba(84, 18, 10, 0.8)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      ))}
      <path
        d={PIAS_MED_BARST}
        fill="none"
        stroke="rgba(84, 18, 10, 0.8)"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------- watermerk ------------------------------- */

/** Het maskerwatermerk achter het verhaalpaneel: twee tragikomische maskers die
 *  elkaar overlappen, als nauwelijks zichtbare gravure in het perkament. Zelfde
 *  silhouetten als in het kaartmotief, alleen los geplaatst — op deze breedte is
 *  het rechterpaneel de enige plek waar zo'n vlak past zonder onder tekst te
 *  verdwijnen. */
export function PiasWatermerk({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={PIAS_WATERMERK.viewBox}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMaxYMid meet"
    >
      <path
        d={PIAS_WATERMERK.klein}
        fill="none"
        stroke={PIAS_WATERMERK.lijn}
        strokeWidth="1"
        opacity="0.8"
      />
      <path d={PIAS_WATERMERK.groot} fill={PIAS_MOTIEF_INK} />
      <path
        d={PIAS_WATERMERK.groot}
        fill="none"
        stroke={PIAS_WATERMERK.lijn}
        strokeWidth="1.2"
      />
      {PIAS_WATERMERK.trekken.map((d) => (
        <path key={d} d={d} fill={PIAS_WATERMERK.lijn} />
      ))}
    </svg>
  );
}

/* -------------------------------- chevrons -------------------------------- */

/** Twee neerwaartse chevrons onder het verhaal: de daling, letterlijk. Staan
 *  in de flow (geen absolute laag), zodat ze per constructie niets kunnen
 *  bedekken en de kaart niet kunnen laten verspringen. */
export function PiasChevrons({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-11 -1.5 22 20"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 8.4].map((dy) => (
        <path
          key={dy}
          d={`M -8.4 ${dy} L 0 ${dy + 8.4} L 8.4 ${dy}`}
          fill="none"
          stroke={PIAS_MOTIEF_INKTEN.chevron}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

/* ------------------------------ kaartdecoratie ------------------------------ */

// De harlekijntegel in px i.p.v. kaart-units: net als de vezeltegel van het
// karton mag dit motief níet meeschalen met de kaartbreedte, anders wordt het
// op een brede kaart een groot vlakverdeling-patroon i.p.v. stofdruk. De
// verhouding komt wél uit de kaart (2×6,8 bij 2×11,6 units → 1 : 1,706).
const RUIT_TEGEL_B = 44;
const RUIT_TEGEL_H = Math.round(
  (RUIT_TEGEL_B * PIAS_RUIT.halveHoogte) / PIAS_RUIT.halveBreedte,
);

/** Confettisnippers: hoekige papiertjes, geen ronde stipjes — het feest is
 *  voorbij, dit is wat er is blijven liggen. Positie in procenten van de kaart
 *  (nested `<svg>`), maat in px, zodat ze op elke breedte even groot en even
 *  schaars blijven. Bewust langs de randen en in de kier tussen portret en
 *  verhaal, nooit midden op de tekst. */
const SNIPPERS: readonly {
  x: string;
  y: string;
  hoek: number;
  schaal: number;
}[] = [
  { x: "23%", y: "7%", hoek: -18, schaal: 1 },
  { x: "41%", y: "4%", hoek: 24, schaal: 0.8 },
  { x: "62%", y: "6%", hoek: -8, schaal: 0.9 },
  { x: "39%", y: "34%", hoek: 38, schaal: 0.85 },
  { x: "40%", y: "72%", hoek: -30, schaal: 1 },
  { x: "94%", y: "18%", hoek: 12, schaal: 0.9 },
  { x: "93%", y: "63%", hoek: -22, schaal: 0.8 },
];

/** Eén snipper in px rond de oorsprong: een geknipt vierhoekje, geen ruit. */
const SNIPPER_PAD = "M -5 -4 L 4.5 -2.6 L 3.4 4.2 L -4.2 2.2 Z";

/** Barstjes in het perkament: van rand naar binnen, nooit los in het midden —
 *  dat is wat een barst van een kras onderscheidt. */
const BARSTEN: readonly { x: string; y: string; d: string }[] = [
  { x: "0%", y: "0%", d: "M 6 0 L 14 26 L 9 40 L 19 66" },
  { x: "100%", y: "0%", d: "M -8 0 L -18 22 L -12 36 L -22 58" },
  { x: "0%", y: "100%", d: "M 10 0 L 22 -20 L 17 -34" },
  { x: "100%", y: "100%", d: "M -12 0 L -24 -26 L -19 -44 L -30 -62" },
];

/** Hoekbelletjes: de enige plek waar de narrenkleding nog terugkomt buiten de
 *  portretlijst — in de hoeken, zoals de referentie, en niet over de inhoud. */
const HOEKEN: readonly { x: string; y: string }[] = [
  { x: "2.6%", y: "3.2%" },
  { x: "97.4%", y: "3.2%" },
  { x: "2.6%", y: "96.8%" },
  { x: "97.4%", y: "96.8%" },
];

// In kaart-units getekend en daarna geschaald, niet meteen in px: `belPaden`
// zet naad, klepelgat en glans in verhouding tot de straal, maar de contour- en
// gravurelijnen staan hierboven op vaste diktes uit het kaart-register. Alleen
// een schaaltransform houdt die verhouding kloppend.
const HOEKBEL: PiasBel = { cx: 0, cy: 0, r: 2.6 };
/** Het halsje waarmee het belletje aan de rand hangt. */
const HOEKBEL_HALS = "M -0.85 -4.3 L 0.85 -4.3 L 0.6 -2.2 L -0.6 -2.2 Z";
const HOEKBEL_SCHAAL = 2.4;

/**
 * De decoratieve achtergrondlagen van de kaart: harlekijnruiten, barstjes,
 * confettisnippers en de vier hoekbelletjes. Eén SVG i.p.v. acht losse: de
 * nested-`<svg>`-truc laat elk ornament op een procentpositie staan met zijn
 * eigen px-maat, dus er is maar één root nodig — en dus ook maar één kopie van
 * de verlopen.
 *
 * De ruiten worden naar links uitgemaskeerd: onder het portret voegt het
 * patroon niets toe (daar ligt de foto overheen) en op de metadata eronder zou
 * het de leesbaarheid van naam en week aantasten.
 */
export function PiasKaartDecor({ className }: { className?: string }) {
  const id = "pias-decor";
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <PiasVerlopen id={id} />
        <pattern
          id={`${id}-ruiten`}
          width={RUIT_TEGEL_B}
          height={RUIT_TEGEL_H}
          patternUnits="userSpaceOnUse"
        >
          {/* Eén donkere ruit in het hart van de tegel; de vier kwarten in de
              hoeken vormen samen de lichte tegenfamilie. */}
          <path
            d={`M ${RUIT_TEGEL_B / 2} 0 L ${RUIT_TEGEL_B} ${RUIT_TEGEL_H / 2} L ${RUIT_TEGEL_B / 2} ${RUIT_TEGEL_H} L 0 ${RUIT_TEGEL_H / 2} Z`}
            fill={PIAS_RUIT.donker}
          />
          {[
            [0, 0],
            [RUIT_TEGEL_B, 0],
            [0, RUIT_TEGEL_H],
            [RUIT_TEGEL_B, RUIT_TEGEL_H],
          ].map(([cx, cy]) => (
            <path
              key={`${cx}-${cy}`}
              d={`M ${cx} ${cy - RUIT_TEGEL_H / 2} L ${cx + RUIT_TEGEL_B / 2} ${cy} L ${cx} ${cy + RUIT_TEGEL_H / 2} L ${cx - RUIT_TEGEL_B / 2} ${cy} Z`}
              fill={PIAS_RUIT.licht}
            />
          ))}
        </pattern>
        <linearGradient id={`${id}-ruitverloop`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.2" stopColor="#000000" />
          <stop offset="0.62" stopColor="#ffffff" />
        </linearGradient>
        <mask id={`${id}-ruitvenster`}>
          <rect
            width="100%"
            height="100%"
            fill={`url(#${id}-ruitverloop)`}
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill={`url(#${id}-ruiten)`}
        mask={`url(#${id}-ruitvenster)`}
      />
      {BARSTEN.map((b) => (
        <svg key={b.d} x={b.x} y={b.y} overflow="visible">
          <path
            d={b.d}
            fill="none"
            stroke={PIAS_MOTIEF_INKTEN.barst}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      ))}
      {SNIPPERS.map((s) => (
        <svg key={`${s.x}-${s.y}`} x={s.x} y={s.y} overflow="visible">
          <path
            d={SNIPPER_PAD}
            fill={PIAS_MOTIEF_INKTEN.snipper}
            transform={`rotate(${s.hoek}) scale(${s.schaal})`}
          />
        </svg>
      ))}
      {HOEKEN.map((h) => (
        <svg key={`${h.x}-${h.y}`} x={h.x} y={h.y} overflow="visible">
          <g transform={`scale(${HOEKBEL_SCHAAL})`}>
            <path
              d={HOEKBEL_HALS}
              fill={`url(#${id}-goud)`}
              stroke={PIAS_GOUD_CONTOUR}
              strokeWidth="0.4"
            />
            <PiasBelletje bel={HOEKBEL} id={id} />
          </g>
        </svg>
      ))}
    </svg>
  );
}
