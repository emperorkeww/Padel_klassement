// Status van de speeldag als geheel (#839): hoe ver staat de avond, en waar
// komt de indeling vandaan?
//
// Beide vragen werden tot nu toe niet beantwoord. De voortgang stond alleen per
// ronde ("2/4 uitslagen"), dus wie wilde weten hoe ver de avond stond, telde
// zelf op. En sinds #827/#846 kan de cron 's ochtends zelf een Americano-reeks
// neerzetten, maar geen enkel scherm vertelde dát dat gebeurd was — of dat het
// nog moest komen, of dat iets het tegenhield.
//
// Pure logica: de tab levert de rondes en polls aan, dit bestand rekent.

import { clubEpoch } from "@/lib/utils/time";
import type { PlayPoll, PollOption } from "./pollsApi";

/** Klokuur (clubtijd) waarop de cron de rondes klaarzet. Spiegel van
 *  POLL_ROUNDS_AT in supabase/functions/poll-deadline/index.ts (#846). */
export const AUTO_RONDES_UUR = "08:00";

/** Speling ná dat uur voordat we "hij komt nog" inruilen voor "hij deelde
 *  niets in": de cron tikt maar één keer per uur (op :05). */
export const AUTO_RONDES_MARGE_MIN = 60;

export type DagVoortgang = {
  /** Ingevulde uitslagen van vandaag. */
  gespeeld: number;
  /** Alle matches van vandaag: rondes én losse partijen. */
  totaal: number;
  /** Aantal genummerde rondes (losse partijen tellen niet mee). */
  rondes: number;
  /** Nummer van de eerste ronde met openstaande uitslagen, of null. */
  openRonde: number | null;
};

/** Telt de rondes van vandaag op tot één stand voor de hele dag. */
export function dagVoortgang(
  rounds: { round: number; list: { status: string }[] }[],
): DagVoortgang {
  let gespeeld = 0;
  let totaal = 0;
  let rondes = 0;
  let openRonde: number | null = null;
  for (const { round, list } of rounds) {
    totaal += list.length;
    gespeeld += list.filter((m) => m.status === "completed").length;
    if (round > 0) rondes += 1;
    if (
      openRonde === null &&
      round > 0 &&
      list.some((m) => m.status !== "completed")
    ) {
      openRonde = round;
    }
  }
  return { gespeeld, totaal, rondes, openRonde };
}

/**
 * Wie er won in een afgeronde ronde, als één regel voor de ingeklapte kop
 * (#839). Hooguit twee teams voluit; de rest telt als "+N", want een
 * ingeklapte ronde hoort één regel te blijven. Gelijkspelen leveren geen
 * winnaar en vallen dus weg; is er niets te melden, dan blijft de regel leeg.
 */
export function rondeWinnaars(
  list: { status: string; winner_team_id: string | null }[],
  labelVoor: (teamId: string) => string,
  maxTeams = 2,
): string {
  const namen: string[] = [];
  for (const m of list) {
    if (m.status !== "completed" || !m.winner_team_id) continue;
    const label = labelVoor(m.winner_team_id);
    if (label && !namen.includes(label)) namen.push(label);
  }
  if (namen.length === 0) return "";
  const rest = namen.length - maxTeams;
  return rest > 0
    ? `${namen.slice(0, maxTeams).join(", ")} +${rest}`
    : namen.join(", ");
}

/**
 * Waar de indeling van vandaag vandaan komt — of waarom er nog geen is.
 *
 * - `klaargezet`   de cron zette de rondes neer (poll draagt `rounds_generated_at`)
 * - `handmatig`    er staan rondes zonder dat de cron ze maakte
 * - `komt`         geboekte speeldag, automaat aan, het ochtenduur moet nog komen
 * - `overgeslagen` dat uur is ruim voorbij en er staat nog steeds niets
 * - `wacht`        het moment ligt vast, maar de baan is nog niet geboekt — de
 *                  cron wacht daarop (`magRondesZetten` eist status 'booked')
 * - `uit`          de groep zette de automaat uit
 */
export type Automaat =
  | { soort: "klaargezet"; tijdstip: string }
  | { soort: "handmatig"; doorId: string | null }
  | { soort: "komt"; uur: string }
  | { soort: "overgeslagen" }
  | { soort: "wacht" }
  | { soort: "uit" }
  | null;

/**
 * De speeldag van een kalenderdag: de poll met een vastgelegd moment op die
 * dag, of null. Een geboekte wint van een enkel gelockte — die eerste stuurt
 * de cron.
 *
 * Geëxporteerd sinds #1133: de dagkop wijst ook naar de speeldagpagina van
 * vandaag, en dat mag geen tweede definitie van "welke speeldag is dit" worden.
 */
export function speeldagVoorDag(
  polls: PlayPoll[],
  options: PollOption[],
  dag: string,
): PlayPoll | null {
  return (
    polls
      .filter((p) => p.status === "booked" || p.status === "locked")
      .filter((p) =>
        options.some((o) => o.id === p.locked_option_id && o.date === dag),
      )
      .sort((a, b) =>
        a.status === "booked" ? -1 : b.status === "booked" ? 1 : 0,
      )[0] ?? null
  );
}

export function automaatStatus(opts: {
  /** Alle polls van de groep. */
  polls: PlayPoll[];
  /** Alle poll-opties van de groep. */
  options: PollOption[];
  /** Clubdag waarvoor we de status bepalen. */
  today: string;
  /** Tijdzone van de club (voor het ochtenduur). */
  timezone: string;
  /** `groups.auto_rondes`; ontbreekt = aan. */
  autoRondes: boolean;
  /** Aantal genummerde rondes dat vandaag klaarstaat. */
  rondes: number;
  /** Wie de eerste ronde van vandaag aanmaakte (voor de handmatig-tekst). */
  doorId?: string | null;
  now?: number;
}): Automaat {
  const {
    polls,
    options,
    today,
    timezone,
    autoRondes,
    rondes,
    doorId = null,
    now = Date.now(),
  } = opts;

  const speeldag = speeldagVoorDag(polls, options, today);

  if (rondes > 0) {
    return speeldag?.rounds_generated_at
      ? { soort: "klaargezet", tijdstip: speeldag.rounds_generated_at }
      : { soort: "handmatig", doorId };
  }

  // Zonder speeldag van vandaag valt er over de automaat niets te melden: die
  // werkt alleen op vastgelegde momenten.
  if (!speeldag) return null;
  if (!autoRondes) return { soort: "uit" };
  if (speeldag.status !== "booked") return { soort: "wacht" };

  const grens =
    clubEpoch(today, AUTO_RONDES_UUR, timezone) +
    AUTO_RONDES_MARGE_MIN * 60_000;
  return now < grens
    ? { soort: "komt", uur: AUTO_RONDES_UUR }
    : { soort: "overgeslagen" };
}
