import type { RatingPoint } from "@/types";

// Milestone-chronologie voor het profiel (#471): een tijdlijn van historische
// mijlpalen, volledig afgeleid uit de rating-historie (één rij per match, met
// rating_after + played_at). Geen extra queries. Getest in milestones.test.ts.

export type MilestoneKind = "debuut" | "elo" | "matches";

export interface Milestone {
  /** Stabiele sleutel (bv. "elo-1200", "matches-100"). */
  id: string;
  kind: MilestoneKind;
  icon: string;
  label: string;
  /** Drempel (Elo) of aantal (matches); afwezig bij het debuut. */
  value?: number;
  /** Tijdstip van de match waarop de mijlpaal viel (ISO). */
  date: string;
}

// Elo-drempels boven de startrating (1000) en de match-tellers die we vieren.
const ELO_DREMPELS = [1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800];
const MATCH_TELLERS = [10, 25, 50, 100, 200, 300, 400, 500];

/**
 * Bouwt de chronologische mijlpalenlijst uit de (oplopend gesorteerde)
 * rating-historie: het debuut, elke eerste passage van een Elo-drempel en de
 * match-tellers. Oudste mijlpaal eerst. Lege historie → lege lijst.
 */
export function buildMilestones(history: RatingPoint[]): Milestone[] {
  if (history.length === 0) return [];

  const milestones: Milestone[] = [];
  const start = history[0].rating_before;

  // Debuut: de allereerste match.
  milestones.push({
    id: "debuut",
    kind: "debuut",
    icon: "🎉",
    label: "Debuut",
    date: history[0].played_at,
  });

  // Elo-drempels: de eerste match waarbij rating_after de drempel haalt, mits de
  // speler eronder begon (anders is het geen "behaald").
  for (const drempel of ELO_DREMPELS) {
    if (start >= drempel) continue;
    const hit = history.find((h) => h.rating_after >= drempel);
    if (!hit) continue;
    milestones.push({
      id: `elo-${drempel}`,
      kind: "elo",
      icon: "📈",
      label: `${drempel} Elo behaald`,
      value: drempel,
      date: hit.played_at,
    });
  }

  // Match-tellers: de N-de gespeelde match (historie heeft één rij per match).
  for (const teller of MATCH_TELLERS) {
    if (history.length < teller) break;
    milestones.push({
      id: `matches-${teller}`,
      kind: "matches",
      icon: teller >= 100 ? "💯" : "🎾",
      label: `${teller}e match`,
      value: teller,
      date: history[teller - 1].played_at,
    });
  }

  // Chronologisch: oudste eerst. Bij een gelijke datum blijft de invoegvolgorde
  // (debuut → elo → matches) behouden dankzij een stabiele sort.
  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}
