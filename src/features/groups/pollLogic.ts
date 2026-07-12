import type {
  NewPollOption,
  PlayPoll,
  PollOption,
  PollVote,
  PollVoteStatus,
} from "./pollsApi";

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

/**
 * Sorteersleutel van een poll: het eerstvolgende moment dat er nog toe doet.
 * Voor gelockte/geboekte polls het gekozen moment; anders het vroegste
 * kandidaat-moment dat nog niet voorbij is (valt terug op het vroegste moment).
 */
function pollMoment(
  poll: PlayPoll,
  options: PollOption[],
  today: string,
): string {
  const key = (o: PollOption) => `${o.date}|${o.start_time}`;
  if (poll.locked_option_id) {
    const locked = options.find((o) => o.id === poll.locked_option_id);
    if (locked) return key(locked);
  }
  const own = options
    .filter((o) => o.poll_id === poll.id)
    .sort((a, b) => key(a).localeCompare(key(b)));
  const upcoming = own.find((o) => o.date >= today);
  return key(upcoming ?? own[own.length - 1] ?? { date: "9999-12-31", start_time: "23:59" } as PollOption);
}

/**
 * De polls die de groepspagina toont: alle open of gelockte polls, plus
 * geboekte polls waarvan het gekozen moment nog moet komen (#267 — meerdere
 * speeldagen tegelijk). Gesorteerd op eerstvolgend moment (soonest-first).
 */
export function activePolls(
  polls: PlayPoll[],
  options: PollOption[],
  today: string,
): PlayPoll[] {
  return polls
    .filter((p) => {
      if (p.status === "open" || p.status === "locked") return true;
      if (p.status === "booked" && p.locked_option_id) {
        const opt = options.find((o) => o.id === p.locked_option_id);
        return !!opt && opt.date >= today;
      }
      return false;
    })
    .sort((a, b) =>
      pollMoment(a, options, today).localeCompare(pollMoment(b, options, today)),
    );
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
