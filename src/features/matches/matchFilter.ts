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

/* ---------- Groep en periode (#914) ----------
   Deze twee versmallen de kandidatenlijst vóór de tabs hierboven. Ze staan hier
   en niet in het scherm, zodat alles wat "een lijst matches versmallen" doet op
   één plek zit en te toetsen is zonder de pagina te renderen. */

/** Perioden voor het historie-filter, als [sleutel, label]. */
export const PERIODE_OPTIES = [
  ["", "Alle tijden"],
  ["7d", "Laatste 7 dagen"],
  ["30d", "Laatste 30 dagen"],
  ["jaar", "Dit jaar"],
] as const;

export type Periode = (typeof PERIODE_OPTIES)[number][0];

/** Valideert een periode-sleutel uit de URL; onbekend = alle tijden. */
export function periodeFromParam(value: string | null): Periode {
  return PERIODE_OPTIES.some(([k]) => k === value) ? (value as Periode) : "";
}

export function filterOpGroep(matches: Match[], groupId: string): Match[] {
  if (!groupId) return matches;
  return matches.filter((m) => m.group_id === groupId);
}

/**
 * Houdt de matches binnen de gekozen periode. De dag komt uit `dayInZone`,
 * dezelfde bron als de dagkoppen: anders kan een avondmatch in het ene
 * overzicht op dinsdag vallen en in het andere op maandag.
 */
export function filterOpPeriode(
  matches: Match[],
  periode: Periode,
  timeZone: string,
  nowMs = Date.now(),
): Match[] {
  if (!periode) return matches;
  const vanaf =
    periode === "7d"
      ? dateInZone(timeZone, -6, nowMs)
      : periode === "30d"
        ? dateInZone(timeZone, -29, nowMs)
        : `${dateInZone(timeZone, 0, nowMs).slice(0, 4)}-01-01`;
  // Dagen zijn YYYY-MM-DD; string-vergelijking volstaat en is tijdzone-veilig.
  return matches.filter(
    (m) => dayInZone(m.played_at ?? m.created_at, timeZone) >= vanaf,
  );
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
