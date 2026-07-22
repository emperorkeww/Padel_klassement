// Speler van de week (#497): wie won de meeste Elo in de laatste 7 dagen?
// Client-side uit de al geladen rating-histories (dezelfde bron als de
// rangverschuivings-pijltjes) — geen extra fetch. Die speler draagt in het
// klassement de In-Form-editie op zijn FUT-kaart. Minimaal 2 matches in het
// venster (één gelukstreffer is geen vorm) en de winst moet positief zijn;
// tie-break op de hoogste rating ná de laatste match in het venster.

import type { RatingPoint } from "@/types";

export const WEEK_VENSTER_DAGEN = 7;
export const MIN_MATCHES_VOOR_INFORM = 2;

export interface InForm {
  playerId: string;
  /** Totale Elo-winst binnen het venster, afgerond op een heel punt. */
  delta: number;
  /** Aantal matches binnen het venster. */
  matches: number;
}

export function spelerVanDeWeek(
  histories: Record<string, RatingPoint[]>,
  nu: Date = new Date(),
): InForm | null {
  const vanaf = nu.getTime() - WEEK_VENSTER_DAGEN * 24 * 60 * 60 * 1000;
  let best: (InForm & { rating: number }) | null = null;
  for (const [playerId, punten] of Object.entries(histories)) {
    let delta = 0;
    let matches = 0;
    let laatste = 0;
    let rating = Number.NEGATIVE_INFINITY;
    for (const p of punten) {
      const t = new Date(p.played_at).getTime();
      if (Number.isNaN(t) || t < vanaf) continue;
      delta += p.delta;
      matches++;
      if (t >= laatste) {
        laatste = t;
        rating = p.rating_after;
      }
    }
    if (matches < MIN_MATCHES_VOOR_INFORM) continue;
    const rond = Math.round(delta);
    if (rond <= 0) continue;
    if (
      !best ||
      rond > best.delta ||
      (rond === best.delta && rating > best.rating)
    ) {
      best = { playerId, delta: rond, matches, rating };
    }
  }
  return best
    ? { playerId: best.playerId, delta: best.delta, matches: best.matches }
    : null;
}
