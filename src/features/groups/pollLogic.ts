import { PLAYERS_PER_COURT } from "./planGrid";
import type {
  PlayPoll,
  PollOption,
  PollVote,
  PollVoteStatus,
} from "./pollsApi";

// Pure logica rond speeldag-polls: banen-behoefte, haalbaarheid per optie en
// welke poll de groepspagina toont. Getest in pollLogic.test.ts.

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
 * De poll die de groepspagina toont: een open of gelockte poll (nieuwste
 * eerst), anders een geboekte waarvan het gekozen moment nog moet komen.
 */
export function activePoll(
  polls: PlayPoll[],
  options: PollOption[],
  today: string,
): PlayPoll | null {
  const running = polls.find((p) => p.status === "open" || p.status === "locked");
  if (running) return running;
  return (
    polls.find((p) => {
      if (p.status !== "booked" || !p.locked_option_id) return false;
      const opt = options.find((o) => o.id === p.locked_option_id);
      return !!opt && opt.date >= today;
    }) ?? null
  );
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
