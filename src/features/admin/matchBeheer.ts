import {
  deleteMatch,
  setMatchResult,
  updateMatchScore,
  updatePlannedMatchTime,
  type SetScore,
} from "@/features/matches/api";
import {
  corrigeerUitslag,
  verplaatsMatch,
  verwijderMatchAlsBeheerder,
} from "./api";

// Twee wegen naar dezelfde ingreep (#1159).
//
// Wie de match aanmaakte of de groep bezit, schrijft rechtstreeks op
// public.matches; RLS laat dat toe en er valt niets te loggen — het is zijn
// eigen match. De beheerder van de app heeft die policy níet (bewust: een
// ruimere select-policy zou hem alle vreemde groepen in zijn eigen feed en
// kwartaalstand geven) en gaat langs de edge function `admin-content`, die met
// de service-role schrijft en een auditrij achterlaat.
//
// De keuze staat hier en niet in de knoppen zelf, zodat er één plek is waar het
// verschil zit. `alsBeheerder` komt uit `matchRechten()` in matchState.ts en is
// alleen waar als het recht *uitsluitend* uit de beheerdersrol komt: wie op
// eigen titel mag, hoeft niet als beheerder te loggen.

export function slaCorrectieOp(
  params: {
    matchId: string;
    winnerTeamId: string | null;
    scoreA: number;
    scoreB: number;
    setScores?: SetScore[] | null;
  },
  alsBeheerder: boolean,
): Promise<void> {
  if (!alsBeheerder) return updateMatchScore(params);
  return corrigeerUitslag({
    matchId: params.matchId,
    scoreA: params.scoreA,
    scoreB: params.scoreB,
    winnerTeamId: params.winnerTeamId,
    ...(params.setScores !== undefined ? { setScores: params.setScores } : {}),
  });
}

/**
 * De uitslag van een nog niet afgeronde match vastleggen.
 *
 * Het geplande tijdstip blijft staan — voor de beheerder omdat hij vaak dagen
 * later invult, en sinds #1271 ook voor de speler op de baan: `played_at` ís de
 * speeltijd van een geplande match, dus overschrijven verplaatst hem naar een
 * andere speeldag. Geef `playedAt` mee vanaf de kaart. Wil je hem echt
 * verzetten, dan is daar `verzetTijdstip` voor.
 */
export function vulUitslagIn(
  params: {
    matchId: string;
    winnerTeamId: string | null;
    scoreA: number;
    scoreB: number;
    setScores?: SetScore[] | null;
    /** De geplande speeltijd; laat weg voor een match zonder tijdstip. */
    playedAt?: string | null;
  },
  alsBeheerder: boolean,
): Promise<void> {
  if (!alsBeheerder) return setMatchResult(params);
  return corrigeerUitslag({
    matchId: params.matchId,
    scoreA: params.scoreA,
    scoreB: params.scoreB,
    winnerTeamId: params.winnerTeamId,
    ...(params.setScores !== undefined ? { setScores: params.setScores } : {}),
    status: "completed",
  });
}

export function verzetTijdstip(
  matchId: string,
  playedAt: string | null,
  alsBeheerder: boolean,
): Promise<void> {
  return alsBeheerder
    ? verplaatsMatch(matchId, playedAt)
    : updatePlannedMatchTime({ matchId, playedAt });
}

export function verwijderMatchSlim(
  matchId: string,
  alsBeheerder: boolean,
): Promise<void> {
  return alsBeheerder
    ? verwijderMatchAlsBeheerder(matchId)
    : deleteMatch(matchId);
}
