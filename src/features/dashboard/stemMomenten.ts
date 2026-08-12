import { clubEpoch } from "@/lib/utils/time";
import {
  AUTO_LOCK_HOURS,
  momentEindeMs,
  pollExpired,
  tallyOption,
} from "@/features/groups/pollLogic";
import type { PollVoteStatus } from "@/features/groups/pollsApi";
import type { OpenPollBundle } from "./dashboardHelpers";

/* ------------------------------------------------------------------ */
/* Welke momenten de stemkaart op het overzicht toont (#1196).         */
/*                                                                     */
/* De banner die hier stond koos de eerste groep met een open poll en   */
/* stuurde je door naar de speeldagpagina. Dit kiest op tíjd: de        */
/* eerstvolgende momenten waar jij nog iets over te zeggen hebt, over   */
/* al je groepen heen, zodat je ze meteen kunt beantwoorden.            */
/*                                                                     */
/* Puur — de data komt uit loadOpenPolls, dat toch al draait.           */
/* ------------------------------------------------------------------ */

/** Hoeveel rijen de kaart hoogstens draagt. Meer dan drie is geen kaart meer
 *  maar een lijst, en daarvoor is de agenda er. */
export const MAX_MOMENTEN = 3;

/** Hoeveel rijen één poll hoogstens mag vullen zolang een andere poll nog
 *  wacht. Zonder deze rem drukt een poll met vijf voorstellen de speeldag van
 *  je andere groep volledig weg. */
export const MAX_PER_POLL = 2;

/** Vanaf hier is het dringend: hetzelfde venster waarin `poll-deadline` de
 *  laatste-kans-push stuurt (POLL_LAST_CALL_HOURS). */
export const LAATSTE_KANS_UREN = 24;

export type StemMoment = {
  pollId: string;
  optionId: string;
  groupId: string;
  groupName: string;
  /** Kalenderdatum in clubtijd, precies zoals de kolom hem bewaart. */
  date: string;
  /** "HH:MM" in clubtijd. */
  startTime: string;
  duration: number;
  /** Start als epoch, in de zone van díe club — de sorteersleutel. */
  startMs: number;
  /** Aantal spelers met "ik kan" op dit moment. */
  jaAantal: number;
  /** Mijn stem op dít moment; null als ik er niets over zei. */
  mijnStem: PollVoteStatus | null;
};

export type StemKaartData = {
  /** 1 tot MAX_MOMENTEN momenten, oplopend in tijd. */
  momenten: StemMoment[];
  /** Meer dan één groep in beeld: dan hoort de groepsnaam per rij en niet in
   *  de kop. */
  meerdereGroepen: boolean;
  /** Op álle getoonde momenten gestemd. De rijen blijven staan — je moet je
   *  keuze kunnen herzien — maar de kaart hoeft niet meer te dringen. */
  alGestemd: boolean;
  /** Wanneer het eerste moment automatisch vastgelegd wordt; alleen gevuld
   *  binnen LAATSTE_KANS_UREN. Kan in het verleden liggen wanneer het moment
   *  zelf minder dan AUTO_LOCK_HOURS weg is: de cron tikt per uur, dus dan is
   *  "er wordt zo beslist" de eerlijkste lezing. */
  sluitMs: number | null;
  /** Gaat alles over dezelfde poll, dan kan de kaart naar die speeldag linken;
   *  bij meerdere polls is er geen enkele juiste bestemming. */
  pollId: string | null;
};

/**
 * De eerstvolgende momenten om op te stemmen, over al je groepen.
 *
 * Alleen open polls die nog niet verlopen zijn, en daarbinnen alleen momenten
 * waarvan het slot nog niet voorbij is — de poll-brede `pollExpired` laat een
 * poll pas vallen als het láátste moment geweest is, en tot die tijd zou een
 * kandidaat van gisteren blijven staan.
 */
export function kiesStemMomenten(
  bundles: OpenPollBundle[],
  myId: string,
  nowMs: number,
): StemKaartData | null {
  const kandidaten: StemMoment[] = [];

  for (const { group, polls, options, votes } of bundles) {
    for (const poll of polls) {
      if (poll.status !== "open") continue;
      if (pollExpired(poll, options, nowMs)) continue;

      for (const option of options) {
        if (option.poll_id !== poll.id) continue;
        const tz = poll.club_timezone;
        if (
          momentEindeMs(option.date, option.start_time, option.duration, tz) <
          nowMs
        ) {
          continue;
        }
        kandidaten.push({
          pollId: poll.id,
          optionId: option.id,
          groupId: group.id,
          groupName: group.name,
          date: option.date,
          startTime: option.start_time,
          duration: option.duration,
          startMs: clubEpoch(option.date, option.start_time, tz),
          jaAantal: tallyOption(option, votes).yes.length,
          mijnStem:
            votes.find(
              (v) => v.option_id === option.id && v.player_id === myId,
            )?.status ?? null,
        });
      }
    }
  }

  if (kandidaten.length === 0) return null;
  kandidaten.sort(opTijd);

  // Eerste ronde met de rem erop, daarna aanvullen uit wat overbleef: een poll
  // mag de kaart wél alleen vullen als er niets anders wacht.
  const gekozen: StemMoment[] = [];
  const rest: StemMoment[] = [];
  const perPoll = new Map<string, number>();
  for (const m of kandidaten) {
    const n = perPoll.get(m.pollId) ?? 0;
    if (gekozen.length >= MAX_MOMENTEN || n >= MAX_PER_POLL) {
      rest.push(m);
      continue;
    }
    gekozen.push(m);
    perPoll.set(m.pollId, n + 1);
  }
  for (const m of rest) {
    if (gekozen.length >= MAX_MOMENTEN) break;
    gekozen.push(m);
  }
  gekozen.sort(opTijd);

  const pollIds = new Set(gekozen.map((m) => m.pollId));
  const eerste = gekozen[0];
  const dringend = eerste.startMs - nowMs <= LAATSTE_KANS_UREN * 3600_000;

  return {
    momenten: gekozen,
    meerdereGroepen: new Set(gekozen.map((m) => m.groupId)).size > 1,
    alGestemd: gekozen.every((m) => m.mijnStem != null),
    sluitMs: dringend ? eerste.startMs - AUTO_LOCK_HOURS * 3600_000 : null,
    pollId: pollIds.size === 1 ? eerste.pollId : null,
  };
}

/**
 * Wanneer er over het eerste moment beslist wordt, in gewone taal.
 *
 * Bewust relatief en niet als klok: het moment hoort bij een club met een eigen
 * tijdzone, en "sluit over 5 uur" heeft die vraag niet. Null zolang het niet
 * dringend is — dan hoeft de kaart er niets over te zeggen.
 */
export function sluitTekst(
  sluitMs: number | null,
  nowMs: number,
): string | null {
  if (sluitMs == null) return null;
  const uren = (sluitMs - nowMs) / 3600_000;
  if (uren <= 0) return "Er wordt zo beslist.";
  if (uren < 1) return "Sluit binnen het uur.";
  return `Sluit over ${Math.round(uren)} uur.`;
}

/** Op tijd, en bij gelijke tijd op optie-id: twee groepen die toevallig
 *  hetzelfde uur kiezen mogen niet per render van plek wisselen. */
function opTijd(a: StemMoment, b: StemMoment): number {
  return a.startMs - b.startMs || a.optionId.localeCompare(b.optionId);
}
