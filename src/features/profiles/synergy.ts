import type { Match, Team } from "@/types";
import { inTeam, outcomeFor } from "@/features/rating/results";
import { MIN_SAMEN } from "@/features/profiles/headToHead";

// Partner-synergie (#471): per maatje het gezamenlijke rapport, plus de twee
// uitersten — het "Dream Team" (hoogste win%) en de "Choke Combo" (laagste).
// Puur afgeleid uit de al geladen matches + teams, net als headToHead.ts.
// Alleen afgewerkte dubbelmatches tellen mee; singles (1v1) hebben geen partner.

export interface PartnerSynergy {
  partnerId: string;
  samen: number;
  gewonnen: number;
  verloren: number;
  gelijk: number;
  rate: number; // 0-100, gewonnen / samen
}

/**
 * Per partner het gezamenlijke rapport, gesorteerd op win% (aflopend) en bij
 * gelijk percentage op het aantal matches. Iedere partner telt mee, ook met
 * één match — de drempel voor "genoeg om iets te zeggen" ligt bij de UI/extremen.
 */
export function partnerSynergy(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): PartnerSynergy[] {
  const perPartner = new Map<
    string,
    { samen: number; gewonnen: number; gelijk: number }
  >();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const teamA = teams[m.team_a_id];
    const myTeam = inTeam(teamA, playerId) ? teamA : teams[m.team_b_id];
    if (!myTeam) continue;
    const partnerId =
      myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
    if (!partnerId) continue; // singles (1v1): geen partner om te tellen
    const s = perPartner.get(partnerId) ?? { samen: 0, gewonnen: 0, gelijk: 0 };
    s.samen++;
    if (o === "W") s.gewonnen++;
    else if (o === "D") s.gelijk++;
    perPartner.set(partnerId, s);
  }

  return [...perPartner.entries()]
    .map(([partnerId, s]) => ({
      partnerId,
      samen: s.samen,
      gewonnen: s.gewonnen,
      gelijk: s.gelijk,
      verloren: s.samen - s.gewonnen - s.gelijk,
      rate: Math.round((s.gewonnen / s.samen) * 100),
    }))
    .sort((a, b) => b.rate - a.rate || b.samen - a.samen);
}

/**
 * Dream Team en Choke Combo uit de synergie-rijen: de partner met het hoogste
 * respectievelijk laagste win%, telkens met minstens `minGames` matches samen.
 * De twee zijn altijd verschillende partners; is er maar één kandidaat, dan
 * blijft de Choke Combo leeg (één duo is geen tegenstelling).
 */
export function synergyExtremes(
  rows: PartnerSynergy[],
  minGames = MIN_SAMEN,
): { dreamTeam: PartnerSynergy | null; chokeCombo: PartnerSynergy | null } {
  const qualified = rows.filter((r) => r.samen >= minGames);
  if (qualified.length < 2) {
    return { dreamTeam: qualified[0] ?? null, chokeCombo: null };
  }
  // `rows` is al op rate aflopend gesorteerd, dus eerste = beste, laatste = slechtste.
  const dreamTeam = qualified[0];
  const chokeCombo = qualified[qualified.length - 1];
  return { dreamTeam, chokeCombo };
}
