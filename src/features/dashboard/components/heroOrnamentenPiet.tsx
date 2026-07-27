// Ornamentlagen van het schande-token op het dashboard (#771).
//
// De variant heet intern nog `piet` (klassen, statusvlaggen), maar de tekening
// is en blijft volstrekt abstract: een pion, doorgeefringen, kaarttekens, een
// gebroken lakzegel en een ketting met sluiting. Geen menselijke, raciale of
// koloniale uitbeelding — dat is een harde eis van de issue, en het register van
// #645/#710 (ornamentenPiet.ts) is er al op gebouwd. Alles hier komt daar
// letterlijk vandaan; zou dit bestand eigen paden dragen, dan drijven kaart en
// dashboard uit elkaar (zelfde afspraak als heroOrnamentenBigDaddy.tsx).
//
// De FUT-kaart legt deze ornamenten langs de rand van een schild van 100×139
// units. Deze kaart is breed, dus krijgt elk ornament zijn eigen viewBox rond
// zíjn omhullende — de `doos` die het register per ornament meelevert — en
// plaatst de CSS het.
//
// Geen beweging: schande glimt niet (#705/#710). Er is dus ook niets dat
// `prefers-reduced-motion` moet dempen.

import {
  klaverPad,
  PIET_BREUK,
  PIET_BREUK_GLANS,
  PIET_CREST_DOOS,
  PIET_CREST_GRAVURE,
  PIET_CREST_PION,
  PIET_CREST_RING,
  PIET_CREST_SCHIJF,
  PIET_GRAVURE,
  PIET_KETTING,
  PIET_KETTING_DRAAD,
  PIET_LAK,
  PIET_LAK_RAND,
  PIET_SLUITING,
  PIET_STAAL_CONTOUR,
  PIET_STAAL_VERLOOP,
  PIET_ZEGEL_BREUK,
  PIET_ZEGEL_DOOS,
  PIET_ZEGEL_DRAAD,
  PIET_ZEGEL_GRAVURE,
  PIET_ZEGEL_HELFT_LINKS,
  PIET_ZEGEL_HELFT_RECHTS,
  PIET_ZEGEL_SCHIJF,
  PIET_ZEGEL_STUKKEN,
  schoppenPad,
  type Doos,
} from "@/features/rating/components/ornamentenPiet";

/* ------------------------------ hulpstukken ------------------------------ */

/** viewBox rond een of meer omhullenden uit het register, met lucht voor de
 *  contourlijnen.
 *
 *  Bewust de meegeleverde `Doos`-velden en niet `padDoos` zoals bij Big Daddy:
 *  die helper leest álle getallen uit een pad-string en werkt daarom alleen op
 *  M/L/C-paden. Dit register tekent ringen en bogen met A-commando's, waar de
 *  stralen en de twee vlaggen tussen de coördinaten staan — dan komt er een veel
 *  te grote doos uit en verschrompelt het ornament in zijn eigen viewBox. */
function viewBoxVan(dozen: readonly Doos[], marge = 2): string {
  const x = Math.min(...dozen.map((d) => d.x)) - marge;
  const y = Math.min(...dozen.map((d) => d.y)) - marge;
  const x2 = Math.max(...dozen.map((d) => d.x + d.w)) + marge;
  const y2 = Math.max(...dozen.map((d) => d.y + d.h)) + marge;
  return `${x} ${y} ${x2 - x} ${y2 - y}`;
}

/** Het geoxideerde staal van ketting, ring en zegelbeugel. Eigen id per
 *  ornament-SVG: twee defs met hetzelfde id laten de tweede stilletjes
 *  verliezen, en op de showcase staan meerdere van deze kaarten. */
function PietStaal({ id }: { id: string }) {
  return (
    <linearGradient
      id={id}
      x1="0"
      y1="0"
      x2="0.3"
      y2="1"
      gradientUnits="objectBoundingBox"
    >
      {PIET_STAAL_VERLOOP.map(([offset, kleur]) => (
        <stop key={offset} offset={offset} stopColor={kleur} />
      ))}
    </linearGradient>
  );
}

/* --------------------------------- crest --------------------------------- */

const CREST_VIEWBOX = viewBoxVan([PIET_CREST_DOOS]);

/** De pioncrest in de bovenrand: stalen ring, matzwarte lakschijf en daarop het
 *  silhouet van een pion. Een eigen SVG en geen emoji — ♟ rendert per platform
 *  anders en draagt bovendien niet het materiaal van de kaart. */
export function PietPionCrest({ className }: { className?: string }) {
  const id = "hero-piet-crest";
  return (
    <svg
      className={className}
      viewBox={CREST_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <PietStaal id={`${id}-staal`} />
      </defs>
      <path
        d={PIET_CREST_RING}
        fill={`url(#${id}-staal)`}
        stroke={PIET_STAAL_CONTOUR}
        strokeWidth="0.5"
      />
      <path
        d={PIET_CREST_SCHIJF}
        fill={PIET_LAK}
        stroke={PIET_LAK_RAND}
        strokeWidth="0.4"
      />
      {PIET_CREST_GRAVURE.map((d) => (
        <path key={d} d={d} fill="none" stroke={PIET_GRAVURE} strokeWidth="0.3" />
      ))}
      <path
        d={PIET_CREST_PION}
        fill="#0d0c0a"
        stroke={PIET_LAK_RAND}
        strokeWidth="0.3"
      />
    </svg>
  );
}

/** Alleen de pion, in de tekstkleur van de badge — het icoon vóór "Zwarte Piet"
 *  in de statusbadge. `currentColor` houdt het per definitie op hetzelfde
 *  contrast als de titel ernaast. */
export function PietBadgeIcoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox={viewBoxVan([PIET_CREST_DOOS], 0.5)}
      aria-hidden="true"
      focusable="false"
    >
      <path d={PIET_CREST_PION} fill="currentColor" />
    </svg>
  );
}

/* --------------------------------- zegel --------------------------------- */

const ZEGEL_VIEWBOX = viewBoxVan([PIET_ZEGEL_DOOS]);

/** Het gebroken lakzegel: de schijf met zijn beugel, en dwars erdoorheen de
 *  breuk. Het token is doorgegeven, niet verdiend — dát vertelt de barst. */
export function PietGebrokenZegel({ className }: { className?: string }) {
  const id = "hero-piet-zegel";
  const helften = [PIET_ZEGEL_HELFT_LINKS, PIET_ZEGEL_HELFT_RECHTS];
  return (
    <svg
      className={className}
      viewBox={ZEGEL_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <PietStaal id={`${id}-staal`} />
      </defs>
      {helften.map((d) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={PIET_STAAL_CONTOUR}
          strokeWidth={PIET_ZEGEL_DRAAD + 0.7}
        />
      ))}
      <path
        d={PIET_ZEGEL_SCHIJF}
        fill={PIET_LAK}
        stroke={PIET_LAK_RAND}
        strokeWidth="0.4"
      />
      {helften.map((d) => (
        <path
          key={`s${d}`}
          d={d}
          fill="none"
          stroke={`url(#${id}-staal)`}
          strokeWidth={PIET_ZEGEL_DRAAD}
        />
      ))}
      {PIET_ZEGEL_GRAVURE.map((d) => (
        <path key={d} d={d} fill="none" stroke={PIET_GRAVURE} strokeWidth="0.35" />
      ))}
      {PIET_ZEGEL_STUKKEN.map((d) => (
        <path key={d} d={d} fill={PIET_GRAVURE} />
      ))}
      <path
        d={PIET_ZEGEL_BREUK}
        fill="none"
        stroke={PIET_BREUK_GLANS}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d={PIET_ZEGEL_BREUK}
        fill="none"
        stroke={PIET_BREUK}
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* -------------------------------- ketting -------------------------------- */

const KETTING_VIEWBOX = viewBoxVan([
  ...PIET_KETTING.map((s) => s.doos),
  PIET_SLUITING.doos,
]);

/** Het korte stuk ketting met zijn open sluiting, als hoekornament. Het token
 *  hangt aan een ketting die niet dichtklikt: hij schuift door zodra je wint. */
export function PietSluiting({ className }: { className?: string }) {
  const id = "hero-piet-ketting";
  return (
    <svg
      className={className}
      viewBox={KETTING_VIEWBOX}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <PietStaal id={`${id}-staal`} />
      </defs>
      {PIET_KETTING.map((s) => (
        <g key={s.ring}>
          <path
            d={s.ring}
            fill="none"
            stroke={PIET_STAAL_CONTOUR}
            strokeWidth={PIET_KETTING_DRAAD + 0.8}
          />
          <path
            d={s.ring}
            fill="none"
            stroke={`url(#${id}-staal)`}
            strokeWidth={PIET_KETTING_DRAAD}
          />
        </g>
      ))}
      {[PIET_SLUITING.balk, PIET_SLUITING.beugel].map((d) => (
        <g key={d}>
          <path
            d={d}
            fill="none"
            stroke={PIET_STAAL_CONTOUR}
            strokeWidth={PIET_SLUITING.draad + 0.8}
            strokeLinecap="round"
          />
          <path
            d={d}
            fill="none"
            stroke={`url(#${id}-staal)`}
            strokeWidth={PIET_SLUITING.draad - 0.3}
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------ doorgeefringen ---------------------------- */

/** Concentrische ringen met een klaver en een schoppen erin: het token gaat
 *  rond, en dat is precies wat deze tekening zegt. De ringen staan in een eigen
 *  vierkante doos; de CSS legt hem rechts, waar de tekstkolom ophoudt. */
export function PietDoorgeefringen({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {[46, 36, 26].map((r) => (
        <circle
          key={r}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.9"
        />
      ))}
      {/* De twee zwarte kaarttekens uit het register, klein en tegenover
          elkaar op de binnenste ring. */}
      <path d={klaverPad(50, 18, 9)} fill="currentColor" />
      <path d={schoppenPad(50, 82, 9)} fill="currentColor" />
    </svg>
  );
}
