// Recordboek van een groep (#711, het recordboek-deel van #113): de eeuwige
// records met hun houder en de dag waarop ze gevestigd werden. Puur afgeleid
// uit de groepsmatches — geen tabel, geen migratie.
//
// Twee bewuste keuzes:
//  1. Gasten doen niet mee. Een record is een blijvende eer, en gasten tellen
//     nergens in de klassementen mee (#468). De pias in de eregalerij is
//     daarin de uitzondering (zie eregalerij.ts), een record niet.
//  2. Een record zonder houder wordt niet gerenderd maar wéggelaten: liever
//     geen regel dan "langste reeks: 1". Vandaar de drempels hieronder.
//
// De streak-records rekenen we hier zelf uit in plaats van via
// longestStreak/biggestWin (rating/results.ts): die geven alleen een getal,
// terwijl een recordboek ook de datum en de match nodig heeft.

import { inTeam, outcomeFor, playersOf } from "@/features/rating/results";
import { matchDate } from "@/features/dashboard/missions";
import type { Match, Profile, Team } from "@/types";

export type RecordId = "winreeks" | "zege" | "avond" | "duo" | "bagels";

export interface GroepsRecord {
  id: RecordId;
  emoji: string;
  titel: string;
  /** Houders: één speler, of twee bij het duo-record. */
  houders: string[];
  /** Het getal achter het record (reekslengte, marge, aantal). */
  waarde: number;
  /** Het getal in woorden, bv. "7 op rij". */
  detail: string;
  /** Dag waarop het record gevestigd werd (YYYY-MM-DD), of null als de match
   *  geen bruikbare datum heeft. */
  datum: string | null;
  /** De match die het record vestigde, voor een link naar het matchdetail. */
  matchId: string | null;
}

/** Minimumwaarden: daaronder is het geen record maar een willekeurige uitslag. */
const DREMPELS: Record<RecordId, number> = {
  winreeks: 3,
  zege: 3,
  avond: 3,
  duo: 3,
  bagels: 1,
};

/** Chronologisch op speeltijd, zoals overal elders in de app. */
function chronologisch(matches: Match[]): Match[] {
  return [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
}

const dagVan = (m: Match): string | null => {
  const d = matchDate(m);
  if (!d) return null;
  // Lokale dag, net als dateInZone elders: geen UTC-verschuiving.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Alle niet-gast-spelers die in deze matches meededen. */
function spelersVan(
  matches: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    for (const t of [teams[m.team_a_id], teams[m.team_b_id]]) {
      for (const pid of playersOf(t)) {
        if (!profiles[pid]?.is_guest) set.add(pid);
      }
    }
  }
  return [...set];
}

/** Langste aaneengesloten reeks van `treffer`-uitslagen, met de match die de
 *  reeks afsloot. Werkt voor een speler (winreeks) en voor een duo. */
function langsteReeks(
  chrono: Match[],
  hoortErbij: (m: Match) => boolean,
  isTreffer: (m: Match) => boolean,
): { lengte: number; match: Match | null } {
  let run = 0;
  let beste = 0;
  let besteMatch: Match | null = null;
  for (const m of chrono) {
    if (!hoortErbij(m)) continue;
    if (isTreffer(m)) {
      run += 1;
      // > (niet >=): bij gelijke lengte houdt de vroegste reeks het record.
      if (run > beste) {
        beste = run;
        besteMatch = m;
      }
    } else run = 0;
  }
  return { lengte: beste, match: besteMatch };
}

/** Grootste zege: de afgeronde match met de hoogste marge. Bij gelijke marge
 *  wint de vroegste (het record stond er eerst). */
function grootsteZege(
  chrono: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord | null {
  let beste: { match: Match; marge: number; houders: string[] } | null = null;
  for (const m of chrono) {
    if (m.score_a == null || m.score_b == null || m.winner_team_id == null) continue;
    const marge = Math.abs(m.score_a - m.score_b);
    if (beste && marge <= beste.marge) continue;
    const houders = playersOf(teams[m.winner_team_id]).filter(
      (pid) => !profiles[pid]?.is_guest,
    );
    if (houders.length === 0) continue;
    beste = { match: m, marge, houders };
  }
  if (!beste || beste.marge < DREMPELS.zege) return null;
  return {
    id: "zege",
    emoji: "💥",
    titel: "Grootste zege",
    houders: beste.houders,
    waarde: beste.marge,
    detail: `${beste.marge} games verschil`,
    datum: dagVan(beste.match),
    matchId: beste.match.id,
  };
}

/** Meeste matches door één speler op één dag. */
function drukkusteAvond(
  chrono: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord | null {
  // playerId|dag → aantal; de laatste match van die dag vestigt het record.
  const tellers = new Map<string, { aantal: number; match: Match }>();
  let beste: { pid: string; aantal: number; match: Match } | null = null;
  for (const m of chrono) {
    const dag = dagVan(m);
    if (!dag) continue;
    for (const pid of spelersVan([m], teams, profiles)) {
      if (outcomeFor(m, teams, pid) === null) continue;
      const key = `${pid}|${dag}`;
      const rij = tellers.get(key) ?? { aantal: 0, match: m };
      rij.aantal += 1;
      rij.match = m;
      tellers.set(key, rij);
      if (!beste || rij.aantal > beste.aantal) {
        beste = { pid, aantal: rij.aantal, match: m };
      }
    }
  }
  if (!beste || beste.aantal < DREMPELS.avond) return null;
  return {
    id: "avond",
    emoji: "🔋",
    titel: "Meeste matches op één dag",
    houders: [beste.pid],
    waarde: beste.aantal,
    detail: `${beste.aantal} matches`,
    datum: dagVan(beste.match),
    matchId: beste.match.id,
  };
}

/** Meeste 6-0's uitgedeeld (een bagel: de tegenstander blijft op 0 games). */
function bagelbakker(
  chrono: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord | null {
  const tellers = new Map<string, { aantal: number; match: Match }>();
  for (const m of chrono) {
    if (m.score_a == null || m.score_b == null) continue;
    const lo = Math.min(m.score_a, m.score_b);
    const hi = Math.max(m.score_a, m.score_b);
    // Zelfde bagel-definitie als feedLogic en wrapped.ts: precies één nul.
    if (lo !== 0 || hi === 0) continue;
    for (const pid of spelersVan([m], teams, profiles)) {
      const inA = inTeam(teams[m.team_a_id], pid);
      if ((inA ? m.score_a : m.score_b) === 0) continue;
      const rij = tellers.get(pid) ?? { aantal: 0, match: m };
      rij.aantal += 1;
      rij.match = m;
      tellers.set(pid, rij);
    }
  }
  let beste: { pid: string; aantal: number; match: Match } | null = null;
  for (const [pid, rij] of tellers) {
    // Tie-break deterministisch op playerId, zoals bepaalPias.
    if (!beste || rij.aantal > beste.aantal || (rij.aantal === beste.aantal && pid < beste.pid))
      beste = { pid, aantal: rij.aantal, match: rij.match };
  }
  if (!beste || beste.aantal < DREMPELS.bagels) return null;
  return {
    id: "bagels",
    emoji: "🥯",
    titel: "Meeste bagels uitgedeeld",
    houders: [beste.pid],
    waarde: beste.aantal,
    detail: beste.aantal === 1 ? "1 bagel" : `${beste.aantal} bagels`,
    datum: dagVan(beste.match),
    matchId: beste.match.id,
  };
}

/** Langste winreeks van één speler. */
function langsteWinreeks(
  chrono: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord | null {
  let beste: { pid: string; lengte: number; match: Match } | null = null;
  for (const pid of spelersVan(chrono, teams, profiles)) {
    const { lengte, match } = langsteReeks(
      chrono,
      (m) => outcomeFor(m, teams, pid) !== null,
      (m) => outcomeFor(m, teams, pid) === "W",
    );
    if (!match) continue;
    if (!beste || lengte > beste.lengte || (lengte === beste.lengte && pid < beste.pid))
      beste = { pid, lengte, match };
  }
  if (!beste || beste.lengte < DREMPELS.winreeks) return null;
  return {
    id: "winreeks",
    emoji: "🔥",
    titel: "Langste winreeks",
    houders: [beste.pid],
    waarde: beste.lengte,
    detail: `${beste.lengte} op rij`,
    datum: dagVan(beste.match),
    matchId: beste.match.id,
  };
}

/** Langste ongeslagen reeks van één duo (winst of gelijkspel). Alleen echte
 *  duo's: een singles-"team" is geen duo. */
function sterksteDuo(
  chrono: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord | null {
  let beste: { teamId: string; lengte: number; match: Match } | null = null;
  const gezien = new Set<string>();
  for (const m of chrono) {
    for (const teamId of [m.team_a_id, m.team_b_id]) {
      const team = teams[teamId];
      if (!team?.player2_id || gezien.has(teamId)) continue;
      gezien.add(teamId);
      if (playersOf(team).some((pid) => profiles[pid]?.is_guest)) continue;
      const { lengte, match } = langsteReeks(
        chrono,
        (x) => x.status === "completed" && (x.team_a_id === teamId || x.team_b_id === teamId),
        (x) => x.winner_team_id === teamId || x.winner_team_id === null,
      );
      if (!match) continue;
      if (!beste || lengte > beste.lengte || (lengte === beste.lengte && teamId < beste.teamId))
        beste = { teamId, lengte, match };
    }
  }
  if (!beste || beste.lengte < DREMPELS.duo) return null;
  return {
    id: "duo",
    emoji: "🤝",
    titel: "Sterkste duo",
    houders: playersOf(teams[beste.teamId]),
    waarde: beste.lengte,
    detail: `${beste.lengte} ongeslagen`,
    datum: dagVan(beste.match),
    matchId: beste.match.id,
  };
}

/**
 * Het recordboek van een groep: de records die een houder hébben, in vaste
 * volgorde. `matches` mag de ruwe groepslijst zijn; alleen afgeronde matches
 * tellen mee.
 */
export function groepsRecords(
  matches: Match[],
  teams: Record<string, Team>,
  profiles: Record<string, Profile>,
): GroepsRecord[] {
  const chrono = chronologisch(matches.filter((m) => m.status === "completed"));
  if (chrono.length === 0) return [];
  return [
    langsteWinreeks(chrono, teams, profiles),
    grootsteZege(chrono, teams, profiles),
    sterksteDuo(chrono, teams, profiles),
    drukkusteAvond(chrono, teams, profiles),
    bagelbakker(chrono, teams, profiles),
  ].filter((r): r is GroepsRecord => r !== null);
}
