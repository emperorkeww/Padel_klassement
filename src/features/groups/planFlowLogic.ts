import type { Match } from "@/types";
import type { PlayPoll } from "./pollsApi";

// Pure logica rond een speeldag: staan er al wedstrijdrondes klaar, en hoeveel?
// Getest in planFlowLogic.test.ts.
//
// Dit bestand droeg tot #1121 de hele fase-gedreven Plannen-tab (#349): de
// fasebalk, de focus-poll, de splitsing in "vastgelegd" en "stemmen loopt" en
// de meta-regel per rij. Die tab bestaat niet meer — de agenda is de ingang en
// de speeldagpagina het detail — en daarmee ook die afleidingen niet. Wat er
// overblijft is wat de speeldagpagina nog nodig heeft voor de laatste stap.

/**
 * Zijn er al wedstrijdrondes klaargezet voor deze geboekte speeldag?
 * Zonder datamodel-wijziging afgeleid uit de matches van de groep: rondes
 * (round_number > 0) die ná het boeken zijn aangemaakt horen bij de speeldag.
 * Bekende imprecisie: een losse ronde tussen boeken en spelen telt ook mee —
 * onschuldig, want de boodschap ("wedstrijden staan klaar") blijft waar.
 */
export function roundsExistFor(poll: PlayPoll, matches: Match[]): boolean {
  return roundsMadeFor(poll, matches) > 0;
}

/**
 * Hoeveel rondes er voor deze speeldag al klaarstaan — zelfde afleiding als
 * {@link roundsExistFor}, maar geteld. Het vertrekpunt voor de starttijden van
 * de volgende rondes (#827): ronde N begint tien minuten na ronde N-1.
 */
export function roundsMadeFor(poll: PlayPoll, matches: Match[]): number {
  if (poll.status !== "booked" || !poll.booked_at) return 0;
  const bookedAt = poll.booked_at;
  const rondes = new Set<number>();
  for (const m of matches) {
    if ((m.round_number ?? 0) > 0 && m.created_at >= bookedAt) {
      rondes.add(m.round_number as number);
    }
  }
  return rondes.size;
}
