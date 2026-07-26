import { outcomeFor } from "@/features/rating/results";
import { dateInZone, dayInZone } from "@/lib/utils/time";
import type { Match, Team } from "@/types";

/** Filters voor de matchlijst — gedeeld door de globale Matches-pagina en de
 *  Historie-tab op de groepspagina (#342). */
export type Filter = "all" | "mine" | "won" | "lost";

/** De filterknoppen in vaste volgorde, als [sleutel, label]. */
export const FILTER_TABS: [Filter, string][] = [
  ["all", "Alles"],
  ["mine", "Met mij"],
  ["won", "Gewonnen"],
  ["lost", "Verloren"],
];

/** Lege staat per filter: zeg wát er leeg is in plaats van een generiek zinnetje. */
export const EMPTY_BY_FILTER: Record<Filter, string> = {
  all: "Nog geen geschiedenis geschreven op deze baan.",
  mine: "Je hebt zelf nog geen wedstrijden gespeeld — tijd om je racket te pakken!",
  won: "Nog geen overwinningen in de boeken. De volgende match pak je ze!",
  lost: "Geen enkele nederlaag te bekennen. Jij bent onverslaanbaar vandaag!",
};

export function applyFilter(
  matches: Match[],
  teams: Record<string, Team>,
  myId: string,
  filter: Filter,
): Match[] {
  if (filter === "all") return matches;
  return matches.filter((m) => {
    const o = outcomeFor(m, teams, myId);
    if (filter === "mine") {
      // Ook geplande matches waarin ik meedoe.
      const mine =
        o !== null ||
        [teams[m.team_a_id], teams[m.team_b_id]].some(
          (t) => t && (t.player1_id === myId || t.player2_id === myId),
        );
      return mine;
    }
    if (filter === "won") return o === "W";
    return o === "L";
  });
}

export function dayLabel(iso: string, timeZone: string): string {
  const day = dayInZone(iso, timeZone);
  const today = dateInZone(timeZone);
  const yesterday = dateInZone(timeZone, -1);
  if (day === today) return "Vandaag";
  if (day === yesterday) return "Gisteren";
  return new Date(iso).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  });
}

export function groupByDay(
  matches: Match[],
  timeZone: string,
): { day: string; list: Match[] }[] {
  const out: { day: string; list: Match[] }[] = [];
  for (const m of matches) {
    const day = dayLabel(m.played_at ?? m.created_at, timeZone);
    const last = out[out.length - 1];
    if (last && last.day === day) last.list.push(m);
    else out.push({ day, list: [m] });
  }
  return out;
}
