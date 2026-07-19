// Padel Wrapped (#115): een deelbaar jaaroverzicht per speler, puur afgeleid
// uit de al geladen matches/teams/ratings — geen servertaak, tabel of
// migratie. Dit is de pure datamodule (patroon: championPoster.ts); het
// tekenen en de sheet leven ernaast in wrappedPoster.ts en WrappedSheet.tsx.
// Bewust in features/wrapped/ i.p.v. lib/: we leunen op bestPartner uit
// features/profiles/headToHead.ts en lib importeert nergens uit features.

import type { Match, Profile, RatingPoint, Team } from "@/types";
import { matchDate } from "@/features/dashboard/missions";
import {
  biggestWin,
  inTeam,
  longestLossStreak,
  longestStreak,
  outcomeFor,
  playersOf,
  winRate,
} from "@/features/rating/results";
import { opponentExtremes } from "@/features/profiles/trends";
import { bestPartner } from "@/features/profiles/headToHead";
import { deriveBadges } from "@/features/profiles/badges";

/**
 * Het jaar waarvan het Wrapped nu beschikbaar is: vanaf 15 december het
 * lopende jaar, daarvóór het vorige. Zo blijft het overzicht ná het
 * bannervenster gewoon terugvindbaar op het profiel.
 */
export function wrappedJaar(now: Date): number {
  const decemberVenster = now.getMonth() === 11 && now.getDate() >= 15;
  return decemberVenster ? now.getFullYear() : now.getFullYear() - 1;
}

/** Dashboardbanner-venster: 15 december t/m 31 januari. */
export function toonWrappedBanner(now: Date): boolean {
  return (now.getMonth() === 11 && now.getDate() >= 15) || now.getMonth() === 0;
}

/** Matches die (lokale tijd) in het kalenderjaar vallen. */
export function matchesInYear(matches: Match[], jaar: number): Match[] {
  return matches.filter((m) => {
    const d = matchDate(m);
    return d != null && d.getFullYear() === jaar;
  });
}

export interface RivaalStat {
  naam: string;
  gewonnen: number;
  verloren: number;
  gespeeld: number;
}

/**
 * Kale jaarcijfers waar Coach Rudy zijn eindoordeel op baseert (#295). Puur
 * afgeleid uit de jaarmatches; `ratingDelta` is null zonder rating-historie.
 */
export interface WrappedJaarStats {
  gespeeld: number;
  gewonnen: number;
  verloren: number;
  winrate: number | null;
  langsteWinst: number;
  langsteVerlies: number;
  /** 6-0's uitgedeeld. */
  bagelsVoor: number;
  /** 0-6's geïncasseerd. */
  bagelsTegen: number;
  /** Rating-eind minus -start binnen het jaar, of null. */
  ratingDelta: number | null;
}

export type WrappedCard =
  | { kind: "cover"; jaar: number; naam: string; gespeeld: number; kort: boolean }
  | { kind: "volume"; gespeeld: number; gewonnen: number; winrate: number | null }
  | {
      kind: "kalender";
      maand: { label: string; aantal: number };
      topdag: { label: string; aantal: number };
    }
  | { kind: "reeks"; type: "winst" | "verlies"; lengte: number }
  | { kind: "maatje"; naam: string; samen: number; gewonnen: number }
  | { kind: "rivalen"; favoriet: RivaalStat | null; nemesis: RivaalStat | null }
  | {
      kind: "prestatie";
      zege: { score: string; marge: number } | null;
      comeback: { naVerliezen: number } | null;
    }
  | { kind: "rating"; start: number; piek: number; eind: number }
  | { kind: "badge"; badgeId: string; naam: string; emoji: string; aantalSpelers: number }
  | { kind: "outro"; jaar: number; kort: boolean }
  | { kind: "eindoordeel"; stats: WrappedJaarStats };

export interface WrappedData {
  jaar: number;
  variant: "vol" | "kort";
  cards: WrappedCard[];
  /** De cijfers achter Coach Rudy's eindoordeel-kaart (#295). */
  jaarStats: WrappedJaarStats;
}

/** Onder dit aantal matches krijgt de speler de charmante korte variant. */
export const KORT_DREMPEL = 5;
/** De volle variant belooft minstens zoveel kaarten (acceptatiecriterium). */
const MIN_VOL_KAARTEN = 6;

/** Naam uit de profielenmap; spiegelt displayName in features/profiles/api.ts
 *  (dat bestand sleept de supabase-client mee en hoort niet in een pure module). */
function naamVan(profiles: Record<string, Profile>, id: string): string {
  const p = profiles[id];
  if (!p) return "Onbekend";
  return p.full_name?.trim() || p.username;
}

/** Chronologisch op speeltijd, zoals overal elders. */
function chronologisch(matches: Match[]): Match[] {
  return [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
}

/**
 * Mooiste comeback van het jaar: de winst met de langste direct voorafgaande
 * verliesrun (minstens 2 — de badge-drempel COMEBACK_DREMPEL is strenger,
 * maar binnen één jaar is elke opgestane speler een verhaal waard). De run
 * mag vóór het jaar begonnen zijn; de winst zelf moet erin vallen.
 */
function besteComeback(
  chrono: Match[],
  jaarIds: Set<string>,
  teams: Record<string, Team>,
  playerId: string,
): { naVerliezen: number } | null {
  let run = 0;
  let beste = 0;
  for (const m of chrono) {
    const o = outcomeFor(m, teams, playerId);
    if (!o) continue;
    if (o === "L") run += 1;
    else {
      if (o === "W" && run >= 2 && jaarIds.has(m.id) && run > beste) beste = run;
      run = 0;
    }
  }
  return beste >= 2 ? { naVerliezen: beste } : null;
}

/**
 * Telt de 6-0's: uitgedeeld (tegenstander 0 games) versus geïncasseerd (jouw
 * team 0 games). Volgt het bagel-patroon van feedLogic (min-score === 0).
 */
function bagelTelling(
  jaarMatches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { voor: number; tegen: number } {
  let voor = 0;
  let tegen = 0;
  for (const m of jaarMatches) {
    if (m.score_a == null || m.score_b == null) continue;
    const lo = Math.min(m.score_a, m.score_b);
    const hi = Math.max(m.score_a, m.score_b);
    if (lo !== 0 || hi === 0) continue;
    const inA = inTeam(teams[m.team_a_id], playerId);
    const mijnScore = inA ? m.score_a : m.score_b;
    if (mijnScore === 0) tegen += 1;
    else voor += 1;
  }
  return { voor, tegen };
}

/** Drukste maand en topdag (meeste matches; bij gelijkspel wint de vroegste). */
function kalenderFeiten(jaarMatches: Match[]): {
  maand: { label: string; aantal: number };
  topdag: { label: string; aantal: number };
} | null {
  const perMaand = new Map<number, number>();
  const perDag = new Map<string, { datum: Date; aantal: number }>();
  for (const m of jaarMatches) {
    const d = matchDate(m);
    if (!d) continue;
    perMaand.set(d.getMonth(), (perMaand.get(d.getMonth()) ?? 0) + 1);
    const sleutel = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const rij = perDag.get(sleutel) ?? { datum: d, aantal: 0 };
    rij.aantal += 1;
    perDag.set(sleutel, rij);
  }
  if (perMaand.size === 0) return null;
  const [maandIdx, maandAantal] = [...perMaand.entries()].sort(
    (a, b) => b[1] - a[1] || a[0] - b[0],
  )[0];
  const dag = [...perDag.values()].sort(
    (a, b) => b.aantal - a.aantal || a.datum.getTime() - b.datum.getTime(),
  )[0];
  const maandLabel = new Date(2000, maandIdx, 15).toLocaleDateString("nl-NL", {
    month: "long",
  });
  const dagLabel = dag.datum.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
  return {
    maand: { label: maandLabel, aantal: maandAantal },
    topdag: { label: dagLabel, aantal: dag.aantal },
  };
}

/**
 * Zeldzaamste badge van het jaar: per clubgenoot de badges over de
 * jaarmatches afleiden (zónder ratings-argument — ratingtiers zijn niet
 * jaar-scopebaar), tellen wie welke behaalde en de badge van de speler met
 * de laagste telling teruggeven. Lifetime-mijlpalen vallen door de
 * jaar-scoping vanzelf af.
 */
function zeldzaamsteBadge(
  clubJaar: Match[],
  teams: Record<string, Team>,
  playerId: string,
): { badgeId: string; naam: string; emoji: string; aantalSpelers: number } | null {
  const spelers = new Set<string>();
  for (const m of clubJaar) {
    for (const teamId of [m.team_a_id, m.team_b_id]) {
      for (const pid of playersOf(teams[teamId])) spelers.add(pid);
    }
  }
  if (!spelers.has(playerId)) return null;

  const telling = new Map<string, number>();
  let mijnBadges: { id: string; naam: string; emoji: string }[] = [];
  for (const pid of spelers) {
    const behaald = deriveBadges(clubJaar, teams, pid).filter((b) => b.behaald);
    if (pid === playerId)
      mijnBadges = behaald.map((b) => ({ id: b.id, naam: b.naam, emoji: b.emoji }));
    for (const b of behaald) telling.set(b.id, (telling.get(b.id) ?? 0) + 1);
  }
  let beste: { badgeId: string; naam: string; emoji: string; aantalSpelers: number } | null =
    null;
  for (const b of mijnBadges) {
    const n = telling.get(b.id) ?? 0;
    if (n > 0 && (!beste || n < beste.aantalSpelers))
      beste = { badgeId: b.id, naam: b.naam, emoji: b.emoji, aantalSpelers: n };
  }
  return beste;
}

/**
 * Het volledige Wrapped van een speler voor één kalenderjaar, of null zonder
 * afgewerkte matches in dat jaar (dan is er geen entry). `clubMatches` is
 * optioneel: zonder valt alleen de zeldzaamste-badge-kaart weg.
 */
export function deriveWrapped(opts: {
  jaar: number;
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  playerId: string;
  ratingHistory?: RatingPoint[];
  clubMatches?: Match[];
}): WrappedData | null {
  const { jaar, teams, profiles, playerId } = opts;
  const chrono = chronologisch(opts.matches);
  const jaarMatches = matchesInYear(chrono, jaar).filter(
    (m) => outcomeFor(m, teams, playerId) !== null,
  );
  const gespeeld = jaarMatches.length;
  if (gespeeld === 0) return null;

  const naam = naamVan(profiles, playerId);
  const gewonnen = jaarMatches.filter(
    (m) => outcomeFor(m, teams, playerId) === "W",
  ).length;

  // Alle kandidaat-kaarten voor de volle variant; magere statistieken vallen
  // per kaart weg in plaats van leeg op de poster te staan.
  const cards: WrappedCard[] = [
    { kind: "cover", jaar, naam, gespeeld, kort: false },
    { kind: "volume", gespeeld, gewonnen, winrate: winRate(gewonnen, gespeeld) },
  ];

  const kalender = kalenderFeiten(jaarMatches);
  if (kalender) cards.push({ kind: "kalender", ...kalender });

  const winst = longestStreak(jaarMatches, teams, playerId);
  const verlies = longestLossStreak(jaarMatches, teams, playerId);
  if (winst >= 2) cards.push({ kind: "reeks", type: "winst", lengte: winst });
  else if (verlies >= 3)
    cards.push({ kind: "reeks", type: "verlies", lengte: verlies });

  const maatje = bestPartner(jaarMatches, teams, playerId);
  if (maatje)
    cards.push({
      kind: "maatje",
      naam: naamVan(profiles, maatje.partnerId),
      samen: maatje.samen,
      gewonnen: maatje.gewonnen,
    });

  const { favorite, hardest } = opponentExtremes(jaarMatches, teams, playerId);
  const rivaal = (r: typeof favorite): RivaalStat | null =>
    r
      ? {
          naam: naamVan(profiles, r.oppId),
          gewonnen: r.won,
          verloren: r.lost,
          gespeeld: r.played,
        }
      : null;
  if (favorite || hardest)
    cards.push({ kind: "rivalen", favoriet: rivaal(favorite), nemesis: rivaal(hardest) });

  const zege = biggestWin(jaarMatches, teams, playerId);
  const jaarIds = new Set(jaarMatches.map((m) => m.id));
  const comeback = besteComeback(chrono, jaarIds, teams, playerId);
  if (zege || comeback)
    cards.push({
      kind: "prestatie",
      zege: zege
        ? {
            score: `${zege.match.score_a}–${zege.match.score_b}`,
            marge: zege.margin,
          }
        : null,
      comeback,
    });

  // Rating-reis: start vóór de eerste jaarmatch, piek en eindstand. Let op:
  // getRatingHistory capt op de nieuwste 100 punten (ratingsApi.ts) — voor
  // een jaaroverzicht een geaccepteerde benadering.
  const punten = (opts.ratingHistory ?? []).filter((p) => {
    const d = new Date(p.played_at);
    return !Number.isNaN(d.getTime()) && d.getFullYear() === jaar;
  });
  let ratingDelta: number | null = null;
  if (punten.length >= 2) {
    const start = punten[0].rating_before;
    const eind = punten[punten.length - 1].rating_after;
    const piek = Math.max(start, ...punten.map((p) => p.rating_after));
    cards.push({ kind: "rating", start, piek, eind });
    ratingDelta = eind - start;
  }

  if (opts.clubMatches) {
    const badge = zeldzaamsteBadge(
      matchesInYear(opts.clubMatches, jaar),
      teams,
      playerId,
    );
    if (badge) cards.push({ kind: "badge", ...badge });
  }

  cards.push({ kind: "outro", jaar, kort: false });

  // De cijfers achter Coach Rudy's eindoordeel; de eindoordeel-kaart zelf is de
  // finale (na de outro) en telt bewust níét mee voor de variant-drempel.
  const bagels = bagelTelling(jaarMatches, teams, playerId);
  const jaarStats: WrappedJaarStats = {
    gespeeld,
    gewonnen,
    verloren: jaarMatches.filter((m) => outcomeFor(m, teams, playerId) === "L").length,
    winrate: winRate(gewonnen, gespeeld),
    langsteWinst: winst,
    langsteVerlies: verlies,
    bagelsVoor: bagels.voor,
    bagelsTegen: bagels.tegen,
    ratingDelta,
  };

  // Korte variant: te weinig matches óf te weinig verhaal voor een volle
  // reeks → drie charmante kaarten in plaats van lege statistieken. Rudy's
  // eindoordeel sluit ook de korte variant af.
  if (gespeeld < KORT_DREMPEL || cards.length < MIN_VOL_KAARTEN) {
    return {
      jaar,
      variant: "kort",
      jaarStats,
      cards: [
        { kind: "cover", jaar, naam, gespeeld, kort: true },
        { kind: "volume", gespeeld, gewonnen, winrate: winRate(gewonnen, gespeeld) },
        { kind: "outro", jaar, kort: true },
        { kind: "eindoordeel", stats: jaarStats },
      ],
    };
  }
  cards.push({ kind: "eindoordeel", stats: jaarStats });
  return { jaar, variant: "vol", cards, jaarStats };
}
