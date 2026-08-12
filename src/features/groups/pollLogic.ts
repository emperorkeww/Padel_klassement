import type {
  NewPollOption,
  PlayPoll,
  PollOption,
  PollVote,
  PollVoteStatus,
} from "./pollsApi";
import { clubEpoch } from "@/lib/utils/time";

// Pure logica rond speeldag-polls: banen-behoefte, haalbaarheid per optie en
// welke poll de groepspagina toont. Getest in pollLogic.test.ts.

/** Vier spelers per baan (padel). */
export const PLAYERS_PER_COURT = 4;

/** Banen nodig voor dit aantal ja-stemmers (minimaal 1). */
export function courtsNeeded(yesCount: number): number {
  return Math.max(1, Math.ceil(yesCount / PLAYERS_PER_COURT));
}

/**
 * Haalbaarheid van een optie:
 * - onbekend  — geen beschikbaarheidsdata (club zonder data of buiten venster);
 * - haalbaar  — meer banen vrij dan nodig;
 * - krap      — precies genoeg banen vrij;
 * - onhaalbaar — minder banen vrij dan nodig.
 */
export type OptionState = "haalbaar" | "krap" | "onhaalbaar" | "onbekend";

export function optionState(
  yesCount: number,
  courtsFree: number | null,
): OptionState {
  if (courtsFree == null) return "onbekend";
  const needed = courtsNeeded(yesCount);
  if (courtsFree < needed) return "onhaalbaar";
  if (courtsFree === needed) return "krap";
  return "haalbaar";
}

/** Reacties op één optie, gegroepeerd per status. */
export interface OptionTally {
  yes: string[]; // player_id's
  maybe: string[];
  no: string[];
  needed: number;
  /** Genoeg spelers voor minstens één baan (4+ ja-stemmers). */
  enoughPlayers: boolean;
}

export function tallyOption(
  option: PollOption,
  votes: PollVote[],
): OptionTally {
  const mine = votes.filter((v) => v.option_id === option.id);
  const by = (s: PollVoteStatus) =>
    mine.filter((v) => v.status === s).map((v) => v.player_id);
  const yes = by("yes");
  return {
    yes,
    maybe: by("maybe"),
    no: by("no"),
    needed: courtsNeeded(yes.length),
    enoughPlayers: yes.length >= PLAYERS_PER_COURT,
  };
}

/** Een moment is vastlegbaar zolang de dag zelf niet voorbij is. */
export function vastlegbaar(option: PollOption, today: string): boolean {
  return option.date >= today;
}

/**
 * Het moment dat de app voorstelt: onder de nog vastlegbare, niet-onhaalbare
 * opties die met de meeste ja-stemmen. Bij gelijkspel wint de vroegste — de
 * lijst komt gesorteerd binnen uit `pollOptions`.
 *
 * Bewust een advies en geen wet (#1181): de beheerder mag in de MomentKiezer
 * élk moment vastleggen, ook een onhaalbaar of minder populair.
 *
 * `vrijOp` levert de vrije banen van een optie, zodat de kaart zijn live
 * beschikbaarheid kan meegeven in plaats van de momentopname op de rij.
 */
export function besteOptie(
  options: PollOption[],
  votes: PollVote[],
  vrijOp: (option: PollOption) => number | null,
  today: string,
): PollOption | null {
  let best: { option: PollOption; yes: number } | null = null;
  for (const o of options) {
    if (!vastlegbaar(o, today)) continue;
    const yes = tallyOption(o, votes).yes.length;
    if (optionState(yes, vrijOp(o)) === "onhaalbaar") continue;
    if (!best || yes > best.yes) best = { option: o, yes };
  }
  return best?.option ?? null;
}

/** Marge na afloop van het slot voordat een moment als verlopen telt (#440):
 *  uitloop op de baan en de laatste uitslagen invullen. */
export const SLOT_EXPIRY_MARGIN_MIN = 30;

/**
 * Epoch (ms, clubtijd) waarop het slot zélf afgelopen is: start plus duur.
 *
 * Dit is "geweest" in de dagelijkse betekenis — de agenda kleurt er zijn
 * verleden mee en de stemknoppen gaan hierop dicht. Bewust iets anders dan
 * `optionEndMs` hieronder: dáár zit de marge van #440 bij, omdat een poll pas
 * later zinloos wordt (uitloop op de baan, uitslagen invullen). Eén definitie
 * voor beide zou of het raster of de vervaldatum verschuiven.
 */
export function momentEindeMs(
  date: string,
  startTime: string,
  duration: number,
  timeZone: string,
): number {
  return clubEpoch(date, startTime, timeZone) + duration * 60_000;
}

/** Epoch (ms, clubtijd) waarop een optie verlopen is: slot-einde plus marge. */
function optionEndMs(o: PollOption, timeZone: string): number {
  return (
    momentEindeMs(o.date, o.start_time, o.duration, timeZone) +
    SLOT_EXPIRY_MARGIN_MIN * 60_000
  );
}

/**
 * Uren vóór het eerste moment waarop `poll-deadline` de poll automatisch
 * vastlegt. Clientkopie van `POLL_AUTO_LOCK_HOURS`
 * (supabase/functions/poll-deadline/index.ts): alleen om te kúnnen zeggen
 * wanneer er beslist wordt. Wie die env-waarde verzet, verzet deze mee.
 */
export const AUTO_LOCK_HOURS = 12;

/**
 * Of een poll verlopen is (#440). Voor gelockte/geboekte polls telt het
 * gekozen moment; voor open polls het láátste kandidaat-moment (zolang er
 * nog één te spelen valt, is de poll zinvol). Een open poll zonder opties
 * verloopt niet: er valt niets te "missen" en de maker kan nog momenten
 * toevoegen. Vergelijking in clubtijd via poll.club_timezone.
 */
export function pollExpired(
  poll: PlayPoll,
  options: PollOption[],
  nowMs: number,
): boolean {
  if (poll.locked_option_id) {
    const locked = options.find((o) => o.id === poll.locked_option_id);
    return !!locked && optionEndMs(locked, poll.club_timezone) <= nowMs;
  }
  const own = options.filter((o) => o.poll_id === poll.id);
  if (own.length === 0) return false;
  return own.every((o) => optionEndMs(o, poll.club_timezone) <= nowMs);
}

/**
 * Sorteersleutel van een poll: het eerstvolgende moment dat er nog toe doet.
 * Voor gelockte/geboekte polls het gekozen moment; anders het vroegste
 * kandidaat-moment dat nog niet verlopen is (valt terug op het laatste moment).
 */
function pollMoment(
  poll: PlayPoll,
  options: PollOption[],
  nowMs: number,
): number {
  const startMs = (o: PollOption) =>
    clubEpoch(o.date, o.start_time, poll.club_timezone);
  if (poll.locked_option_id) {
    const locked = options.find((o) => o.id === poll.locked_option_id);
    if (locked) return startMs(locked);
  }
  const own = options
    .filter((o) => o.poll_id === poll.id)
    .sort((a, b) => startMs(a) - startMs(b));
  const upcoming = own.find((o) => optionEndMs(o, poll.club_timezone) > nowMs);
  const pick = upcoming ?? own[own.length - 1];
  return pick ? startMs(pick) : Number.MAX_SAFE_INTEGER;
}

/**
 * De polls die de groepspagina toont: open, gelockte en geboekte polls
 * waarvan het slot (start + duur + marge) nog niet voorbij is (#440), in
 * clubtijd. Gesorteerd op eerstvolgend moment (soonest-first).
 */
export function activePolls(
  polls: PlayPoll[],
  options: PollOption[],
  nowMs: number,
): PlayPoll[] {
  return polls
    .filter((p) => {
      if (p.status === "open" || p.status === "locked") {
        return !pollExpired(p, options, nowMs);
      }
      if (p.status === "booked" && p.locked_option_id) {
        const opt = options.find((o) => o.id === p.locked_option_id);
        return !!opt && !pollExpired(p, options, nowMs);
      }
      return false;
    })
    .sort((a, b) => pollMoment(a, options, nowMs) - pollMoment(b, options, nowMs));
}

/**
 * Verschil tussen de bestaande opties en de bewerkte selectie ("Dagen
 * aanpassen"): wat moet erbij, en welke optie-id's moeten weg. Ongewijzigde
 * momenten blijven onaangeraakt, zodat de stemmen erop behouden blijven.
 */
export function diffPollOptions(
  existing: PollOption[],
  picked: Map<string, NewPollOption>,
): { toAdd: NewPollOption[]; toRemoveIds: string[] } {
  const key = (date: string, time: string) => `${date}|${time}`;
  const existingKeys = new Set(existing.map((o) => key(o.date, o.start_time)));
  return {
    toAdd: [...picked.values()].filter(
      (o) => !existingKeys.has(key(o.date, o.startTime)),
    ),
    toRemoveIds: existing
      .filter((o) => !picked.has(key(o.date, o.start_time)))
      .map((o) => o.id),
  };
}

/** Leden die nog op geen enkele optie van de poll stemden. */
export function nonVoters(
  memberIds: string[],
  options: PollOption[],
  votes: PollVote[],
): string[] {
  const optionIds = new Set(options.map((o) => o.id));
  const voted = new Set(
    votes.filter((v) => optionIds.has(v.option_id)).map((v) => v.player_id),
  );
  return memberIds.filter((id) => !voted.has(id));
}

/** Opties van één poll, oplopend op datum + tijd. */
export function pollOptions(
  poll: PlayPoll,
  options: PollOption[],
): PollOption[] {
  return options
    .filter((o) => o.poll_id === poll.id)
    .sort((a, b) =>
      a.date === b.date
        ? a.start_time.localeCompare(b.start_time)
        : a.date.localeCompare(b.date),
    );
}
