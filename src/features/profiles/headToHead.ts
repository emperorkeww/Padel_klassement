// Onderlinge balans tussen twee spelers en het "beste maatje" van een speler.
// Pure functies over reeds geladen matches + teams (net als lib/results.ts);
// alleen afgewerkte matches tellen mee.

import type { Match, Team } from "../../lib/types";
import { inTeam, outcomeFor } from "../../lib/results";

export interface OnderlingeBalans {
  /** Matches waarin beiden tegenover elkaar stonden, geteld vanuit meId.
   *  gespeeld omvat ook gelijkspelen (gewonnen + verloren + gelijk). */
  alsTegenstanders: { gewonnen: number; verloren: number; gespeeld: number };
  /** Matches waarin beiden samen een team vormden. */
  alsPartners: { samen: number; gewonnen: number };
}

/** Onderlinge balans tussen meId en otherId over de gegeven matches. */
export function headToHead(
  matches: Match[],
  teams: Record<string, Team>,
  meId: string,
  otherId: string,
): OnderlingeBalans {
  const balans: OnderlingeBalans = {
    alsTegenstanders: { gewonnen: 0, verloren: 0, gespeeld: 0 },
    alsPartners: { samen: 0, gewonnen: 0 },
  };
  for (const m of matches) {
    const o = outcomeFor(m, teams, meId);
    if (!o) continue; // niet afgewerkt, of meId deed niet mee
    const teamA = teams[m.team_a_id];
    const teamB = teams[m.team_b_id];
    const myTeam = inTeam(teamA, meId) ? teamA : teamB;
    const otherTeam = myTeam === teamA ? teamB : teamA;
    if (inTeam(myTeam, otherId)) {
      balans.alsPartners.samen++;
      if (o === "W") balans.alsPartners.gewonnen++;
    } else if (inTeam(otherTeam, otherId)) {
      balans.alsTegenstanders.gespeeld++;
      if (o === "W") balans.alsTegenstanders.gewonnen++;
      else if (o === "L") balans.alsTegenstanders.verloren++;
    }
  }
  return balans;
}

/** Onder dit aantal gezamenlijke matches is een winstpercentage nog toeval. */
export const MIN_SAMEN = 3;

/**
 * Beste maatje: de partner met het hoogste winstpercentage samen, met
 * minstens MIN_SAMEN gezamenlijke afgewerkte matches. Bij een gelijk
 * percentage wint het duo met de meeste matches; geen kandidaat → null.
 */
export function bestPartner(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { partnerId: string; samen: number; gewonnen: number } | null {
  const perPartner = new Map<string, { samen: number; gewonnen: number }>();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const teamA = teams[m.team_a_id];
    const myTeam = inTeam(teamA, playerId) ? teamA : teams[m.team_b_id];
    if (!myTeam) continue;
    const partnerId =
      myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
    const s = perPartner.get(partnerId) ?? { samen: 0, gewonnen: 0 };
    s.samen++;
    if (o === "W") s.gewonnen++;
    perPartner.set(partnerId, s);
  }

  let best: { partnerId: string; samen: number; gewonnen: number } | null = null;
  for (const [partnerId, s] of perPartner) {
    if (s.samen < MIN_SAMEN) continue;
    // Kruislings vermenigvuldigen vergelijkt de winstpercentages zonder
    // afrondingsverlies: a/b > c/d  ⇔  a·d > c·b.
    const beter =
      !best ||
      s.gewonnen * best.samen > best.gewonnen * s.samen ||
      (s.gewonnen * best.samen === best.gewonnen * s.samen &&
        s.samen > best.samen);
    if (beter) best = { partnerId, ...s };
  }
  return best;
}
