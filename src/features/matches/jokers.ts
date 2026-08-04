// Maandelijkse jokers (#1003): client-side evenknie van de databank-logica
// rond match_jokers. De preset, JOKER_FACTOR en jokerBlokkade spiegelen
// respectievelijk het enum public.joker_type, public._effect_factor en
// public.match_jokers_guard (supabase/schemas/functions/34_match_jokers.sql);
// het maandtegoed spiegelt de unieke index match_jokers_one_per_month.
//
// De guard blijft de enige echte poort; dit bestand bestaat zodat de kaart
// meteen kan tonen wat een kaart doet en waarom je hem (nog) niet mag spelen,
// zonder eerst een servererror te moeten uitlokken. Zelfde opzet en zelfde
// verantwoording als stakes.ts bij de lef-tip.

import { DEFAULT_CLUB } from "@/features/availability/club";
import { K_FACTOR } from "@/features/rating/elo";
import { inTeam } from "@/features/rating/results";
import { MIN_GAMES, type MatchStake } from "@/features/matches/stakes";
import { dayInZone } from "@/lib/utils/time";
import type { Match, Team } from "@/types";

/** De drie kaarten; spiegel van public.joker_type. */
export type JokerId = "schild" | "dubbel_of_niets" | "wissel_van_kant";

export interface MatchJoker {
  match_id: string;
  player_id: string;
  group_id: string;
  joker: JokerId;
  /** Eerste dag van de maand in clubtijd (YYYY-MM-01), serverside gezet. */
  period_month: string;
  created_at: string;
}

export interface JokerPreset {
  id: JokerId;
  /** Naam op de kaart en in de feed. */
  label: string;
  /** Decoratief icoon; nooit de enige drager van betekenis. */
  icoon: string;
  /** Eén regel onder de naam: wat de kaart met deze match doet. */
  effect: string;
  /** De prijs of de kleine letters — waarom je hem niet blind opspeelt. */
  prijs: string;
  /** Raakt deze kaart de rating? Zo nee, dan gelden de rating-drempels niet. */
  raaktRating: boolean;
}

/**
 * De kaarten in de volgorde waarin ze op de tegel staan: eerst de twee die je
 * rating raken (en dus een keuze zijn), dan de sociale.
 */
export const JOKERS: readonly JokerPreset[] = [
  {
    id: "schild",
    label: "Schild",
    icoon: "🛡️",
    effect: "Deze match telt niet voor jouw rating.",
    prijs: "Je verlies vervalt — je winst ook.",
    raaktRating: true,
  },
  {
    id: "dubbel_of_niets",
    label: "Dubbel of niets",
    icoon: "🎲",
    effect: "Je eigen mutatie telt dubbel, in beide richtingen.",
    prijs: "Een extra lef-tip uit je voorraad; bij gelijkspel telt hij niet.",
    raaktRating: true,
  },
  {
    id: "wissel_van_kant",
    label: "Wissel van kant",
    icoon: "🔄",
    effect: "De tegenstanders wisselen links en rechts.",
    prijs: "Kost geen ratingpunt — alleen hun houvast. Enkel in het dubbel.",
    raaktRating: false,
  },
];

const PER_ID = new Map(JOKERS.map((j) => [j.id, j]));

/** De preset van een kaart, of null bij een (nog) onbekende waarde. */
export function jokerPreset(id: string | null | undefined): JokerPreset | null {
  return id ? (PER_ID.get(id as JokerId) ?? null) : null;
}

/** Naam van een kaart; valt terug op de ruwe waarde als het enum vooruitloopt. */
export function jokerLabel(id: string): string {
  return jokerPreset(id)?.label ?? id;
}

/** Icoon van een kaart; leeg voor een onbekende waarde (nooit een vraagteken). */
export function jokerIcoon(id: string): string {
  return jokerPreset(id)?.icoon ?? "";
}

/**
 * De multiplier van één kaart op je eigen mutatie — spiegel van
 * public._effect_factor. Een gelijkspel telt niet voor de verdubbeling: de
 * mutatie is dan K · (0,5 − E), wat voor een underdog positief is en geen
 * beloning voor een mislukte gok mag worden. Het schild kent die uitzondering
 * niet: "telt niet" is onvoorwaardelijk.
 */
export function jokerFactor(
  joker: JokerId | null,
  hasWinner: boolean,
): number {
  if (joker === "schild") return 0;
  if (joker === "dubbel_of_niets" && hasWinner) return 2;
  return 1;
}

/**
 * De factor die werkelijk op je mutatie valt: lef-tip en joker samen. greatest
 * en geen product, precies zoals _effect_factor — twee keer verdubbelen bestaat
 * niet, en het schild wint van alles.
 */
export function effectFactor(opts: {
  joker: JokerId | null;
  staked: boolean;
  hasWinner: boolean;
}): number {
  if (opts.joker === "schild") return 0;
  return Math.max(
    opts.staked && opts.hasWinner ? 2 : 1,
    jokerFactor(opts.joker, opts.hasWinner),
  );
}

/**
 * Wat er met een kaart op het spel staat bij de huidige winkans van jouw team:
 * de mutatie bij winst en bij verlies. Spiegelt `round(k * (sa - ea) * f)` uit
 * _apply_match_rating — één keer afronden, ná de vermenigvuldiging.
 */
export function jokerSwing(
  mijnKans: number,
  joker: JokerId | null,
): { winst: number; verlies: number } {
  return {
    winst: Math.round(K_FACTOR * (1 - mijnKans) * jokerFactor(joker, true)),
    verlies: Math.round(K_FACTOR * -mijnKans * jokerFactor(joker, true)),
  };
}

/**
 * De maand die het tegoed draagt: de eerste dag van de maand van de match, in
 * clubtijd. Spiegel van `date_trunc('month', played_at at time zone tz)` in de
 * guard; die kolom is serverside een snapshot van het speelmoment.
 */
export function periodeMaand(playedAt: string): string {
  return `${dayInZone(playedAt, DEFAULT_CLUB.timezone).slice(0, 7)}-01`;
}

/** Maandlabel voor in de tekst: "september 2026". */
export function maandLabel(periodMonth: string): string {
  const [jaar, maand] = periodMonth.split("-");
  return new Date(Number(jaar), Number(maand) - 1, 1).toLocaleDateString(
    "nl-BE",
    { month: "long", year: "numeric" },
  );
}

/** Waarom een kaart (nog) niet gespeeld kan worden; null = het mag. */
export type JokerBlokkade =
  | "geen-groepsmatch"
  | "geen-deelnemer"
  | "gesloten"
  | "geen-starttijd"
  | "te-weinig-matches"
  | "maand-bezet"
  | "alleen-dubbel"
  | "lef-staat-al";

/**
 * Is de aftrap geweest? Vanaf dat moment sluit het jokervenster én worden de
 * rating-kaarten onthuld. Eén regel voor tegel, kaartkop en feed, zodat de
 * anti-meelift-garantie niet per component opnieuw wordt uitgevonden — zelfde
 * constructie als lefGestart (#981).
 */
export function jokerGestart(match: Match, now?: number): boolean {
  return (
    match.status !== "scheduled" ||
    (match.played_at != null &&
      new Date(match.played_at).getTime() <= (now ?? Date.now()))
  );
}

/**
 * Mag deze kaart vóór de aftrap al zichtbaar zijn voor de hele groep?
 *
 * Wissel van kant wél: die verandert hoe er gespeeld wordt, dus wie het pas bij
 * de eerste bal hoort staat verkeerd opgesteld. Schild en dubbel of niets niet
 * — dat zijn risicokeuzes waar anderen anders op zouden meeliften, precies de
 * reden die de lef-tip achter de aftrap houdt.
 */
export function jokerVooraf(joker: JokerId): boolean {
  return joker === "wissel_van_kant";
}

/**
 * Welke jokers van deze match je nú mag zien: die van jezelf altijd, de
 * sociale kaarten van anderen ook, en de rest pas na de aftrap.
 */
export function zichtbareJokers(opts: {
  match: Match;
  jokers: MatchJoker[];
  myId: string | null;
  now?: number;
}): MatchJoker[] {
  const gestart = jokerGestart(opts.match, opts.now);
  return opts.jokers.filter(
    (j) =>
      gestart ||
      (opts.myId != null && j.player_id === opts.myId) ||
      jokerVooraf(j.joker),
  );
}

/**
 * De kaart die je maandtegoed bezet houdt: je eigen joker op een ándere match
 * in dezelfde maand, of null. De tegel gebruikt hem om te zeggen wáár je kaart
 * ligt in plaats van alleen "al gespeeld".
 */
export function maandBezetDoor(
  eigenJokers: MatchJoker[],
  matchId: string,
  playedAt: string,
): MatchJoker | null {
  const maand = periodeMaand(playedAt);
  return (
    eigenJokers.find(
      (j) => j.match_id !== matchId && j.period_month.slice(0, 10) === maand,
    ) ?? null
  );
}

/**
 * Spiegel van match_jokers_guard: mag deze speler nú deze kaart spelen? Geeft
 * de reden terug als het niet mag, zodat de tegel het kan uitleggen. De
 * volgorde volgt de guard, zodat client en server dezelfde eerste reden noemen.
 */
export function jokerBlokkade(opts: {
  match: Match;
  joker: JokerId;
  isDeelnemer: boolean;
  games: number;
  /** Je eigen jokers, minstens die van de maand van deze match. */
  eigenJokers: MatchJoker[];
  /** Je eigen lef-tips op deze match: de rating-kaarten sluiten die uit. */
  eigenStakes?: MatchStake[];
  now?: number;
}): JokerBlokkade | null {
  const { match: m, joker, isDeelnemer, games } = opts;
  const now = opts.now ?? Date.now();
  if (!m.group_id) return "geen-groepsmatch";
  if (!isDeelnemer) return "geen-deelnemer";
  if (!m.played_at) return "geen-starttijd";
  if (m.status !== "scheduled") return "gesloten";
  if (new Date(m.played_at).getTime() <= now) return "gesloten";
  if (joker === "wissel_van_kant" && m.format === "1v1") return "alleen-dubbel";
  if (jokerPreset(joker)?.raaktRating && games < MIN_GAMES)
    return "te-weinig-matches";
  if (
    jokerPreset(joker)?.raaktRating &&
    (opts.eigenStakes ?? []).some((s) => s.match_id === m.id)
  )
    return "lef-staat-al";
  if (maandBezetDoor(opts.eigenJokers, m.id, m.played_at)) return "maand-bezet";
  return null;
}

/** Uitleg bij een blokkade, voor de tekst onder de knoppen. */
export function jokerBlokkadeUitleg(
  reden: JokerBlokkade,
  games: number,
): string {
  switch (reden) {
    case "te-weinig-matches":
      return `Nog ${MIN_GAMES - games} ${
        MIN_GAMES - games === 1 ? "match" : "matches"
      } te gaan: deze kaart kan zodra je rating ingelopen is.`;
    case "maand-bezet":
      return "Je joker van deze maand is al gespeeld — één kaart per kalendermaand.";
    case "lef-staat-al":
      return "Je lef staat al op deze match: trek die eerst in.";
    case "alleen-dubbel":
      return "Van kant wisselen kan alleen in het dubbelspel.";
    case "gesloten":
      return "De match is begonnen: je kaart ligt vast.";
    case "geen-starttijd":
      return "Zonder starttijd is er geen maand om op af te rekenen.";
    default:
      return "";
  }
}

/**
 * Een geweigerde kaart in gewone taal.
 *
 * Het maandtegoed wordt bewust door de unieke index match_jokers_one_per_month
 * bewaakt en niet door een `raise` in de guard: twee gelijktijdige inserts
 * zouden een telling allebei passeren, een index niet. De prijs is dat een
 * botsing als kale Postgres-tekst binnenkomt ("duplicate key value violates
 * unique constraint …"). Dat overkomt je zodra de client zijn tegoed nog van
 * vóór je vorige kaart kent — bijvoorbeeld een tweede rondekaart die al geladen
 * was toen je op de eerste een joker speelde. Hier wordt die botsing weer een
 * zin.
 *
 * De `raise`-meldingen van de guard zelf zijn al Nederlands en leesbaar ("de
 * match is al begonnen"); die gaan ongewijzigd door.
 */
export function jokerFoutMelding(err: unknown): string {
  const fout = err as { code?: string; message?: string } | null;
  const tekst = typeof fout?.message === "string" ? fout.message : "";
  if (fout?.code === "23505" || tekst.includes("duplicate key value")) {
    return tekst.includes("match_jokers_one_per_month")
      ? jokerBlokkadeUitleg("maand-bezet", 0)
      : "Je speelde al een kaart op deze match.";
  }
  return tekst || "De joker spelen lukte niet. Probeer het zo nog eens.";
}

/**
 * Meta-regel voor op de (ingeklapte) matchkaart en in de feed: wie welke kaart
 * speelde, met de uitkomst zodra die vaststaat. Volgt zichtbareJokers — vóór de
 * aftrap dus alleen je eigen kaart en de sociale kaarten van anderen.
 */
export function jokerKaartRegel(opts: {
  match: Match;
  /** Jokers, eventueel van meerdere matches (bulk); er wordt gefilterd. */
  jokers: MatchJoker[];
  teams: Record<string, Team>;
  naam: (playerId: string) => string;
  myId?: string | null;
  now?: number;
}): string | null {
  const { match, teams, naam } = opts;
  const eigen = zichtbareJokers({
    match,
    jokers: opts.jokers.filter((j) => j.match_id === match.id),
    myId: opts.myId ?? null,
    now: opts.now,
  });
  if (eigen.length === 0) return null;
  const klaar = match.status === "completed";
  const winnaar =
    klaar && match.winner_team_id != null ? teams[match.winner_team_id] : null;
  const delen = eigen.map((j) => {
    const kaart = `${jokerIcoon(j.joker)} ${jokerLabel(j.joker)}`.trim();
    if (!klaar) return `${naam(j.player_id)} — ${kaart}`;
    if (winnaar == null) return `${naam(j.player_id)} — ${kaart}, gelijkspel`;
    return `${naam(j.player_id)} — ${kaart}, ${
      inTeam(winnaar, j.player_id) ? "winst" : "verlies"
    }`;
  });
  return `🃏 ${delen.join(" · ")}`;
}
