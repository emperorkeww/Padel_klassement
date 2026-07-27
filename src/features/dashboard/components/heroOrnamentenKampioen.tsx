// Ornamentlagen van de Kampioen-kaart op het dashboard (#781).
//
// Alle vormen komen uit het register van de 🏆-FUT-kaart (#710,
// ornamentenKampioen.ts): de diamantcrest, de lauwerkrans en de medaillelinten.
// Net als bij de Big Daddy en de Piet gebruiken we de omhullende-berekening
// (`padDoos`) om elk ornament in een eigen compacte SVG-box te plaatsen. De CSS
// regelt de plaatsing op de brede dashboardkaart.

import {
  KAMPIOEN_CREST_FACET,
  KAMPIOEN_CREST_GLANS,
  KAMPIOEN_CREST_KLAUW,
  KAMPIOEN_CREST_KRUIS,
  KAMPIOEN_CREST_RING,
  KAMPIOEN_CREST_RING_KLEUR,
  KAMPIOEN_CREST_STEEN,
  KAMPIOEN_CREST_ZETTING,
  KAMPIOEN_KRANS_BLAD,
  KAMPIOEN_KRANS_STAM,
  KAMPIOEN_LINT_BUITEN,
  KAMPIOEN_LINT_CONTOUR,
  KAMPIOEN_LINT_LIJN,
  KAMPIOEN_LINT_PLATINA,
  KAMPIOEN_LOOF_AS,
  KAMPIOEN_LOOF_CONTOUR,
  KAMPIOEN_LOOF_GLANS,
  KAMPIOEN_LOOF_NERF,
  KAMPIOEN_LOOF_SCHADUW,
  KAMPIOEN_LOOF_VERLOOP,
  KAMPIOEN_STEEN_CONTOUR,
  KAMPIOEN_STEEN_FACET,
  KAMPIOEN_STEEN_FACETTEN,
  KAMPIOEN_STEEN_GLANS,
  KAMPIOEN_STEEN_KLAUW,
  KAMPIOEN_ZETTING_AS,
  KAMPIOEN_ZETTING_CONTOUR,
  KAMPIOEN_ZETTING_VERLOOP,
  KAMPIOEN_LINT_AS_VERLOOP,
  KAMPIOEN_LINT_GROEN_VERLOOP,
  KAMPIOEN_LINT_PLATINA_VERLOOP,
} from "@/features/rating/components/ornamentenKampioen";
import { padDoos } from "@/features/rating/components/ornamentenBigDaddy";

/* ------------------------------ hulpstukken ------------------------------ */

function doosVan(paden: readonly string[], marge = 1.5): string {
  const dozen = paden.map(padDoos);
  const x = Math.min(...dozen.map((d) => d.x)) - marge;
  const y = Math.min(...dozen.map((d) => d.y)) - marge;
  const x2 = Math.max(...dozen.map((d) => d.x + d.b)) + marge;
  const y2 = Math.max(...dozen.map((d) => d.y + d.h)) + marge;
  return `${x} ${y} ${x2 - x} ${y2 - y}`;
}

/* --------------------------------- crest --------------------------------- */

const CREST_VIEWBOX = "41.7 -5.7 16.6 19";

/** De diamantcrest in de bovenrand: platina zetting, smaragden binnenring en de
 *  gefacetteerde saffier. Sits in the top notched border of the card. */
export function KampioenKransCrest({ className }: { className?: string }) {
  const id = "hero-kampioen-crest";
  return (
    <svg
      className={className}
      viewBox={CREST_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-zetting`}
          gradientUnits="userSpaceOnUse"
          x1={KAMPIOEN_ZETTING_AS[0]}
          y1={KAMPIOEN_ZETTING_AS[1]}
          x2={KAMPIOEN_ZETTING_AS[2]}
          y2={KAMPIOEN_ZETTING_AS[3]}
        >
          {KAMPIOEN_ZETTING_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
      </defs>
      <path
        d={KAMPIOEN_CREST_ZETTING}
        fill={`url(#${id}-zetting)`}
        stroke={KAMPIOEN_ZETTING_CONTOUR}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path d={KAMPIOEN_CREST_RING} fill={KAMPIOEN_CREST_RING_KLEUR} />
      {KAMPIOEN_CREST_FACET.map((d, i) => (
        <path key={d} d={d} fill={KAMPIOEN_STEEN_FACETTEN[i]} />
      ))}
      <path
        d={KAMPIOEN_CREST_KRUIS}
        fill="none"
        stroke={KAMPIOEN_STEEN_FACET}
        strokeWidth="0.3"
      />
      <path
        d={KAMPIOEN_CREST_STEEN}
        fill="none"
        stroke={KAMPIOEN_STEEN_CONTOUR}
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
      {KAMPIOEN_CREST_KLAUW.map((d) => (
        <path key={d} d={d} fill={KAMPIOEN_STEEN_KLAUW} />
      ))}
      <path d={KAMPIOEN_CREST_GLANS} fill={KAMPIOEN_STEEN_GLANS} />
    </svg>
  );
}

/* --------------------------------- krans --------------------------------- */

const KRANS_VIEWBOX = doosVan([
  KAMPIOEN_KRANS_STAM.omtrek,
  ...KAMPIOEN_KRANS_BLAD.map((b) => b.d),
]);

/** Een halve lauwerkrans (verticale tak): de stam, ribbels en bladeren met hun
 *  reliëf. De CSS spiegelt en plaatst deze langs de linker- en rechterranden
 *  van de dashboardkaart. */
export function KampioenKrans({ className }: { className?: string }) {
  const id = "hero-kampioen-krans";
  return (
    <svg
      className={className}
      viewBox={KRANS_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-loof`}
          gradientUnits="userSpaceOnUse"
          x1={KAMPIOEN_LOOF_AS[0]}
          y1={KAMPIOEN_LOOF_AS[1]}
          x2={KAMPIOEN_LOOF_AS[2]}
          y2={KAMPIOEN_LOOF_AS[3]}
        >
          {KAMPIOEN_LOOF_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
      </defs>
      <g>
        <path
          d={KAMPIOEN_KRANS_STAM.omtrek}
          fill={`url(#${id}-loof)`}
          stroke={KAMPIOEN_LOOF_CONTOUR}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        {KAMPIOEN_KRANS_STAM.ribbelGlans.map((d, i) => (
          <path
            key={`rg-${i}`}
            d={d}
            fill="none"
            stroke={KAMPIOEN_LOOF_GLANS}
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        ))}
        {KAMPIOEN_KRANS_STAM.ribbels.map((d, i) => (
          <path
            key={`r-${i}`}
            d={d}
            fill="none"
            stroke={KAMPIOEN_LOOF_NERF}
            strokeWidth="0.4"
            strokeLinecap="round"
          />
        ))}
        <path
          d={KAMPIOEN_KRANS_STAM.schaduw}
          fill="none"
          stroke={KAMPIOEN_LOOF_SCHADUW}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d={KAMPIOEN_KRANS_STAM.highlight}
          fill="none"
          stroke={KAMPIOEN_LOOF_GLANS}
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        {KAMPIOEN_KRANS_BLAD.map((b) => (
          <g key={b.d}>
            <path
              d={b.d}
              fill={`url(#${id}-loof)`}
              stroke={KAMPIOEN_LOOF_CONTOUR}
              strokeWidth="0.35"
              strokeLinejoin="round"
            />
            <path
              d={b.rand}
              fill="none"
              stroke={KAMPIOEN_LOOF_GLANS}
              strokeWidth="0.45"
              strokeLinecap="round"
            />
            <path
              d={b.nerf}
              fill="none"
              stroke={KAMPIOEN_LOOF_NERF}
              strokeWidth="0.35"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/* --------------------------------- lint ---------------------------------- */

const LINT_VIEWBOX = doosVan([
  KAMPIOEN_LINT_BUITEN.d,
  KAMPIOEN_LINT_PLATINA.d,
]);

/** Een medaillelint (boog + staart): de groene en platina plooien met vouwlijnen.
 *  De CSS spiegelt en plaatst deze in de onderste hoeken van de kaart. */
export function KampioenLint({ className }: { className?: string }) {
  const id = "hero-kampioen-lint";
  return (
    <svg
      className={className}
      viewBox={LINT_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={`${id}-groen`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={KAMPIOEN_LINT_AS_VERLOOP[0]}
          x2="0"
          y2={KAMPIOEN_LINT_AS_VERLOOP[1]}
        >
          {KAMPIOEN_LINT_GROEN_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
        <linearGradient
          id={`${id}-platina`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1={KAMPIOEN_LINT_AS_VERLOOP[0]}
          x2="0"
          y2={KAMPIOEN_LINT_AS_VERLOOP[1]}
        >
          {KAMPIOEN_LINT_PLATINA_VERLOOP.map(([offset, kleur]) => (
            <stop key={offset} offset={offset} stopColor={kleur} />
          ))}
        </linearGradient>
      </defs>
      <g>
        <path
          d={KAMPIOEN_LINT_BUITEN.d}
          fill={`url(#${id}-groen)`}
          stroke={KAMPIOEN_LINT_CONTOUR}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {KAMPIOEN_LINT_BUITEN.lijnen.map((d, i) => (
          <path
            key={`b-${i}`}
            d={d}
            fill="none"
            stroke={KAMPIOEN_LINT_LIJN}
            strokeWidth="0.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        <path
          d={KAMPIOEN_LINT_PLATINA.d}
          fill={`url(#${id}-platina)`}
          stroke={KAMPIOEN_LINT_CONTOUR}
          strokeWidth="0.5"
          strokeLinejoin="round"
        />
        {KAMPIOEN_LINT_PLATINA.lijnen.map((d, i) => (
          <path
            key={`p-${i}`}
            d={d}
            fill="none"
            stroke={KAMPIOEN_LINT_LIJN}
            strokeWidth="0.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
    </svg>
  );
}
