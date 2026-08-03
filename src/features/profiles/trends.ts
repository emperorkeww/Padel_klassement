import type { CourtType, Match, Team } from "@/types";
import { headToHead, outcomeFor, playersOf } from "@/features/rating/results";
import { COURT_TYPES, type CourtTypeInfo } from "@/features/matches/courtType";
import { drankIcon, drankLabel } from "@/features/matches/drankkaart";

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

// Dagdelen voor de tijdvoorkeuren (#471). De grenzen volgen de lokale kloktijd
// van de speler (net als bestWeekday met getDay); avond omvat ook de late uren.
export type Daypart = "ochtend" | "middag" | "avond";

interface DaypartInfo {
  part: Daypart;
  label: string;
  icon: string;
}

const DAYPARTS: DaypartInfo[] = [
  { part: "ochtend", label: "Ochtend", icon: "🌅" },
  { part: "middag", label: "Middag", icon: "☀️" },
  { part: "avond", label: "Avond", icon: "🌙" },
];

/** Dagdeel van een uur (0-23): ochtend 5-11, middag 12-17, avond 18-4. */
function daypartOf(hour: number): Daypart {
  if (hour >= 5 && hour < 12) return "ochtend";
  if (hour >= 12 && hour < 18) return "middag";
  return "avond";
}

export interface DaypartTrend extends DaypartInfo {
  played: number;
  won: number;
  rate: number; // 0-100
}

/**
 * Win% per dagdeel (#471) — "Avondkracht" vs. "Ochtenddip". Geeft enkel de
 * dagdelen mét matches terug, in vaste volgorde (ochtend → middag → avond),
 * plus het dagdeel met het hoogste win% (minstens `minGames` matches).
 */
export function timeOfDayPreference(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  minGames = 3,
): { parts: DaypartTrend[]; best: DaypartTrend | null } {
  const byPart = new Map<Daypart, { played: number; won: number }>();
  for (const m of matches) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const part = daypartOf(new Date(m.played_at ?? m.created_at).getHours());
    const s = byPart.get(part) ?? { played: 0, won: 0 };
    s.played++;
    if (o === "W") s.won++;
    byPart.set(part, s);
  }
  const parts: DaypartTrend[] = DAYPARTS.filter((d) => byPart.has(d.part)).map(
    (d) => {
      const s = byPart.get(d.part)!;
      return { ...d, played: s.played, won: s.won, rate: Math.round((s.won / s.played) * 100) };
    },
  );
  const best =
    [...parts]
      .filter((p) => p.played >= minGames)
      .sort((a, b) => b.rate - a.rate || b.played - a.played)[0] ?? null;
  return { parts, best };
}

export interface CourtTrend extends CourtTypeInfo {
  played: number;
  won: number;
  rate: number; // 0-100
}

/**
 * Win% per baantype (#471). Alleen matches mét een opgegeven baantype tellen
 * mee (oudere matches zonder type blijven buiten beeld). Vaste volgorde volgens
 * COURT_TYPES, plus het baantype met het hoogste win% (minstens `minGames`).
 */
export function courtPreference(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  minGames = 3,
): { courts: CourtTrend[]; best: CourtTrend | null } {
  const byCourt = new Map<CourtType, { played: number; won: number }>();
  for (const m of matches) {
    if (!m.court_type) continue;
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    const s = byCourt.get(m.court_type) ?? { played: 0, won: 0 };
    s.played++;
    if (o === "W") s.won++;
    byCourt.set(m.court_type, s);
  }
  const courts: CourtTrend[] = COURT_TYPES.filter((c) => byCourt.has(c.type)).map(
    (c) => {
      const s = byCourt.get(c.type)!;
      return { ...c, played: s.played, won: s.won, rate: Math.round((s.won / s.played) * 100) };
    },
  );
  const best =
    [...courts]
      .filter((c) => c.played >= minGames)
      .sort((a, b) => b.rate - a.rate || b.played - a.played)[0] ?? null;
  return { courts, best };
}

export interface DrankTrend {
  slug: string;
  label: string;
  icon: string;
  /** Aantal consumpties dat deze speler op dit drankje won. */
  aantal: number;
  /** Aantal matches waarin dat gebeurde. */
  matches: number;
}

export interface DrankStats {
  /** Gewonnen consumpties per drankje, hoogste eerst. */
  gewonnen: DrankTrend[];
  /** Het drankje waar deze speler er het meest van won, of null. */
  favoriet: DrankTrend | null;
  /** Totaal aantal gewonnen consumpties. */
  totaalGewonnen: number;
  /** Totaal aantal consumpties dat deze speler moest trakteren. */
  totaalGetrakteerd: number;
}

/**
 * Drankje-inzet op het profiel (#1004): "meest gewonnen biertje" en "totaal
 * getrakteerde consumpties". Alleen afgeronde matches mét inzet én een winnaar
 * tellen mee — bij gelijkspel vervalt de traktatie.
 *
 * Getrakteerd wordt geteld als aantal × het aantal winnaars, want de inzet is
 * "N per winnaar": een verloren dubbelspel kost je twee consumpties, een
 * verloren single één. Er wordt niet gekeken naar wager_settled_at: dat vinkje
 * zegt of het glas al aan de bar geschonken is, niet of je de weddenschap
 * verloor. De statistiek gaat over het tweede.
 */
export function drankTraktaties(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): DrankStats {
  const perDrank = new Map<string, { aantal: number; matches: number }>();
  let totaalGetrakteerd = 0;
  for (const m of matches) {
    if (!m.wager_drink) continue;
    const o = outcomeFor(m, teams, playerId);
    // "D" hoort hier ook bij: gelijkspel = inzet vervallen.
    if (o !== "W" && o !== "L") continue;
    const perWinnaar = Math.max(1, m.wager_drink_qty ?? 1);
    if (o === "W") {
      const s = perDrank.get(m.wager_drink) ?? { aantal: 0, matches: 0 };
      s.aantal += perWinnaar;
      s.matches++;
      perDrank.set(m.wager_drink, s);
    } else {
      // Het winnende team betaalt niets; jij betaalt elk van hen. 1v1 kent één
      // winnaar, 2v2 twee — de teamgrootte lezen we uit het team zelf, zodat
      // een half gevuld team (gast verwijderd) niet stiekem dubbel telt.
      const winnaars = m.winner_team_id
        ? playersOf(teams[m.winner_team_id]).length || 1
        : 1;
      totaalGetrakteerd += perWinnaar * winnaars;
    }
  }
  const gewonnen: DrankTrend[] = [...perDrank.entries()]
    .map(([slug, s]) => ({
      slug,
      label: drankLabel(slug),
      icon: drankIcon(slug),
      aantal: s.aantal,
      matches: s.matches,
    }))
    .sort((a, b) => b.aantal - a.aantal || a.label.localeCompare(b.label));
  return {
    gewonnen,
    favoriet: gewonnen[0] ?? null,
    totaalGewonnen: gewonnen.reduce((n, d) => n + d.aantal, 0),
    totaalGetrakteerd,
  };
}
