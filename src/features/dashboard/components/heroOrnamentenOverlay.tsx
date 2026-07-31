// Ornamenten van de twee tijdelijke statusoverlays (#771).
//
// On Fire ligt bóven het permanente thema (zie HeroLagen) en moet dus twee dingen
// tegelijk: de status onmiskenbaar maken en de kaart eronder herkenbaar laten.
// Dat stuurt elke keuze hier — dunne crests en lijnen, geen vlakken; alles langs
// de randen, niets over de tekstkolom.
//
// In-Form deed dat tot #834 ook, met een bliksemwatermerk, een pulsring en twee
// snelheidslijnen. Sindsdien draagt die editie op élke kaart zijn eigen vlak met
// het artwork uit de referentie, en is van dit register alleen de schildcrest
// over. Zie docs/dashboard/in-form-dashboardkaart.md §4.
//
// De tekeningen komen uit het register van de ⚡- en 🔥-editie (#710,
// ornamentenInform.ts / ornamentenOnfire.ts): dezelfde bliksem, dezelfde
// vlamcrest, dezelfde vinnen en sintels. Alleen de plaatsing is nieuw, want de
// FUT-kaart hangt ze aan een schild van 100×139 units en deze kaart is breed.
//
// Beweging zit niet hier maar in de CSS (de gedeelde HeroSheen), achter
// `prefers-reduced-motion: no-preference`.

import {
  INFORM_CREST,
  INFORM_CREST_KERN,
  INFORM_CREST_PLAAT,
  INFORM_GOUD_CONTOUR,
  INFORM_GOUD_GLANS,
  INFORM_GOUD_VERLOOP,
  INFORM_TITAAN,
} from "@/features/rating/components/ornamentenInform";
import {
  ONFIRE_CREST_BAND,
  ONFIRE_CREST_NERVEN,
  ONFIRE_CREST_PLAAT,
  ONFIRE_CREST_VLAM,
  ONFIRE_KOPER,
  ONFIRE_SINTEL_GLOED,
  ONFIRE_SINTEL_KERN,
  ONFIRE_SINTELS,
  ONFIRE_STAAL_VERLOOP,
  ONFIRE_VINNEN,
} from "@/features/rating/components/ornamentenOnfire";
import { padDoos } from "@/features/rating/components/ornamentenBigDaddy";
import type { Streng } from "@/features/rating/components/futKaartOrnamenten";

/* ------------------------------ hulpstukken ------------------------------ */

/** viewBox rond M/L/C-paden, met lucht voor de contourlijnen. Deze twee
 *  registers tekenen zonder booggetallen, dus `padDoos` kan hier wél (anders dan
 *  bij het Piet-register, zie heroOrnamentenPiet.tsx). */
function doosVan(paden: readonly string[], marge = 1.5): string {
  const dozen = paden.map(padDoos);
  const x = Math.min(...dozen.map((d) => d.x)) - marge;
  const y = Math.min(...dozen.map((d) => d.y)) - marge;
  const x2 = Math.max(...dozen.map((d) => d.x + d.b)) + marge;
  const y2 = Math.max(...dozen.map((d) => d.y + d.h)) + marge;
  return `${x} ${y} ${x2 - x} ${y2 - y}`;
}

function Verloop({
  id,
  stops,
}: {
  id: string;
  stops: readonly (readonly [number, string])[];
}) {
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2="0.3"
      y2="1"
      gradientUnits="objectBoundingBox"
    >
      {stops.map(([offset, kleur]) => (
        <stop key={offset} offset={offset} stopColor={kleur} />
      ))}
    </linearGradient>
  );
}

/** Eén streng met zijn ribbels — de opbouw van FutStreng, zonder de rugband die
 *  deze twee materialen niet gebruiken. */
function OverlayStreng({
  streng,
  vulling,
  contour,
  ribbel,
  ribbelGlans,
  schaduw,
}: {
  streng: Streng;
  vulling: string;
  contour: string;
  ribbel: string;
  ribbelGlans: string;
  schaduw: string;
}) {
  return (
    <>
      <path
        d={streng.omtrek}
        fill={vulling}
        stroke={contour}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {streng.ribbelGlans.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={ribbelGlans}
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      ))}
      {streng.ribbels.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={ribbel}
          strokeWidth="0.5"
          strokeLinecap="round"
        />
      ))}
      <path d={streng.schaduw} fill={schaduw} stroke="none" />
    </>
  );
}

/* --------------------------------- In-Form -------------------------------- */

const SCHILD_VIEWBOX = doosVan([INFORM_CREST_PLAAT]);

/** Dezelfde bliksem op een schildplaat, voor de kaart die het In-Form-profiel
 *  zélf draagt (#834). Op een permanent thema blijft de kale glyph hierboven
 *  staan: daar is de crest een accent op andermans kaart en moet hij dun zijn.
 *  Op de eigen kaart is hij het insigne van de bovenrand, en dan heeft hij de
 *  drager nodig die de FUT-kaart in zijn inkeping al heeft. */
export function InformSchildCrest({ className }: { className?: string }) {
  const id = "hero-inform-schild-goud";
  return (
    <svg
      className={className}
      viewBox={SCHILD_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <Verloop id={id} stops={INFORM_GOUD_VERLOOP} />
      </defs>
      <path
        d={INFORM_CREST_PLAAT}
        fill={`url(#${id})`}
        stroke={INFORM_GOUD_CONTOUR}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d={INFORM_CREST_KERN} fill={INFORM_TITAAN} />
      <path
        d={INFORM_CREST_KERN}
        fill="none"
        stroke={INFORM_GOUD_GLANS}
        strokeWidth="0.3"
        opacity="0.45"
      />
      <path
        d={INFORM_CREST}
        fill={`url(#${id})`}
        stroke={INFORM_GOUD_CONTOUR}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* --------------------------------- On Fire -------------------------------- */

const VLAM_VIEWBOX = doosVan([
  ONFIRE_CREST_PLAAT,
  ONFIRE_CREST_BAND,
  ONFIRE_CREST_VLAM,
]);

/** De metalen vlamcrest: koperen plaat met band, en de vlam erin. */
export function OnfireVlamCrest({ className }: { className?: string }) {
  const id = "hero-onfire";
  return (
    <svg
      className={className}
      viewBox={VLAM_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <Verloop id={`${id}-staal`} stops={ONFIRE_STAAL_VERLOOP} />
        <Verloop id={`${id}-koper`} stops={ONFIRE_KOPER.verloop} />
      </defs>
      <path
        d={ONFIRE_CREST_PLAAT}
        fill={`url(#${id}-staal)`}
        stroke="rgba(20, 7, 4, 0.8)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d={ONFIRE_CREST_BAND} fill={`url(#${id}-koper)`} stroke="none" />
      <path
        d={ONFIRE_CREST_VLAM}
        fill={`url(#${id}-koper)`}
        stroke={ONFIRE_KOPER.contour}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      {ONFIRE_CREST_NERVEN.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={ONFIRE_KOPER.ribbelGlans}
          strokeWidth="0.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

const VINNEN_VIEWBOX = doosVan(ONFIRE_VINNEN.map((v) => v.omtrek));

/** De drie koperen vinnen als hittelijnen langs de rand. */
export function OnfireVinnen({ className }: { className?: string }) {
  const id = "hero-onfire-vin";
  return (
    <svg
      className={className}
      viewBox={VINNEN_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <Verloop id={id} stops={ONFIRE_KOPER.verloop} />
      </defs>
      {ONFIRE_VINNEN.map((vin) => (
        <OverlayStreng
          key={vin.omtrek}
          streng={vin}
          vulling={`url(#${id})`}
          contour={ONFIRE_KOPER.contour}
          ribbel={ONFIRE_KOPER.ribbel}
          ribbelGlans={ONFIRE_KOPER.ribbelGlans}
          schaduw={ONFIRE_KOPER.schaduw}
        />
      ))}
    </svg>
  );
}

/** De handvol sintelpunten langs de buitenrand. Zes stuks per kant, exact de
 *  plaatsen uit het register — geen PRNG-wolk, want dan staan kaart en dashboard
 *  niet meer op dezelfde plek. Ze staan stil: geanimeerde sintels kosten een
 *  laag per kaart en zeggen niets extra's. */
export function OnfireSintels({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-10 70 24 60"
      aria-hidden="true"
      focusable="false"
    >
      {ONFIRE_SINTELS.map(([u, v, r]) => (
        <g key={`${u}-${v}`}>
          <circle cx={u} cy={v} r={r * 2.6} fill={ONFIRE_SINTEL_GLOED} opacity="0.35" />
          <circle cx={u} cy={v} r={r} fill={ONFIRE_SINTEL_KERN} />
        </g>
      ))}
    </svg>
  );
}
