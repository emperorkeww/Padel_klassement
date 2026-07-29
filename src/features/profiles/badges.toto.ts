// Toto-gebaseerde badge-helper (#809): de Valse profeet telt hoe vaak een
// speler er achter elkaar naast tipte in de groeps-toto.
//
// Bron is match_predictions, die elke tip permanent bewaart met `points` als
// oordeel (gezet door _grade_completed_match in de DB): >0 juist, 0 fout of
// gelijkspel, null nog niet beoordeeld. Let op: die beoordeling is niet
// definitief — wordt een uitslag gecorrigeerd of teruggedraaid, dan draait
// grade_match_predictions opnieuw en kan de reeks met terugwerkende kracht
// verschuiven. Dat is bewust: de badge volgt gewoon de actuele waarheid.

import type { Match } from "@/types";
import type { MatchPrediction } from "@/features/matches/predictions";

/**
 * Langste reeks opeenvolgende fout getipte matches.
 *
 * Loopt de matches chronologisch af (de tip zelf heeft geen bruikbare
 * volgorde: created_at is het tipmoment, niet het speelmoment) en kijkt per
 * match of er een beoordeelde tip van deze speler bij hoort.
 *
 * Gelijkspelen worden overgeslagen: de DB geeft die 0 punten, maar er viel
 * niets te voorspellen — ze breken de reeks niet en tellen er ook niet in mee.
 */
export function valseProfeetReeks(
  matches: Match[],
  predictions: readonly MatchPrediction[] | undefined,
): number {
  if (!predictions || predictions.length === 0) return 0;
  const perMatch = new Map(predictions.map((p) => [p.match_id, p]));
  const chrono = [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );

  let langste = 0;
  let lopend = 0;
  for (const m of chrono) {
    if (m.status !== "completed") continue;
    // Gelijkspel: geen winnaar, dus geen juist of fout — sla over.
    if (!m.winner_team_id) continue;
    const tip = perMatch.get(m.id);
    // Niet getipt of nog niet beoordeeld: die match zegt niets over de reeks.
    if (!tip || tip.points == null) continue;
    if (tip.predicted_team_id === m.winner_team_id) {
      lopend = 0;
    } else {
      lopend += 1;
      langste = Math.max(langste, lopend);
    }
  }
  return langste;
}
