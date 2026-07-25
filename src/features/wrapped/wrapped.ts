// Padel Wrapped (#115): een deelbaar jaaroverzicht per speler, puur afgeleid
// uit de al geladen matches/teams/ratings — geen servertaak, tabel of
// migratie. Dit is de pure datamodule (patroon: championPoster.ts); het
// tekenen en de sheet leven ernaast in wrappedPoster.ts en WrappedSheet.tsx.
// Bewust in features/wrapped/ i.p.v. lib/: we leunen op bestPartner uit
// features/profiles/headToHead.ts en lib importeert nergens uit features.

import type { Match, Profile, RatingPoint, Team } from "@/types";
import { matchDate } from "@/features/dashboard/missions";
import {
  seasonFor,
  seizoenNaam,
  type Season,
} from "@/features/rating/seasons";
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
import { tierFor, type Tier } from "@/features/rating/tiers";

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

// ── Periode: één deck, twee tijdvakken (#712) ────────────────────────────────
//
// Het Wrapped bestond als jaaroverzicht (#115); sinds #712 draait exact
// hetzelfde deck ook op een kwartaal. In plaats van een tweede implementatie
// draagt een `WrappedPeriode` alle tijdvak-afhankelijke copy: de kaartdata en
// de posterlayout blijven één set code. Alle copy staat in het object en niet
// in een if/else verspreid over posterLayout — zo is een nieuw tijdvak (een
// maand? een toernooi?) later een derde fabriek en geen refactor.

export interface WrappedPeriode {
  soort: "jaar" | "seizoen";
  /** "2026" of "2026-q3" — voor bestandsnamen, dismiss-flags en roast-seeds. */
  id: string;
  /** Zelfstandig naamwoord in lopende tekst: "jaar" of "seizoen". */
  noemer: string;
  /** Kop op elke kaart: "Wrapped 2026" of "☀️ Zomer Wrapped". */
  kicker: string;
  /** Het tijdvak als naam: "2026" of "Zomer 2026". */
  titel: string;
  /** Het volgende tijdvak als naam: "2027" of "Herfst 2026". */
  volgendeTitel: string;
  /** Woord bovenaan de seizoenskaart-poster: "SEIZOEN" of "ZOMER". */
  kaartWoord: string;
  /** Editie-regel op de seizoenskaart: "🎬 Seizoen 2026" of "☀️ Zomer 2026". */
  kaartEditie: string;
  /** Kicker van de seizoenskaart-terugval in posterLayout — zelfde regel maar
   *  zonder de 🎬 van de kaart-editie: "Seizoen 2026" of "☀️ Zomer 2026". */
  kaartKicker: string;
  /** Begin (inclusief) en einde (exclusief) van het tijdvak. */
  start: Date;
  end: Date;
  /** Kalenderjaar waarin het tijdvak (begint) — voor jaargebonden data. */
  jaar: number;
}

/** Het klassieke jaaroverzicht (#115). */
export function jaarPeriode(jaar: number): WrappedPeriode {
  return {
    soort: "jaar",
    id: String(jaar),
    noemer: "jaar",
    kicker: `Wrapped ${jaar}`,
    titel: String(jaar),
    volgendeTitel: String(jaar + 1),
    kaartWoord: "SEIZOEN",
    kaartEditie: `🎬 Seizoen ${jaar}`,
    kaartKicker: `Seizoen ${jaar}`,
    start: new Date(jaar, 0, 1),
    end: new Date(jaar + 1, 0, 1),
    jaar,
  };
}

/** Kwartaaloverzicht (#712): Lente/Zomer/Herfst/Winter Wrapped. */
export function seizoenPeriode(season: Season): WrappedPeriode {
  const naam = seizoenNaam(season);
  // Het volgende kwartaal: één milliseconde ná het einde van dit kwartaal.
  const volgende = seizoenNaam(seasonFor(new Date(season.end.getTime() + 1)));
  return {
    soort: "seizoen",
    id: season.id,
    noemer: "seizoen",
    kicker: `${naam.emoji} ${naam.naam} Wrapped`,
    titel: naam.titel,
    volgendeTitel: volgende.titel,
    kaartWoord: naam.naam.toUpperCase(),
    kaartEditie: naam.label,
    kaartKicker: naam.label,
    start: season.start,
    end: season.end,
    jaar: season.start.getFullYear(),
  };
}

/**
 * Het net afgesloten kwartaal, zolang het nieuwe kwartaal jong is (14 dagen) —
 * het bannervenster van het kwartaal-Wrapped. Null buiten dat venster, en ook
 * tijdens het jaar-Wrapped-venster (15 dec – 31 jan): dan wint het jaarverhaal
 * en blijft het kwartaal bereikbaar via het profiel.
 */
export const SEIZOEN_BANNER_DAGEN = 14;

export function seizoenWrappedVenster(now: Date): Season | null {
  if (toonWrappedBanner(now)) return null;
  const huidig = seasonFor(now);
  const dagen = (now.getTime() - huidig.start.getTime()) / 86_400_000;
  if (dagen >= SEIZOEN_BANNER_DAGEN) return null;
  return seasonFor(new Date(huidig.start.getTime() - 1));
}

/** Matches die (lokale tijd) in het kalenderjaar vallen. */
export function matchesInYear(matches: Match[], jaar: number): Match[] {
  return matchesInPeriode(matches, jaarPeriode(jaar));
}

/** Matches die (lokale tijd) binnen [start, end) van de periode vallen. */
export function matchesInPeriode(
  matches: Match[],
  periode: WrappedPeriode,
): Match[] {
  return matches.filter((m) => {
    const d = matchDate(m);
    return d != null && d >= periode.start && d < periode.end;
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
  /** "Je favoriete slachtoffer van dit seizoen" (#712): in het kwartaal-deck
   *  krijgt de favoriete tegenstander een eigen kaart in plaats van een regel
   *  op de rivalen-kaart — een kwartaal heeft minder verhalen, dus mag het
   *  beste verhaal meer ruimte. In het jaardeck blijft `rivalen` de plek. */
  | { kind: "slachtoffer"; rivaal: RivaalStat }
  | {
      kind: "prestatie";
      zege: { score: string; marge: number } | null;
      comeback: { naVerliezen: number } | null;
    }
  | { kind: "rating"; start: number; piek: number; eind: number }
  | { kind: "badge"; badgeId: string; naam: string; emoji: string; aantalSpelers: number }
  | { kind: "outro"; jaar: number; kort: boolean }
  | { kind: "eindoordeel"; stats: WrappedJaarStats }
  | {
      kind: "seizoenskaart";
      naam: string;
      rating: number | null;
      tier: Tier | null;
      avatarUrl: string | null;
      maatje: { naam: string; samen: number } | null;
      langsteReeks: { type: "winst" | "verlies"; lengte: number } | null;
      /** Aantal coach-regels dat Rudy dit Wrapped-verhaal liet vallen (geen
       *  seizoenbrede roast-teller — die bestaat niet, #498). */
      aantalRoasts: number;
    };

export interface WrappedData {
  /** Kalenderjaar van de periode; bij een kwartaal het jaar waarin het valt. */
  jaar: number;
  /** Het tijdvak van dit deck (#712) — draagt alle copy-varianten. */
  periode: WrappedPeriode;
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

interface WrappedOpts {
  matches: Match[];
  teams: Record<string, Team>;
  profiles: Record<string, Profile>;
  playerId: string;
  ratingHistory?: RatingPoint[];
  clubMatches?: Match[];
  /** Huidige rating/avatar voor de seizoenskaart (#498); zonder blijft die
   *  kaart's schild neutraal grijs resp. zonder foto — geen harde eis. */
  rating?: number | null;
  avatarUrl?: string | null;
}

/**
 * Het volledige Wrapped van een speler voor één kalenderjaar, of null zonder
 * afgewerkte matches in dat jaar (dan is er geen entry). `clubMatches` is
 * optioneel: zonder valt alleen de zeldzaamste-badge-kaart weg.
 *
 * Dunne wikkel om derivePeriodeWrapped (#712): het jaar is één periodesoort.
 */
export function deriveWrapped(
  opts: WrappedOpts & { jaar: number },
): WrappedData | null {
  return derivePeriodeWrapped({ ...opts, periode: jaarPeriode(opts.jaar) });
}

/**
 * Het Wrapped van een speler over een vrij tijdvak (#712): een kalenderjaar
 * (#115) of een kwartaal. Null zonder afgewerkte matches in dat tijdvak.
 */
export function derivePeriodeWrapped(
  opts: WrappedOpts & { periode: WrappedPeriode },
): WrappedData | null {
  const { periode, teams, profiles, playerId } = opts;
  const jaar = periode.jaar;
  const chrono = chronologisch(opts.matches);
  const jaarMatches = matchesInPeriode(chrono, periode).filter(
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
  // Ook bewaard voor de seizoenskaart (#498), die dezelfde langste-reeks toont.
  const langsteReeks: { type: "winst" | "verlies"; lengte: number } | null =
    winst >= 2
      ? { type: "winst", lengte: winst }
      : verlies >= 3
        ? { type: "verlies", lengte: verlies }
        : null;
  if (langsteReeks) cards.push({ kind: "reeks", ...langsteReeks });

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
  const favoriet = rivaal(favorite);
  const nemesis = rivaal(hardest);
  if (periode.soort === "seizoen") {
    // Kwartaal-deck (#712): de favoriete tegenstander krijgt zijn eigen kaart
    // ("Je favoriete slachtoffer van dit seizoen"); de rivalen-kaart blijft
    // over voor de angstgegner, zodat niemand twee keer langskomt.
    if (favoriet) cards.push({ kind: "slachtoffer", rivaal: favoriet });
    if (nemesis) cards.push({ kind: "rivalen", favoriet: null, nemesis });
  } else if (favoriet || nemesis) {
    cards.push({ kind: "rivalen", favoriet, nemesis });
  }

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

  // Rating-reis: start vóór de eerste match van de periode, piek en eindstand.
  // Let op: getRatingHistory capt op de nieuwste 100 punten (ratingsApi.ts) —
  // voor een jaaroverzicht een geaccepteerde benadering.
  const punten = (opts.ratingHistory ?? []).filter((p) => {
    const d = new Date(p.played_at);
    return (
      !Number.isNaN(d.getTime()) && d >= periode.start && d < periode.end
    );
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
      matchesInPeriode(opts.clubMatches, periode),
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
      periode,
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

  // Seizoenskaart (#498): een echte FUT-schildkaart als slot, alleen op de
  // volle variant — een korte Wrapped heeft te weinig verhaal voor een
  // seizoenskaart. `aantalRoasts` telt de kaarten tot nu toe: elke daarvan
  // kreeg in WrappedSheet een coach-regel (coachWrappedRegel/coachEindoordeel).
  cards.push({
    kind: "seizoenskaart",
    naam,
    rating: opts.rating ?? null,
    tier: tierFor(opts.rating ?? null),
    avatarUrl: opts.avatarUrl ?? null,
    maatje: maatje
      ? { naam: naamVan(profiles, maatje.partnerId), samen: maatje.samen }
      : null,
    langsteReeks,
    aantalRoasts: cards.length,
  });

  return { jaar, periode, variant: "vol", cards, jaarStats };
}
