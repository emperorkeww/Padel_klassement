// Lef-tip (#804): client-side evenknie van de databank-logica rond
// match_stakes. STAKE_FACTOR spiegelt public._stake_factor en de Elo-kern
// (supabase/schemas/functions/30_match_stakes.sql en 09_ratings.sql),
// MIN_GAMES en het speeldag-tegoed spiegelen match_stakes_guard en de unieke
// index match_stakes_one_per_day.
//
// De guard blijft de enige echte poort; dit bestand bestaat zodat de kaart
// meteen kan tonen wat er op het spel staat en waarom je (nog) niet mag
// inzetten, zonder eerst een servererror te moeten uitlokken.

import { DEFAULT_CLUB } from "@/features/availability/club";
import { K_FACTOR } from "@/features/rating/elo";
import { inTeam } from "@/features/rating/results";
import { dayInZone } from "@/lib/utils/time";
import type { Match, Team } from "@/types";

export interface MatchStake {
  match_id: string;
  player_id: string;
  group_id: string;
  /** Speeldag in clubtijd (YYYY-MM-DD), serverside gezet door de guard. */
  play_date: string;
  created_at: string;
}

/** Multiplier op je eigen mutatie als je ingezet hebt — in beide richtingen. */
export const STAKE_FACTOR = 2;

/** Aantal gespeelde matches voordat je mag inzetten (match_stakes_guard). */
export const MIN_GAMES = 10;

/** Waarom inzetten (nog) niet kan; null = het mag. */
export type StakeBlokkade =
  | "geen-groepsmatch"
  | "geen-deelnemer"
  | "gesloten"
  | "geen-starttijd"
  | "te-weinig-matches"
  | "dag-bezet";

/** Speeldag van een match in clubtijd — de sleutel van het lef-tegoed. */
export function playDay(playedAt: string): string {
  return dayInZone(playedAt, DEFAULT_CLUB.timezone);
}

/**
 * Multiplier van één speler op één match. Een gelijkspel telt niet mee: de
 * mutatie is dan K · (0,5 − E), wat voor een underdog positief is en geen
 * beloning voor een mislukte inzet mag worden.
 */
export function stakeFactor(staked: boolean, hasWinner: boolean): number {
  return staked && hasWinner ? STAKE_FACTOR : 1;
}

/**
 * Wat er op het spel staat bij de huidige winkans van jóuw team: de mutatie
 * bij winst en bij verlies, met de multiplier erin verwerkt. Spiegelt
 * `round(k * (sa - ea) * f)` uit _apply_match_rating — één keer afronden, ná
 * de vermenigvuldiging.
 */
export function stakeSwing(
  mijnKans: number,
  staked: boolean,
): { winst: number; verlies: number } {
  const f = staked ? STAKE_FACTOR : 1;
  return {
    winst: Math.round(K_FACTOR * (1 - mijnKans) * f),
    verlies: Math.round(K_FACTOR * -mijnKans * f),
  };
}

/**
 * Is de aftrap geweest? Vanaf dat moment sluit het inzetvenster én wordt
 * onthuld wie er lef had (#981). Eén regel voor tegel, kaartkop en compacte
 * kaart, zodat de anti-meelift-garantie — vóór de aftrap zie je alleen je
 * eigen inzet — niet per component opnieuw wordt uitgevonden.
 */
export function lefGestart(match: Match, now?: number): boolean {
  return (
    match.status !== "scheduled" ||
    (match.played_at != null &&
      new Date(match.played_at).getTime() <= (now ?? Date.now()))
  );
}

/**
 * De inzet die het dagtegoed bezet houdt: jouw stake op een ándere match van
 * dezelfde speeldag (#981), of null. De kaart gebruikt hem om je erheen te
 * wijzen in plaats van alleen "al vergeven" te zeggen.
 */
export function dagBezetDoor(
  eigenStakes: MatchStake[],
  matchId: string,
  playedAt: string,
): MatchStake | null {
  const dag = playDay(playedAt);
  return (
    eigenStakes.find((s) => s.match_id !== matchId && s.play_date === dag) ??
    null
  );
}

/**
 * Heeft deze speler op die speeldag al ergens anders ingezet? Dat is het
 * tegoed: één lef-tip per speeldag, in de databank afgedwongen door de unieke
 * index op (player_id, play_date).
 */
export function dagBezet(
  eigenStakes: MatchStake[],
  matchId: string,
  playedAt: string,
): boolean {
  return dagBezetDoor(eigenStakes, matchId, playedAt) !== null;
}

/**
 * Meta-regel voor op de (ingeklapte) matchkaart (#981): wie er lef had, met
 * de uitkomst zodra die vaststaat. Volgt lefGestart — vóór de aftrap dus
 * niets, hoe de kaart er verder ook bij staat. Een gelijkspel telt niet
 * (stakeFactor 1), maar de inzet blijft wel zichtbaar: opschepmateriaal werkt
 * alleen als ook de mislukte gok te zien is.
 */
export function lefKaartRegel(opts: {
  match: Match;
  /** Inzetten, eventueel van meerdere matches (bulk); er wordt gefilterd. */
  stakes: MatchStake[];
  teams: Record<string, Team>;
  naam: (playerId: string) => string;
  now?: number;
}): string | null {
  const { match, teams, naam } = opts;
  const eigen = opts.stakes.filter((s) => s.match_id === match.id);
  if (eigen.length === 0 || !lefGestart(match, opts.now)) return null;
  const klaar = match.status === "completed";
  const winnaar =
    klaar && match.winner_team_id != null ? teams[match.winner_team_id] : null;
  const delen = eigen.map((s) => {
    if (!klaar) return naam(s.player_id);
    if (winnaar == null) return `${naam(s.player_id)} — gelijkspel, telt niet`;
    return `${naam(s.player_id)} — ${
      inTeam(winnaar, s.player_id) ? "winst" : "verlies"
    }`;
  });
  const factor = klaar && winnaar == null ? "" : ` ×${STAKE_FACTOR}`;
  return `🎲 lef${factor} · ${delen.join(" · ")}`;
}

/**
 * Spiegel van match_stakes_guard: mag deze speler nú inzetten op deze match?
 * Geeft de reden terug als het niet mag, zodat de kaart het kan uitleggen.
 */
export function stakeBlokkade(opts: {
  match: Match;
  isDeelnemer: boolean;
  games: number;
  eigenStakes: MatchStake[];
  now?: number;
}): StakeBlokkade | null {
  const { match, isDeelnemer, games, eigenStakes } = opts;
  const now = opts.now ?? Date.now();
  if (!match.group_id) return "geen-groepsmatch";
  if (!isDeelnemer) return "geen-deelnemer";
  if (!match.played_at) return "geen-starttijd";
  if (match.status !== "scheduled") return "gesloten";
  if (new Date(match.played_at).getTime() <= now) return "gesloten";
  if (games < MIN_GAMES) return "te-weinig-matches";
  if (dagBezet(eigenStakes, match.id, match.played_at)) return "dag-bezet";
  return null;
}

/** Uitleg bij een blokkade, voor de tekst onder de knop. */
export function blokkadeUitleg(reden: StakeBlokkade, games: number): string {
  switch (reden) {
    case "te-weinig-matches":
      return `Nog ${MIN_GAMES - games} ${
        MIN_GAMES - games === 1 ? "match" : "matches"
      } te gaan: inzetten kan zodra je rating ingelopen is.`;
    case "dag-bezet":
      return "Je lef is vandaag al vergeven — één inzet per speeldag.";
    case "gesloten":
      return "De match is begonnen: je inzet ligt vast.";
    case "geen-starttijd":
      return "Zonder starttijd valt er niets in te zetten.";
    default:
      return "";
  }
}

/**
 * Een afgewezen inzet in gewone taal (#804).
 *
 * Het dagtegoed wordt bewust door de unieke index `match_stakes_one_per_day`
 * bewaakt en niet door een `raise` in de guard: twee gelijktijdige inserts
 * zouden een telling allebei passeren, een index niet. De prijs is dat een
 * botsing als kale Postgres-tekst binnenkomt ("duplicate key value violates
 * unique constraint …"). Dat overkomt je zodra de client zijn tegoed nog van
 * vóór je vorige inzet kent — bijvoorbeeld een tweede rondekaart in de
 * Spelen-tab die al geladen was toen je op de eerste inzette. Hier wordt die
 * botsing weer een zin.
 *
 * De `raise`-meldingen van de guard zelf zijn al Nederlands en leesbaar
 * ("de match is al begonnen"); die gaan ongewijzigd door.
 */
export function stakeFoutMelding(err: unknown): string {
  const fout = err as { code?: string; message?: string } | null;
  const tekst = typeof fout?.message === "string" ? fout.message : "";
  if (fout?.code === "23505" || tekst.includes("duplicate key value")) {
    return tekst.includes("match_stakes_one_per_day")
      ? blokkadeUitleg("dag-bezet", 0)
      : "Je lef stond al op deze match.";
  }
  return tekst || "Inzetten lukte niet. Probeer het zo nog eens.";
}
