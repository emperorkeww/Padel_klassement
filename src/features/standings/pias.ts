// Pias van de week: per groep, per ISO-week één speler aangeduid als "pias".
// Sinds #643 niet meer alleen de grootste choke (#127), maar de anti-MVP
// volgens exact dezelfde regels als bepaalPias (maandpias.ts, #167): bagel,
// afdroging, zwarte reeks of choke ≥ 60%. Zo wijzen het dashboard-alarm, de
// banner, de feed én de FUT-kaart (#631) dezelfde persoon aan. De aanduiding
// wordt serverside vastgelegd (supabase pias_of_week + recompute_pias); dit
// bestand levert de types, de client-selectie van de lopende week, en
// `pickPias` als pure, geteste spiegel van de SQL — die letterlijk óver
// bepaalPias composeert, zodat spiegel en zichtbare aanduiding nooit kunnen
// divergeren.

import { bepaalPias, buildMatchRatings, type PiasReden } from "@/features/groups/maandpias";
import { outcomeFor } from "@/features/rating/results";
import type { Match, RatingPoint, Team } from "@/types";

/** Eén aangeduide pias voor een (groep, ISO-week). Spiegelt public.pias_of_week. */
export interface PiasWeek {
  groupId: string;
  isoYear: number;
  isoWeek: number;
  /** Maandag van de ISO-week, YYYY-MM-DD. */
  weekStart: string;
  playerId: string;
  /** Ankermatch: de laatste verloren match van de pias in die (groep, week). */
  matchId: string;
  /** Waarom deze speler de pias is (#643), spiegel van PiasReden. */
  reden: PiasReden;
  /** Ernst-score (zelfde formules als ergsteRedenVoor); hoger = gênanter. */
  ernst: number;
  /** Reden-specifiek getal: bagels, marge, reekslengte of winkans (0–1). */
  waarde: number;
  /** Pre-match winkans van het verliezende favorietenteam; alleen bij choke. */
  winChance: number | null;
}

/** De globale pias (#631): één rij per ISO-week, over alle groepen heen.
 *  Spiegelt get_global_pias — zelfde velden als PiasWeek, maar zonder
 *  groep/match (die lekken vreemde-groep-details) en mét het roast-schild
 *  van de drager: de kaart zwijgt dan (de pias blijft wel de pias). */
export interface GlobalePias {
  isoYear: number;
  isoWeek: number;
  /** Maandag van de ISO-week, YYYY-MM-DD. */
  weekStart: string;
  playerId: string;
  reden: PiasReden;
  ernst: number;
  waarde: number;
  winChance: number | null;
  /** roast_schild (#183) van de drager: geen kaart-editie, niemand schuift door. */
  beschermd: boolean;
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

/** De pias van de lópende week uit de rijen van één groep (of de globale
 *  rijen, #631), of anders de meest recente. Werkt op weekStart, dus zonder
 *  eigen ISO-herberekening — de DB is autoritair voor de weeknummers. Null
 *  als er geen enkele rij is. */
export function currentPias<T extends { weekStart: string }>(
  rows: T[],
  now: Date = new Date(),
): T | null {
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
 * per (groep, ISO-week) de anti-MVP — letterlijk bepaalPias (#167) over de
 * groepsmatches van die week, zodat de serverside week-pias per constructie
 * dezelfde is als de zichtbare aanduiding. Het anker (matchId) is de laatste
 * verloren match van de pias in die week. Bedoeld als geteste specificatie;
 * runtime leest de vastgelegde rijen uit de DB.
 */
export function pickPias(
  matches: Match[],
  teams: Record<string, Team>,
  histories: Record<string, RatingPoint[]>,
): PiasWeek[] {
  // Afgeronde groepsmatches emmeren per (groep, ISO-week).
  const emmers = new Map<string, { groupId: string; isoYear: number; isoWeek: number; weekStart: string; matches: Match[] }>();
  for (const m of matches) {
    if (m.status !== "completed" || !m.group_id) continue;
    const { isoYear, isoWeek, weekStart } = isoParts(
      new Date(m.played_at ?? m.created_at),
    );
    const key = `${m.group_id}|${isoYear}|${isoWeek}`;
    let emmer = emmers.get(key);
    if (!emmer)
      emmers.set(
        key,
        (emmer = { groupId: m.group_id, isoYear, isoWeek, weekStart, matches: [] }),
      );
    emmer.matches.push(m);
  }

  const byMatch = buildMatchRatings(histories);
  const rows: PiasWeek[] = [];
  for (const emmer of emmers.values()) {
    const periode = {
      start: new Date(`${emmer.weekStart}T00:00:00Z`),
      end: new Date(`${addDays(emmer.weekStart, 7)}T00:00:00Z`),
    };
    const pias = bepaalPias(emmer.matches, teams, periode, byMatch);
    if (!pias) continue;
    // Anker: de laatste verloren match van de pias in deze (groep, week) —
    // zelfde keuze als de SQL (order by gespeeld desc, match_id desc).
    const anker = [...emmer.matches]
      .filter((m) => outcomeFor(m, teams, pias.playerId) === "L")
      .sort(
        (a, b) =>
          (b.played_at ?? b.created_at).localeCompare(a.played_at ?? a.created_at) ||
          b.id.localeCompare(a.id),
      )[0];
    if (!anker) continue;
    rows.push({
      groupId: emmer.groupId,
      isoYear: emmer.isoYear,
      isoWeek: emmer.isoWeek,
      weekStart: emmer.weekStart,
      playerId: pias.playerId,
      matchId: anker.id,
      reden: pias.reden,
      ernst: pias.ernst,
      waarde: pias.reden === "choke" ? round4(pias.waarde) : pias.waarde,
      winChance: pias.reden === "choke" ? round4(pias.waarde) : null,
    });
  }
  return rows;
}

/**
 * Pure spiegel van get_global_pias (supabase/schemas/functions/25_global_pias):
 * per ISO-week de per-groep-pias met de hoogste ernst, over alle groepen heen —
 * zelfde tie-break als bepaalPias (ernst desc, laagste player_id; daarna
 * group_id voor determinisme). Omdat de invoer de per-groep-rijen zijn, is de
 * globale pias per definitie ook de pias van z'n eigen groep.
 */
export function pickGlobalePias(rows: PiasWeek[]): PiasWeek[] {
  const best = new Map<string, PiasWeek>();
  for (const r of rows) {
    const key = `${r.isoYear}|${r.isoWeek}`;
    const prev = best.get(key);
    if (prev) {
      if (prev.ernst > r.ernst) continue;
      if (prev.ernst === r.ernst && prev.playerId < r.playerId) continue;
      if (
        prev.ernst === r.ernst &&
        prev.playerId === r.playerId &&
        prev.groupId <= r.groupId
      )
        continue;
    }
    best.set(key, r);
  }
  return [...best.values()];
}
