import {
  deleteMatch,
  replaceMatchPlayer,
  ruilMatchSpelers,
  updateMatchScore,
  updatePlannedMatchTime,
  type SetScore,
} from "@/features/matches/api";
import { saveMatchResult } from "@/features/matches/outbox";
import {
  corrigeerUitslag,
  ruilSpelersAlsBeheerder,
  vervangSpelerAlsBeheerder,
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
 *
 * Het spelerspad loopt sinds #1271 langs de offline-wachtrij: dit is precies de
 * handeling die je in een kooi zonder bereik doet, en de uitlegpagina beloofde
 * dat al. Het beheerderspad niet — die vult achteraf in, vanaf een bank met
 * wifi, en gaat langs de edge function met zijn auditrij.
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
  if (!alsBeheerder) return saveMatchResult(params).then(() => {});
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

/**
 * Eén speler in een match vervangen (#1327).
 *
 * Let op de vlag: hier is dat `bezettingAlsBeheerder` en niet `alsBeheerder`.
 * De eigen-recht-basis is bij de bezetting breder — een deelnemer aan een
 * geplande match mag dit op eigen titel — en `alsBeheerder` zou hem dus
 * onnodig door het logboek sturen. Zie `matchRechten()` in matchState.ts.
 */
export function wisselSpeler(
  params: { matchId: string; vanSpeler: string; naarSpeler: string },
  alsBeheerder: boolean,
): Promise<void> {
  if (!alsBeheerder) {
    return replaceMatchPlayer(params.matchId, params.vanSpeler, params.naarSpeler);
  }
  return vervangSpelerAlsBeheerder(params);
}

/** Twee spelers van plek ruilen (#1327). Dezelfde match aan beide kanten is
 *  "van team wisselen", twee matches is "ruilen tussen twee banen". */
export function ruilSpelers(
  params: { matchA: string; spelerA: string; matchB: string; spelerB: string },
  alsBeheerder: boolean,
): Promise<void> {
  if (!alsBeheerder) {
    return ruilMatchSpelers(
      params.matchA,
      params.spelerA,
      params.matchB,
      params.spelerB,
    );
  }
  return ruilSpelersAlsBeheerder(params);
}
