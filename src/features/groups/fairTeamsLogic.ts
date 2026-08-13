// Eerlijke teamindeling voor een speelavond: sorteer de aanwezigen op rating,
// vorm banen van aaneengesloten viertallen (zodat elke baan intern spannend is)
// en splits elk viertal zo dat het verschil in teamrating minimaal is.
// Spelers zonder rating tellen mee op de startrating (BASE_RATING = 1000),
// dezelfde basis als de rating-trigger in de databank — zie elo.ts.

import { BASE_RATING, expected } from "@/features/rating/elo";
import type { PlayerRating } from "@/types";

export interface FairTeam {
  playerIds: [string, string];
  /** Teamrating = gemiddelde van beide spelers (zoals in elo.ts). */
  rating: number;
}

export interface CourtProposal {
  teamA: FairTeam;
  teamB: FairTeam;
  /** Verwachte winstkans (0..1) van team A volgens de Elo-verwachting. */
  chanceA: number;
}

export interface FairTeamsResult {
  courts: CourtProposal[];
  /** Laagst gerankte spelers die geen volledige baan meer vullen. */
  reserves: string[];
}

// De drie mogelijke 2-2-splitsingen van een viertal (indices in het viertal).
const SPLITS: [[number, number], [number, number]][] = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

/** Opties voor {@link fairTeams}. */
export interface FairTeamsOptions {
  /**
   * Hoe vaak elke speler tot nu toe op de bank zat. Bepaalt wie er deze keer
   * reserve is wanneer het aantal spelers geen veelvoud van 4 is: wie het minst
   * heeft gezeten, blijft nu zitten — zo rouleren de bankbeurten eerlijk in
   * plaats van steeds bij de laagst geratede speler te belanden. Bij gelijke
   * (of ontbrekende) tellingen valt het terug op het oude gedrag: de laagst
   * geratede speler zit.
   */
  benched?: Record<string, number>;
}

/**
 * Wisselt spelers over de baangrenzen heen (#1271).
 *
 * "Andere verdeling" veranderde alleen wélke 2-2-splitsing er binnen een
 * viertal gekozen werd. Bij een aantal spelers dat deelbaar is door vier — geen
 * reserves, dus ook geen bankrotatie — betekende dat: je speelt vijf rondes
 * tegen dezelfde drie mensen, terwijl de knop wat anders belooft.
 *
 * De ruil gaat over de grens tussen twee banen, en begint bij de spelers die er
 * qua rating het dichtst bij zitten: eerst de laatste van baan 1 met de eerste
 * van baan 2, dan de voorlaatste met de tweede, enzovoort. Zo verandert wél met
 * wie je speelt, terwijl elke baan vier spelers houdt die in rating dicht bij
 * elkaar liggen — dat is de belofte van "eerlijk", en die blijft staan.
 */
function wisselOverBanen(spelers: string[], variant: number): string[] {
  const k = variant % 4; // 0 = de strikt eerlijkste indeling
  if (k === 0) return spelers;
  const uit = [...spelers];
  for (let grens = 4; grens + k - 1 < uit.length; grens += 4) {
    for (let i = 0; i < k; i++) {
      const a = grens - 1 - i;
      const b = grens + i;
      [uit[a], uit[b]] = [uit[b], uit[a]];
    }
  }
  return uit;
}

/**
 * Verdeelt spelers over banen van 4 met zo eerlijk mogelijke teams.
 *
 * `variant` doet sinds #1271 twee dingen tegelijk: het kiest per baan de n-de
 * eerlijkste 2-2-splitsing (cyclisch over 3) én het wisselt spelers over de
 * baangrenzen (cyclisch over 4). Samen levert dat twaalf verschillende
 * indelingen op in plaats van drie keer dezelfde vier mensen bij elkaar.
 *
 * `options.benched` roteert de bankbeurten (zie {@link FairTeamsOptions}).
 */
export function fairTeams(
  playerIds: string[],
  ratings: Record<string, PlayerRating>,
  variant = 0,
  options: FairTeamsOptions = {},
): FairTeamsResult {
  const ratingOf = (id: string) => ratings[id]?.rating ?? BASE_RATING;
  const benchedOf = (id: string) => options.benched?.[id] ?? 0;
  const sorted = [...playerIds].sort((a, b) => ratingOf(b) - ratingOf(a));
  const courtCount = Math.floor(sorted.length / 4);
  const reserveCount = sorted.length - courtCount * 4;

  // Kies wie reserve is: wie het minst zat, zit nu (eerlijke rotatie). Bij
  // gelijke tellingen sorteert de laagste rating naar voren — identiek aan het
  // oude "laagst geratede zit"-gedrag wanneer er geen bankhistorie is.
  const benchSet = new Set(
    [...sorted]
      .sort(
        (a, b) => benchedOf(a) - benchedOf(b) || ratingOf(a) - ratingOf(b),
      )
      .slice(0, reserveCount),
  );
  // Reserves in rating-aflopende volgorde teruggeven (zoals voorheen).
  const reserves = sorted.filter((id) => benchSet.has(id));
  const playing = wisselOverBanen(
    sorted.filter((id) => !benchSet.has(id)),
    variant,
  );

  const courts: CourtProposal[] = [];
  for (let c = 0; c < courtCount; c++) {
    const quad = playing.slice(c * 4, c * 4 + 4);
    const options = SPLITS.map(([a, b]) => {
      const teamA = makeTeam(quad, a, ratingOf);
      const teamB = makeTeam(quad, b, ratingOf);
      return { teamA, teamB, diff: Math.abs(teamA.rating - teamB.rating) };
    }).sort((x, y) => x.diff - y.diff);
    const pick = options[variant % options.length];
    courts.push({
      teamA: pick.teamA,
      teamB: pick.teamB,
      chanceA: expected(pick.teamA.rating, pick.teamB.rating),
    });
  }

  return { courts, reserves };
}

function makeTeam(
  quad: string[],
  [i, j]: [number, number],
  ratingOf: (id: string) => number,
): FairTeam {
  const playerIds: [string, string] = [quad[i], quad[j]];
  return {
    playerIds,
    rating: (ratingOf(playerIds[0]) + ratingOf(playerIds[1])) / 2,
  };
}
