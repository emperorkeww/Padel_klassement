// Lef-onthulling bij de aftrap (#804): een inzet blijft vóór de match bewust
// verborgen — zag je andermans lef vooraf, dan kon je erop meeliften. Zodra de
// match loopt mag het wél gezegd worden, en dan is het precies het soort ding
// dat je als partner wil weten: naast je staat iemand die dubbel of niets
// speelt. De tegenstanders krijgen niets: die zien de onthulling in de app,
// maar het raakt hun eigen mutatie niet.
//
// Pure logica, zonder Deno-globals: getest in lefOnthulling.test.ts.

/** Het minimum dat deze module van een match nodig heeft. */
export interface OnthulbareMatch {
  id: string;
  team_a_id: string;
  team_b_id: string;
}

export interface OnthulbaarTeam {
  id: string;
  player1_id: string;
  player2_id: string | null;
}

export interface OnthulbareInzet {
  match_id: string;
  player_id: string;
}

export interface Onthulling {
  matchId: string;
  /** Wie inzette; die naam staat in de melding. */
  inzetterId: string;
  /** De partner van de inzetter: de ontvanger van de melding. */
  partnerId: string;
}

/** De partner van een speler binnen deze match, of null als die er niet is. */
function partnerIn(
  m: OnthulbareMatch,
  teamVan: Map<string, OnthulbaarTeam>,
  playerId: string,
): string | null {
  for (const teamId of [m.team_a_id, m.team_b_id]) {
    const t = teamVan.get(teamId);
    if (!t) continue;
    if (t.player1_id === playerId) return t.player2_id;
    if (t.player2_id === playerId) return t.player1_id;
  }
  return null;
}

/**
 * Koppelt elke inzet aan de partner van de inzetter. Een 1v1 levert niets op
 * (geen partner), net als een inzetter die niet meer in een team van de match
 * staat — dat kan als de opstelling na het inzetten nog gewijzigd is. Zetten
 * beide teamgenoten in, dan krijgen ze allebei een melding over de ander.
 */
export function onthullingenVoorPartners(
  matches: OnthulbareMatch[],
  teams: OnthulbaarTeam[],
  stakes: OnthulbareInzet[],
): Onthulling[] {
  const teamVan = new Map(teams.map((t) => [t.id, t]));
  const uit: Onthulling[] = [];
  for (const m of matches) {
    for (const s of stakes.filter((x) => x.match_id === m.id)) {
      const partnerId = partnerIn(m, teamVan, s.player_id);
      if (partnerId) {
        uit.push({ matchId: m.id, inzetterId: s.player_id, partnerId });
      }
    }
  }
  return uit;
}
