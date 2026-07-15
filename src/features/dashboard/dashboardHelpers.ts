import { headToHead } from "@/features/rating/results";
import { dateInZone } from "@/lib/utils/time";
import type { Match, Team } from "@/types";
import { type GroupSummary } from "@/features/groups/api";
import {
  getGroupPolls,
  getGroupPollOptions,
  getGroupPollVotes,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "@/features/groups/pollsApi";

/* Laatst bekende weergavenaam per gebruiker, zodat de begroeting bij een
   volgend bezoek meteen klopt (geen flits van het e-mailadres). */
export function cachedName(userId: string): string | null {
  try {
    return localStorage.getItem(`display-name:${userId}`);
  } catch {
    return null;
  }
}

export function rememberName(userId: string, name: string) {
  try {
    localStorage.setItem(`display-name:${userId}`, name);
  } catch {
    /* opslag niet beschikbaar (privémodus) — geen probleem */
  }
}

/** Korte "wanneer"-regel voor de compacte volgende-match op het overzicht:
 *  datum + tijd als die gepland is, anders de ronde; met de groepsnaam erbij. */
export function matchWhen(m: Match, groupName?: string | null): string {
  const parts: string[] = [];
  if (m.played_at) {
    const d = new Date(m.played_at);
    const dag = new Intl.DateTimeFormat("nl-BE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(d);
    const tijd = new Intl.DateTimeFormat("nl-BE", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    parts.push(`${dag} · ${tijd}`);
  } else if (m.round_number != null) {
    parts.push(`ronde ${m.round_number} · gepland`);
  } else {
    parts.push("gepland");
  }
  if (groupName) parts.push(groupName);
  return parts.join(" · ");
}

/** Aanwezigheid van vandaag per eigen groep, parallel opgehaald. */
export async function loadOpenPolls(
  groups: GroupSummary[],
): Promise<
  { group: GroupSummary; polls: PlayPoll[]; options: PollOption[]; votes: PollVote[] }[]
> {
  if (groups.length === 0) return [];
  return Promise.all(
    groups.map(async (group) => {
      const [polls, options, votes] = await Promise.all([
        getGroupPolls(group.id),
        getGroupPollOptions(group.id),
        getGroupPollVotes(group.id),
      ]);
      return { group, polls, options, votes };
    }),
  );
}

export type PollPick =
  | {
      kind: "open";
      group: GroupSummary;
      optionCount: number;
      voterCount: number;
      iVoted: boolean;
    }
  | {
      kind: "fixed";
      group: GroupSummary;
      booked: boolean;
      date: string;
      startTime: string;
    };

/** "2026-07-10" → "vr 10 jul"; middag-truc tegen DST-kanteling. */
export function pollDay(date: string): string {
  return new Intl.DateTimeFormat("nl-BE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));
}

/**
 * Wat het overzicht over speeldagen moet melden: een lopende (open) poll om
 * op te stemmen, of anders een vastgelegd/geboekt moment als reminder.
 */
export function pickPollBanner(
  rows: {
    group: GroupSummary;
    polls: PlayPoll[];
    options: PollOption[];
    votes: PollVote[];
  }[],
  myId: string,
  today: string,
): PollPick | null {
  for (const { group, polls, options, votes } of rows) {
    const open = polls.find((p) => p.status === "open");
    if (open) {
      const optionIds = new Set(
        options.filter((o) => o.poll_id === open.id).map((o) => o.id),
      );
      const pollVotes = votes.filter((v) => optionIds.has(v.option_id));
      return {
        kind: "open",
        group,
        optionCount: optionIds.size,
        voterCount: new Set(pollVotes.map((v) => v.player_id)).size,
        iVoted: pollVotes.some((v) => v.player_id === myId),
      };
    }
    const fixed = polls.find(
      (p) =>
        (p.status === "locked" || p.status === "booked") && p.locked_option_id,
    );
    if (fixed) {
      const opt = options.find((o) => o.id === fixed.locked_option_id);
      if (opt && opt.date >= today) {
        return {
          kind: "fixed",
          group,
          booked: fixed.status === "booked",
          date: opt.date,
          startTime: opt.start_time,
        };
      }
    }
  }
  return null;
}

export type RivalRec = { won: number; drawn: number; lost: number; played: number };

/** Tegenstander met de meeste onderlinge duels (min. 3), of null. */
export function pickRival(
  matches: Match[],
  teams: Record<string, Team>,
  myId: string,
): { oppId: string; rec: RivalRec } | null {
  let best: { oppId: string; rec: RivalRec } | null = null;
  for (const [oppId, rec] of headToHead(matches, teams, myId)) {
    if (rec.played < 3) continue;
    if (!best || rec.played > best.rec.played) best = { oppId, rec };
  }
  return best;
}

export function rivalVerdict(rec: RivalRec): "lead" | "trail" | "even" {
  if (rec.won > rec.lost) return "lead";
  if (rec.won < rec.lost) return "trail";
  return "even";
}

export function rivalVerdictLabel(rec: RivalRec): string {
  const v = rivalVerdict(rec);
  return v === "lead" ? "jij domineert" : v === "trail" ? "heeft jou liggen" : "onbeslist 🥊";
}

/** Uitslagen van de laatste speeldag als die vandaag of gisteren was. */
export function deriveEvening(
  completed: Match[],
  timezone: string,
): { groupId: string; count: number; isToday: boolean; day: string } | null {
  const withGroup = completed.filter((m) => m.group_id);
  if (withGroup.length === 0) return null;
  const day = (m: Match) => (m.played_at ?? m.created_at).slice(0, 10);
  const latest = withGroup.map(day).sort().at(-1)!;
  const todayStr = dateInZone(timezone);
  const yesterdayStr = dateInZone(timezone, -1);
  if (latest !== todayStr && latest !== yesterdayStr) return null;

  const dayMatches = withGroup.filter((m) => day(m) === latest);
  const perGroup = new Map<string, number>();
  for (const m of dayMatches) {
    perGroup.set(m.group_id!, (perGroup.get(m.group_id!) ?? 0) + 1);
  }
  const [groupId, count] = [...perGroup.entries()].sort((a, b) => b[1] - a[1])[0];
  return { groupId, count, isToday: latest === todayStr, day: latest };
}
