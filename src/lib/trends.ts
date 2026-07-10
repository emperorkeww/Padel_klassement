import type { Match, Team } from "./types";
import { headToHead, outcomeFor } from "./results";

// Trends voor het spelersprofiel (#58): win% per maand, sterkste/lastigste
// tegenstander en de beste weekdag — allemaal afgeleid uit de al opgehaalde
// matches, geen extra queries. Getest in trends.test.ts.

export interface MonthTrend {
  month: string; // "2026-02"
  label: string; // "feb"
  played: number;
  won: number;
  rate: number; // 0-100
}

/** Win% per kalendermaand (laatste `maxMonths` maanden mét matches). */
export function monthlyWinRate(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  maxMonths = 6,
): MonthTrend[] {
  const byMonth = new Map<string, { played: number; won: number }>();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const month = (m.played_at ?? m.created_at).slice(0, 7);
    const s = byMonth.get(month) ?? { played: 0, won: 0 };
    s.played++;
    if (o === "W") s.won++;
    byMonth.set(month, s);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxMonths)
    .map(([month, s]) => ({
      month,
      label: new Intl.DateTimeFormat("nl-BE", { month: "short" })
        .format(new Date(`${month}-15T12:00:00`))
        .replace(".", ""),
      played: s.played,
      won: s.won,
      rate: Math.round((s.won / s.played) * 100),
    }));
}

export interface OpponentRecord {
  oppId: string;
  won: number;
  drawn: number;
  lost: number;
  played: number;
  rate: number; // 0-100
}

/**
 * Sterkste en lastigste tegenstander (minimaal `minGames` onderlinge duels).
 * "Sterkst tegen" vereist meer winst dan verlies, "lastigst" andersom — bij
 * een blanco balans wordt niemand uitgelicht.
 */
export function opponentExtremes(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  minGames = 2,
): { favorite: OpponentRecord | null; hardest: OpponentRecord | null } {
  const recs: OpponentRecord[] = [...headToHead(matches, teams, playerId)]
    .filter(([, r]) => r.played >= minGames)
    .map(([oppId, r]) => ({
      oppId,
      ...r,
      rate: Math.round((r.won / r.played) * 100),
    }));
  const wins = recs
    .filter((r) => r.won > r.lost)
    .sort((a, b) => b.rate - a.rate || b.played - a.played);
  const losses = recs
    .filter((r) => r.lost > r.won)
    .sort((a, b) => a.rate - b.rate || b.played - a.played);
  return { favorite: wins[0] ?? null, hardest: losses[0] ?? null };
}

const WEEKDAGEN = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

export interface WeekdayTrend {
  weekday: number; // 0=zo..6=za
  label: string;
  played: number;
  rate: number; // 0-100
}

/**
 * De weekdag met het hoogste win% (minimaal `minGames` matches op die dag).
 * Alleen zinvol als er op meerdere dagen gespeeld is — anders null.
 */
export function bestWeekday(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  minGames = 3,
): WeekdayTrend | null {
  const byDay = new Map<number, { played: number; won: number }>();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const day = new Date(m.played_at ?? m.created_at).getDay();
    const s = byDay.get(day) ?? { played: 0, won: 0 };
    s.played++;
    if (o === "W") s.won++;
    byDay.set(day, s);
  }
  if (byDay.size < 2) return null;
  const candidates = [...byDay.entries()]
    .filter(([, s]) => s.played >= minGames)
    .map(([weekday, s]) => ({
      weekday,
      label: WEEKDAGEN[weekday],
      played: s.played,
      rate: Math.round((s.won / s.played) * 100),
    }))
    .sort((a, b) => b.rate - a.rate || b.played - a.played);
  return candidates[0] ?? null;
}
