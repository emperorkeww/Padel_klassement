// Eerlijke teamindeling voor een speelavond: sorteer de aanwezigen op rating,
// vorm banen van aaneengesloten viertallen (zodat elke baan intern spannend is)
// en splits elk viertal zo dat het verschil in teamrating minimaal is.
// Spelers zonder rating tellen mee op de startrating (BASE_RATING = 1000),
// dezelfde basis als de rating-trigger in de databank — zie elo.ts.

import { BASE_RATING, expected } from "./elo";
import type { PlayerRating } from "./types";

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

/**
 * Verdeelt spelers over banen van 4 met zo eerlijk mogelijke teams.
 * `variant` kiest per baan de n-de eerlijkste splitsing (0 = eerlijkst,
 * 1 = op één na eerlijkst, …) — voor de "Opnieuw"-knop; cyclisch over de 3.
 */
export function fairTeams(
  playerIds: string[],
  ratings: Record<string, PlayerRating>,
  variant = 0,
): FairTeamsResult {
  const ratingOf = (id: string) => ratings[id]?.rating ?? BASE_RATING;
  const sorted = [...playerIds].sort((a, b) => ratingOf(b) - ratingOf(a));
  const courtCount = Math.floor(sorted.length / 4);
  const reserves = sorted.slice(courtCount * 4);

  const courts: CourtProposal[] = [];
  for (let c = 0; c < courtCount; c++) {
    const quad = sorted.slice(c * 4, c * 4 + 4);
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
