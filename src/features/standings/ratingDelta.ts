import { dateInZone } from "@/lib/utils/time";
import type { RatingPoint } from "@/types";

// Dag-cumulatieve ELO-delta voor de ▲/▼-badge (#352): de som van alle
// rating-wijzigingen van de huidige clubdag, i.p.v. enkel de laatste match.
// Dagafbakening bewust identiek aan dayOf() in groups/dayOverview.ts
// (eerste 10 tekens van de timestamp), zodat badge en Vandaag-tab dezelfde
// matches als "vandaag" rekenen.

/** Som van alle rating-wijzigingen van vandaag (de clubdag). 0 als er vandaag niet gespeeld is. */
export function deltaToday(history: RatingPoint[], timeZone: string): number {
  const today = dateInZone(timeZone);
  return history
    .filter((p) => p.played_at.slice(0, 10) === today)
    .reduce((sum, p) => sum + p.delta, 0);
}
