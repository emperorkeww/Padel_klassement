// Ornamentlagen van de Big Daddy-kaart op het dashboard (#771).
//
// Alles hier komt uit het ornamentregister van de 👑-FUT-kaart (#710,
// ornamentenBigDaddy.ts): dezelfde kroon, dezelfde linten, dezelfde twee
// ballonnen en dezelfde confettisnippers. Dat is geen zuinigheid maar de kern
// van de opdracht — het is dezelfde titel in hetzelfde register, dus als de
// kaart ooit hertint wordt moet het dashboard meebewegen. Zou dit bestand eigen
// paden en hexen dragen, dan drijven ze stil uit elkaar. Zelfde afspraak als
// piasOrnamenten.tsx voor De Schandpaal (#770).
//
// Wat hier wél nieuw is, is de uitleg: de FUT-kaart is een schild van 100×139
// units waar de ornamenten langs de rand liggen. Deze kaart is breed en
// vloeiend, dus elk ornament krijgt zijn eigen SVG met een viewBox rond zíjn
// omhullende, en de CSS plaatst het. Zo blijft elke vorm onvervormd, hoe breed
// de kaart ook uitvalt. De omhullenden worden hier berekend met `padDoos` uit
// datzelfde register — geen overgeschreven getallen die kunnen verlopen.
//
// Bewust geen beweging: de kroon draagt al de premium glans van #773 (die de
// hero statisch toont, zie heroDivisie.ts). Er is dus niets dat
// `prefers-reduced-motion` moet dempen.

import {
  BD_BALLON_GLANS,
  BD_BALLON_TOUW,
  BD_BALLONNEN,
  BD_CONFETTI,
  BD_CONTOUR,
  BD_GLANS,
  BD_KROON,
  BD_KROON_BAND,
  BD_KROON_BANDGLANS,
  BD_KROON_BOLLEN,
  BD_KROON_STEEN,
  BD_KROON_STEEN_FACETTEN,
  BD_LINT_AS,
  BD_LINT_BOOG,
  BD_LINT_STAART,
  BD_LINT_VERLOOP,
  BD_RIBBEL,
  BD_RIBBELGLANS,
  BD_ROSEGOUD,
  BD_SCHADUW,
  cirkelPad,
  padDoos,
} from "@/features/rating/components/ornamentenBigDaddy";
import type { Streng } from "@/features/rating/components/futKaartOrnamenten";

/* ------------------------------ hulpstukken ------------------------------ */

/** viewBox rond een verzameling paden, met wat lucht zodat contourlijnen niet
 *  tegen de rand aanlopen. */
function doosVan(paden: readonly string[], marge = 1.5): string {
  const dozen = paden.map(padDoos);
  const x = Math.min(...dozen.map((d) => d.x)) - marge;
  const y = Math.min(...dozen.map((d) => d.y)) - marge;
  const x2 = Math.max(...dozen.map((d) => d.x + d.b)) + marge;
  const y2 = Math.max(...dozen.map((d) => d.y + d.h)) + marge;
  return `${x} ${y} ${x2 - x} ${y2 - y}`;
}

/** Het roségoud van de kroon en de linten. Eigen id's (`hero-bd-*`) i.p.v. die
 *  van de kaart: twee defs met hetzelfde id in één document laat de tweede
 *  stilletjes verliezen, en op de showcase staan tien van deze kaarten. */
function BdVerlopen({ id }: { id: string }) {
  return (
    <>
      <linearGradient
        id={`${id}-metaal`}
        gradientUnits="objectBoundingBox"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        {BD_ROSEGOUD.map(([offset, kleur]) => (
          <stop key={offset} offset={offset} stopColor={kleur} />
        ))}
      </linearGradient>
      {/* Het lint heeft een vaste as in kaart-units: twee bogen vormen samen één
          voorwerp, dus de as mag niet per streng meeschalen (zelfde reden als in
          FutKaart.tsx). */}
      <linearGradient
        id={`${id}-lint`}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1={BD_LINT_AS[0]}
        x2="0"
        y2={BD_LINT_AS[1]}
      >
        {BD_LINT_VERLOOP.map(([offset, kleur]) => (
          <stop key={offset} offset={offset} stopColor={kleur} />
        ))}
      </linearGradient>
    </>
  );
}

/** Eén streng (lintboog, staart): omtrek in zijn materiaal, met de ribbels en
 *  de schaduw die hem rondte geven. Dezelfde opbouw als FutStreng. */
function BdStreng({ streng, vulling }: { streng: Streng; vulling: string }) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={vulling}
        stroke={BD_CONTOUR}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_RIBBELGLANS}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_RIBBEL}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      ))}
      <path d={streng.schaduw} fill={BD_SCHADUW} stroke="none" />
      <path d={streng.rug} fill={BD_GLANS} stroke="none" opacity="0.5" />
    </>
  );
}

/* --------------------------------- kroon --------------------------------- */

const KROON_PADEN = [
  BD_KROON,
  BD_KROON_STEEN,
  ...BD_KROON_BAND,
  ...BD_KROON_BOLLEN.map((b) => cirkelPad(b)),
];
const KROON_VIEWBOX = doosVan(KROON_PADEN);

/** De driepuntige kroon in de bovenrand van de kaart: hetzelfde silhouet dat op
 *  de FUT-kaart in de bovenste inkeping valt. De CSS schuift hem zó dat de
 *  voetband ín de rand ligt — dát maakt hem geïntegreerd i.p.v. erop geplakt. */
export function BigDaddyKroonCrest({ className }: { className?: string }) {
  const id = "hero-bd-kroon";
  return (
    <svg
      className={className}
      viewBox={KROON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <BdVerlopen id={id} />
      </defs>
      <path
        d={BD_KROON}
        fill={`url(#${id}-metaal)`}
        stroke={BD_CONTOUR}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {BD_KROON_BAND.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_RIBBEL}
          strokeWidth="0.45"
          strokeLinecap="round"
        />
      ))}
      {BD_KROON_BANDGLANS.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_RIBBELGLANS}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      ))}
      {BD_KROON_BOLLEN.map((b) => (
        <path
          key={`${b.cx}-${b.cy}`}
          d={cirkelPad(b)}
          fill={`url(#${id}-metaal)`}
          stroke={BD_CONTOUR}
          strokeWidth="0.45"
        />
      ))}
      <path
        d={BD_KROON_STEEN}
        fill={`url(#${id}-metaal)`}
        stroke={BD_CONTOUR}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      {BD_KROON_STEEN_FACETTEN.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={BD_RIBBELGLANS}
          strokeWidth="0.3"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

/* --------------------------------- lint ---------------------------------- */

const LINT_VIEWBOX = doosVan([BD_LINT_BOOG.omtrek, BD_LINT_STAART.omtrek]);

/** De lintboog met geknipte staart, als compact hoekornament. Op de kaart welft
 *  hij langs de flank; hier staat hij in de onderhoeken, waar hij de rand
 *  vastzet zonder de knoppen te raken. De CSS spiegelt hem voor de andere hoek,
 *  zodat links en rechts per constructie hetzelfde zijn. */
export function BigDaddyLint({ className }: { className?: string }) {
  const id = "hero-bd-lint";
  return (
    <svg
      className={className}
      viewBox={LINT_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <BdVerlopen id={id} />
      </defs>
      <BdStreng streng={BD_LINT_BOOG} vulling={`url(#${id}-lint)`} />
      <BdStreng streng={BD_LINT_STAART} vulling={`url(#${id}-lint)`} />
    </svg>
  );
}

/* ------------------------------- ballonnen ------------------------------- */

const BALLON_VIEWBOX = doosVan([
  ...BD_BALLONNEN.map((b) => b.d),
  ...BD_BALLONNEN.map((b) => b.touw),
]);

/** De twee ballonnen die op de kaart rechtsboven uit de rand komen. Meer dan
 *  twee zou van de kaart een verjaardagskaart maken — de issue vraagt er
 *  expliciet om het daarbij te laten. */
export function BigDaddyBallonnen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={BALLON_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {BD_BALLONNEN.map((b) => (
          <linearGradient
            key={b.id}
            id={`hero-bd-ballon-${b.id}`}
            gradientUnits="userSpaceOnUse"
            x1={b.doos.x}
            y1={b.doos.y}
            x2={b.doos.x + b.doos.b}
            y2={b.doos.y + b.doos.h}
          >
            {b.verloop.map(([offset, kleur]) => (
              <stop key={offset} offset={offset} stopColor={kleur} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {BD_BALLONNEN.map((b) => (
        <g key={b.id}>
          <path
            d={b.touw}
            fill="none"
            stroke={BD_BALLON_TOUW}
            strokeWidth="0.45"
            strokeLinecap="round"
          />
          <path
            d={b.d}
            fill={`url(#hero-bd-ballon-${b.id})`}
            stroke={BD_CONTOUR}
            strokeWidth="0.4"
          />
          <path d={b.knoop} fill={`url(#hero-bd-ballon-${b.id})`} stroke="none" />
          <path d={cirkelPad(b.glans)} fill={BD_BALLON_GLANS} stroke="none" />
        </g>
      ))}
    </svg>
  );
}

/* -------------------------------- confetti ------------------------------- */

const CONFETTI_VIEWBOX = doosVan(BD_CONFETTI.map((c) => c.d));

/** De handvol goudkleurige snippers van de kaart. Geen regenboog en geen wolk:
 *  het zijn er precies zoveel als op de FUT-kaart. */
export function BigDaddyConfetti({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={CONFETTI_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      {BD_CONFETTI.map((c) => (
        <path key={c.d} d={c.d} fill={c.kleur} />
      ))}
    </svg>
  );
}
