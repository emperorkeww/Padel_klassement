// Combineert de baanbeschikbaarheid (Playtomic) met de slot-stemmen van de
// groepsleden tot één planningsraster: per tijdslot hoeveel banen vrij zijn én
// wie kan. Puur en testbaar; de UI (PlanTogether) tekent hiermee het raster en
// de aanbevelingen.

import { weekHeatmap } from "../availability/availabilityShare";
import type { WeekDay } from "../availability/api";
import type { SlotVote } from "./planApi";
import { toMinutes } from "../../lib/time";

/** Vier spelers per baan (padel). */
export const PLAYERS_PER_COURT = 4;

export interface PlanCell {
  date: string;
  time: string;
  /** Aantal tegelijk vrije banen (Playtomic). */
  courtsFree: number;
  /** Speler-ids per status. */
  yes: string[];
  maybe: string[];
  no: string[];
  /** Hoeveel banen je echt kunt vullen: min(⌊#kan / 4⌋, vrije banen). */
  playable: number;
}

export interface PlanGrid {
  /** Tijd-as (unie van vrije-baan-tijden), oplopend. */
  times: string[];
  days: { date: string; error: string | null }[];
  /** Cellen per `${date}|${time}`; alleen tijden waar banen vrij zijn. */
  cells: Map<string, PlanCell>;
}

export function cellKey(date: string, time: string): string {
  return `${date}|${time}`;
}

/**
 * Bouwt het planningsraster. Kandidaat-slots = de tijden waarop er banen vrij
 * zijn (uit de weekheatmap); stemmen voor slots zonder vrije baan tellen niet
 * mee (daar valt toch niets te boeken).
 */
export function buildPlanGrid(
  week: WeekDay[],
  votes: SlotVote[],
  duration: number | null,
): PlanGrid {
  const heat = weekHeatmap(week, duration);
  const cells = new Map<string, PlanCell>();

  for (const day of heat.days) {
    for (const [time, courtsFree] of Object.entries(day.counts)) {
      cells.set(cellKey(day.date, time), {
        date: day.date,
        time,
        courtsFree,
        yes: [],
        maybe: [],
        no: [],
        playable: 0,
      });
    }
  }

  for (const v of votes) {
    const cell = cells.get(cellKey(v.date, v.start_time));
    if (!cell) continue; // stem op een slot zonder vrije baan → negeren
    if (v.status === "yes") cell.yes.push(v.player_id);
    else if (v.status === "maybe") cell.maybe.push(v.player_id);
    else cell.no.push(v.player_id);
  }

  for (const cell of cells.values()) {
    cell.playable = Math.min(
      Math.floor(cell.yes.length / PLAYERS_PER_COURT),
      cell.courtsFree,
    );
  }

  return {
    times: heat.times,
    days: heat.days.map((d) => ({ date: d.date, error: d.error })),
    cells,
  };
}

/** Een slot is speelbaar als minstens één baan én genoeg spelers samenvallen. */
export function isFeasible(cell: PlanCell): boolean {
  return cell.playable >= 1;
}

/**
 * Beste momenten om te boeken: eerst de meeste speelbare banen, dan de meeste
 * "kan"-stemmen, dan het vroegste moment. Alleen slots waar iemand kan.
 */
export function bestPlanMoments(grid: PlanGrid, topN = 3): PlanCell[] {
  return [...grid.cells.values()]
    .filter((c) => c.yes.length > 0)
    .sort(
      (a, b) =>
        b.playable - a.playable ||
        b.yes.length - a.yes.length ||
        (a.date === b.date
          ? toMinutes(a.time) - toMinutes(b.time)
          : a.date < b.date
            ? -1
            : 1),
    )
    .slice(0, topN);
}
