// Wekelijkse mini-missies (#118): kleine, verversende doelen naast de
// blijvende badges. Alles wordt client-side afgeleid uit de al geladen
// matches + teams — geen servertaak of tabel. De keuze per week is geseed
// op de weekindex alléén, zodat iedereen dezelfde missies ziet; de
// voortgang is uiteraard per speler.

import type { Match, Team } from "@/types";
import { inTeam, outcomeFor } from "@/features/rating/results";

/** Tijdstip van een match als Date, of null bij een onbruikbare datum. */
export function matchDate(m: Match): Date | null {
  const raw = m.played_at ?? m.created_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Doorlopende weekindex (maandag als weekstart) om opeenvolgende
 * kalenderweken te kunnen tellen: opeenvolgende weken verschillen exact 1.
 */
export function weekIndex(d: Date): number {
  const maandagOffset = (d.getDay() + 6) % 7; // ma = 0 … zo = 6
  const epochDagen =
    Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) -
    maandagOffset;
  return Math.floor(epochDagen / 7);
}

/**
 * Maandag van de week van `d`, om 12:00 lokale tijd (de middag vermijdt
 * DST-randgevallen, zoals addDays in time.ts). Voor weeklabels in de UI.
 */
export function weekStartOf(d: Date): Date {
  const maandagOffset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - maandagOffset, 12);
}

/** Half-open bereik [maandag 00:00, volgende maandag 00:00) van de week van `d`. */
export function weekRange(d: Date): { start: Date; end: Date } {
  const maandag = weekStartOf(d);
  const start = new Date(maandag.getFullYear(), maandag.getMonth(), maandag.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}

/**
 * Doorlopende maandindex (jaar × 12 + maand) om opeenvolgende kalendermaanden
 * te tellen: opeenvolgende maanden verschillen exact 1. Tegenhanger van
 * weekIndex, voor de maandelijkse afgeleide features (o.a. de pias van de maand).
 */
export function monthIndex(d: Date): number {
  return d.getFullYear() * 12 + d.getMonth();
}

/** Half-open bereik [1e van de maand, 1e van de volgende maand) van `d`. */
export function monthRange(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

/** Chronologisch gesorteerde kopie van de matches (op speeltijd). */
function chronologisch(matches: Match[]): Match[] {
  return [...matches].sort((a, b) =>
    (a.played_at ?? a.created_at).localeCompare(b.played_at ?? b.created_at),
  );
}

/**
 * Mulberry32: klein deterministisch PRNG (geen dependency). De weekindex
 * als seed maakt de missiekeuze reproduceerbaar en voor iedereen gelijk;
 * americano.ts heeft al een shuffle met injecteerbare rng als patroon.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MissieVoortgang {
  nu: number;
  doel: number;
}

export interface Missie {
  id: string;
  naam: string;
  emoji: string;
  omschrijving: string;
  behaald: boolean;
  /** Altijd aanwezig: missies zijn per definitie telbaar. */
  voortgang: MissieVoortgang;
}

export type MissieCategorie = "volume" | "sociaal" | "prestatie" | "ludiek";

interface MissieContext {
  /** Afgewerkte matches van de speler in de doelweek. */
  weekMatches: Match[];
  /** Alle afgewerkte matches van de speler vóór de doelweek. */
  eerdereMatches: Match[];
  /** Alle afgewerkte matches van de speler, chronologisch. */
  alleChrono: Match[];
  teams: Record<string, Team>;
  playerId: string;
}

export interface MissieDef {
  id: string;
  naam: string;
  emoji: string;
  omschrijving: string;
  categorie: MissieCategorie;
  doel: number;
  meet(ctx: MissieContext): number;
}

/** Partner-id (medespeler in het eigen team) van een match, of null. */
function partnerVan(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
): string | null {
  const inA = inTeam(teams[m.team_a_id], playerId);
  const myTeam = inA ? teams[m.team_a_id] : teams[m.team_b_id];
  if (!myTeam || !inTeam(myTeam, playerId)) return null;
  return myTeam.player1_id === playerId ? myTeam.player2_id : myTeam.player1_id;
}

/** Winst met minstens `verschil` games verschil; vereist ingevulde scores. */
function winstMetVerschil(
  m: Match,
  teams: Record<string, Team>,
  playerId: string,
  verschil: number,
): boolean {
  if (outcomeFor(m, teams, playerId) !== "W") return false;
  if (m.score_a == null || m.score_b == null) return false;
  const inA = inTeam(teams[m.team_a_id], playerId);
  const mij = inA ? m.score_a : m.score_b;
  const hen = inA ? m.score_b : m.score_a;
  return mij - hen >= verschil;
}

/**
 * De volledige missiepool. Alle missies zijn achteraf evalueerbaar uit
 * matchdata alleen (nodig voor perfecteWeken) en alle negen zijn in één
 * week tegelijk haalbaar, zodat een perfecte week altijd kan — welk trio
 * de seed ook trekt.
 */
export const MISSIE_POOL: MissieDef[] = [
  {
    id: "twee-matches",
    categorie: "volume",
    naam: "Dubbele inzet",
    emoji: "🎾",
    omschrijving: "Speel 2 matches deze week.",
    doel: 2,
    meet: ({ weekMatches }) => weekMatches.length,
  },
  {
    id: "drie-matches",
    categorie: "volume",
    naam: "Hattrickweek",
    emoji: "🔋",
    omschrijving: "Speel 3 matches deze week.",
    doel: 3,
    meet: ({ weekMatches }) => weekMatches.length,
  },
  {
    id: "nieuwe-tandem",
    categorie: "sociaal",
    naam: "Verse tandem",
    emoji: "🤝",
    omschrijving: "Speel met een partner met wie je nog nooit speelde.",
    doel: 1,
    meet: ({ weekMatches, eerdereMatches, teams, playerId }) => {
      const bekend = new Set(
        eerdereMatches.map((m) => partnerVan(m, teams, playerId)),
      );
      const nieuw = new Set(
        weekMatches
          .map((m) => partnerVan(m, teams, playerId))
          .filter((p): p is string => p != null && !bekend.has(p)),
      );
      return nieuw.size;
    },
  },
  {
    id: "twee-partners",
    categorie: "sociaal",
    naam: "Vlindermodus",
    emoji: "🦋",
    omschrijving: "Speel deze week met 2 verschillende partners.",
    doel: 2,
    meet: ({ weekMatches, teams, playerId }) =>
      new Set(
        weekMatches
          .map((m) => partnerVan(m, teams, playerId))
          .filter((p): p is string => p != null),
      ).size,
  },
  {
    id: "ruime-winst",
    categorie: "prestatie",
    naam: "Statement",
    emoji: "💥",
    omschrijving: "Win een match met minstens 3 games verschil.",
    doel: 1,
    meet: ({ weekMatches, teams, playerId }) =>
      weekMatches.filter((m) => winstMetVerschil(m, teams, playerId, 3)).length,
  },
  {
    id: "winst-na-verlies",
    categorie: "prestatie",
    naam: "Boemerang",
    emoji: "🪃",
    omschrijving: "Win een match meteen na een verlies.",
    doel: 1,
    meet: ({ weekMatches, alleChrono, teams, playerId }) => {
      // Het verlies mag vóór de week vallen; de winst telt alleen ín de week.
      const weekIds = new Set(weekMatches.map((m) => m.id));
      let vorige: string | null = null;
      let nu = 0;
      for (const m of alleChrono) {
        const o = outcomeFor(m, teams, playerId);
        if (!o) continue;
        if (o === "W" && vorige === "L" && weekIds.has(m.id)) nu += 1;
        vorige = o;
      }
      return nu;
    },
  },
  {
    id: "voor-19u",
    categorie: "ludiek",
    naam: "Vroege shift",
    emoji: "🌤️",
    omschrijving: "Speel op een weekdag vóór 19 uur.",
    doel: 1,
    meet: ({ weekMatches }) =>
      weekMatches.filter((m) => {
        const d = matchDate(m);
        return d != null && d.getDay() >= 1 && d.getDay() <= 5 && d.getHours() < 19;
      }).length,
  },
  {
    id: "voor-donderdag",
    categorie: "ludiek",
    naam: "Vliegende start",
    emoji: "🐇",
    omschrijving: "Speel een match vóór donderdag.",
    doel: 1,
    meet: ({ weekMatches }) =>
      weekMatches.filter((m) => {
        const d = matchDate(m);
        return d != null && (d.getDay() + 6) % 7 < 3; // ma/di/wo
      }).length,
  },
  {
    id: "weekend-match",
    categorie: "ludiek",
    naam: "Weekendrondje",
    emoji: "🏖️",
    omschrijving: "Speel een match in het weekend.",
    doel: 1,
    meet: ({ weekMatches }) =>
      weekMatches.filter((m) => {
        const d = matchDate(m);
        return d != null && (d.getDay() === 0 || d.getDay() === 6);
      }).length,
  },
];

const CATEGORIEEN: MissieCategorie[] = ["volume", "sociaal", "prestatie", "ludiek"];

/**
 * Kies deterministisch 3 missies uit 3 verschillende categorieën voor een
 * week: shuffle de categorieën met de week-seed, neem er drie en trek per
 * categorie één missie. Vaste categorievolgorde in het resultaat zodat de
 * kaart stabiel oogt.
 */
function kiesMissies(weekIdx: number): MissieDef[] {
  const rng = mulberry32(weekIdx);
  const cats = [...CATEGORIEEN];
  for (let i = cats.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cats[i], cats[j]] = [cats[j], cats[i]];
  }
  return cats
    .slice(0, 3)
    .map((cat) => {
      const opties = MISSIE_POOL.filter((d) => d.categorie === cat);
      return opties[Math.floor(rng() * opties.length)];
    })
    .sort(
      (a, b) => CATEGORIEEN.indexOf(a.categorie) - CATEGORIEEN.indexOf(b.categorie),
    );
}

/** Afgewerkte matches van de speler, gesplitst rond de doelweek. */
function bouwContext(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  weekIdx: number,
): MissieContext {
  const eigen = chronologisch(matches).filter(
    (m) => outcomeFor(m, teams, playerId) !== null,
  );
  const weekMatches: Match[] = [];
  const eerdereMatches: Match[] = [];
  for (const m of eigen) {
    const d = matchDate(m);
    if (!d) continue;
    const w = weekIndex(d);
    if (w === weekIdx) weekMatches.push(m);
    else if (w < weekIdx) eerdereMatches.push(m);
  }
  return { weekMatches, eerdereMatches, alleChrono: eigen, teams, playerId };
}

function missiesVoorWeek(ctx: MissieContext, weekIdx: number): Missie[] {
  return kiesMissies(weekIdx).map((def) => {
    const nu = def.meet(ctx);
    return {
      id: def.id,
      naam: def.naam,
      emoji: def.emoji,
      omschrijving: def.omschrijving,
      behaald: nu >= def.doel,
      voortgang: { nu, doel: def.doel },
    };
  });
}

/** De 3 weekmissies van de week van `now`, met voortgang van de speler. */
export function deriveMissions(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  now: Date = new Date(),
): Missie[] {
  const weekIdx = weekIndex(now);
  return missiesVoorWeek(bouwContext(matches, teams, playerId, weekIdx), weekIdx);
}

/** Evalueer één missie uit de pool voor de week van `now` — voor tests. */
export function evalueerMissie(
  def: MissieDef,
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
  now: Date,
): Missie {
  const ctx = bouwContext(matches, teams, playerId, weekIndex(now));
  const nu = def.meet(ctx);
  return {
    id: def.id,
    naam: def.naam,
    emoji: def.emoji,
    omschrijving: def.omschrijving,
    behaald: nu >= def.doel,
    voortgang: { nu, doel: def.doel },
  };
}

/**
 * Aantal "perfecte weken": weken waarin de speler alle drie de weekmissies
 * van tóén haalde. Een week zonder matches kan nooit perfect zijn (elke
 * missie vraagt spelen), dus alleen weken met matches worden bekeken; de
 * lopende week telt mee zodra hij compleet is. Telt over de aangeleverde
 * matches (dashboard/profiel geeft er max ~100 door) — dezelfde benadering
 * als de andere afgeleide badges.
 */
export function perfecteWeken(
  matches: Match[],
  teams: Record<string, Team>,
  playerId: string,
): number {
  const weken = new Set<number>();
  for (const m of matches) {
    if (outcomeFor(m, teams, playerId) === null) continue;
    const d = matchDate(m);
    if (d) weken.add(weekIndex(d));
  }
  let n = 0;
  for (const w of weken) {
    const ctx = bouwContext(matches, teams, playerId, w);
    if (missiesVoorWeek(ctx, w).every((mi) => mi.behaald)) n += 1;
  }
  return n;
}
