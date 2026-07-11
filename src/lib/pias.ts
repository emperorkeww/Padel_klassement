// Pias van de week: per groep, per ISO-week één speler aangeduid als "pias" —
// de grootste choke, d.w.z. de speler die als duidelijkste favoriet toch
// verloor. De aanduiding wordt serverside vastgelegd (supabase pias_of_week +
// recompute_pias); dit bestand levert het type, de client-selectie van de
// lopende week, en `pickPias` als pure, geteste spiegel van de SQL — dezelfde
// rol die standings.ts speelt t.o.v. de standen-views.

import { BASE_RATING, expected } from "./elo";
import { UPSET_MAX_KANS } from "./feed";
import type { Match, RatingPoint, Team } from "./types";

/** Winkans-grens waarboven een verliezend favorietenteam een "choke" is —
 *  spiegelbeeld van de upset-grens (een upset onder 0.35 → een choke boven
 *  0.65). Eén bron voor beide kanten van hetzelfde verhaal. */
export const CHOKE_MIN_KANS = 1 - UPSET_MAX_KANS;

/** Eén aangeduide pias voor een (groep, ISO-week). Spiegelt public.pias_of_week. */
export interface PiasWeek {
  groupId: string;
  isoYear: number;
  isoWeek: number;
  /** Maandag van de ISO-week, YYYY-MM-DD. */
  weekStart: string;
  playerId: string;
  matchId: string;
  /** Pre-match winkans van het verliezende favorietenteam (de choke-maat). */
  winChance: number;
}

/** YYYY-MM-DD (UTC) van een datum. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** N dagen bij een YYYY-MM-DD-string optellen, weer als YYYY-MM-DD. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

/** ISO-jaar, -weeknummer en de maandag van de week (in UTC — dat spiegelt de
 *  DB, die `extract(isoyear/week …)` op timestamptz in UTC evalueert). */
export function isoParts(date: Date): {
  isoYear: number;
  isoWeek: number;
  weekStart: string;
} {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dow = d.getUTCDay() || 7; // zondag telt als 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dow - 1));
  // De donderdag van deze week bepaalt ISO-jaar en -weeknummer.
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (4 - dow));
  const isoYear = thursday.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const isoWeek =
    Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;
  return { isoYear, isoWeek, weekStart: ymd(monday) };
}

/** De pias van de lópende week uit de rijen van één groep, of anders de meest
 *  recente. Werkt op weekStart, dus zonder eigen ISO-herberekening — de DB is
 *  autoritair voor de weeknummers. Null als er geen enkele rij is. */
export function currentPias(
  rows: PiasWeek[],
  now: Date = new Date(),
): PiasWeek | null {
  if (rows.length === 0) return null;
  const today = ymd(now);
  for (const r of rows) {
    if (r.weekStart <= today && today < addDays(r.weekStart, 7)) return r;
  }
  return [...rows].sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0];
}

function round4(x: number): number {
  return Math.round(x * 10_000) / 10_000;
}

/**
 * Pure spiegel van recompute_pias (supabase/schemas/functions/20_pias_of_week):
 * per (groep, ISO-week) de pijnlijkste choke onder de afgeronde groepsmatches.
 * De pias is de verliezer met de hoogste pre-match rating. Bedoeld als geteste
 * specificatie; runtime leest de vastgelegde rijen uit de DB.
 */
export function pickPias(
  matches: Match[],
  teams: Record<string, Team>,
  histories: Record<string, RatingPoint[]>,
): PiasWeek[] {
  const ratingBefore = (playerId: string, matchId: string): number =>
    histories[playerId]?.find((p) => p.match_id === matchId)?.rating_before ??
    BASE_RATING;

  const best = new Map<string, PiasWeek>();
  for (const m of matches) {
    if (m.status !== "completed" || !m.group_id || !m.winner_team_id) continue;
    const loserTeamId =
      m.winner_team_id === m.team_a_id ? m.team_b_id : m.team_a_id;
    const loser = teams[loserTeamId];
    const winner = teams[m.winner_team_id];
    if (!loser || !winner) continue;

    const rl1 = ratingBefore(loser.player1_id, m.id);
    const rl2 = ratingBefore(loser.player2_id, m.id);
    const loserRating = (rl1 + rl2) / 2;
    const winnerRating =
      (ratingBefore(winner.player1_id, m.id) +
        ratingBefore(winner.player2_id, m.id)) /
      2;
    // Winkans van het verliezende team vóór de match; geklemd < 1 net als de SQL.
    const chance = Math.min(0.9999, round4(expected(loserRating, winnerRating)));
    if (chance <= CHOKE_MIN_KANS) continue;

    const { isoYear, isoWeek, weekStart } = isoParts(
      new Date(m.played_at ?? m.created_at),
    );
    const key = `${m.group_id}|${isoYear}|${isoWeek}`;
    const prev = best.get(key);
    // Hoogste kans wint; bij gelijke kans het laagste match-id (determinisme,
    // zelfde tie-break als `order by loser_chance desc, match_id` in de SQL).
    if (prev) {
      if (prev.winChance > chance) continue;
      if (prev.winChance === chance && prev.matchId <= m.id) continue;
    }
    best.set(key, {
      groupId: m.group_id,
      isoYear,
      isoWeek,
      weekStart,
      playerId: rl1 >= rl2 ? loser.player1_id : loser.player2_id,
      matchId: m.id,
      winChance: chance,
    });
  }
  return [...best.values()];
}
