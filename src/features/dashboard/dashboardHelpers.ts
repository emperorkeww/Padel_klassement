import { headToHead } from "@/features/rating/results";
import { dateInZone, dayInZone } from "@/lib/utils/time";
import type { Match, Team } from "@/types";
import { type GroupSummary } from "@/features/groups/api";
import {
  getPollsForGroups,
  getPollOptionsForGroups,
  getPollVotesForGroups,
  type PlayPoll,
  type PollOption,
  type PollVote,
} from "@/features/groups/pollsApi";
import { pollExpired } from "@/features/groups/pollLogic";

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

/* ----------------------------- Hero-thema -------------------------------- */

/* De thema-keuze van de dashboard player card staat sinds #771 in heroThema.ts:
   permanent materiaal en tijdelijke overlay zijn daar twee assen i.p.v. één
   ladder. Alleen heroCrestTekst bleef hier staan, want dat is tekstopmaak voor
   de crest-chips en geen thema-keuze. */

/** Splitst een editie-regel van de FUT-kaart ("⚡ In-Form · +48") in het icoon
 *  en de rest, zodat de HeroCrest hem in zíjn vorm kan zetten — chip met een
 *  aria-hidden emoji plus een labeltekst — zonder dat er een tweede formulering
 *  van dezelfde titel ontstaat (#760). editieLabel (edities.ts) blijft dus de
 *  enige plek waar de tekst staat; de hero hangt er alleen zijn eigen jasje om.
 *
 *  Splitst op de eerste ruimte: élke editie-regel begint met precies één
 *  emoji-token. Zonder ruimte (defensief) is de hele regel het icoon én het
 *  label, zodat er nooit een lege chip verschijnt. */
export function heroCrestTekst(regel: string): { emoji: string; label: string } {
  const knip = regel.indexOf(" ");
  if (knip < 0) return { emoji: regel, label: regel };
  return { emoji: regel.slice(0, knip), label: regel.slice(knip + 1) };
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

/** Aanwezigheid van vandaag per eigen groep.
 *
 *  Drie queries in totaal, niet drie per groep (#736): dit draait bij elke
 *  dashboard-mount, en met vier groepen waren dat twaalf requests voor data die
 *  in één `in(group_id, …)` past. */
export async function loadOpenPolls(
  groups: GroupSummary[],
): Promise<OpenPollBundle[]> {
  if (groups.length === 0) return [];
  const ids = groups.map((g) => g.id);
  const [polls, options, votes] = await Promise.all([
    getPollsForGroups(ids),
    getPollOptionsForGroups(ids),
    getPollVotesForGroups(ids),
  ]);
  return groups.map((group) => ({
    group,
    polls: polls[group.id] ?? [],
    options: options[group.id] ?? [],
    votes: votes[group.id] ?? [],
  }));
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
      /** Toegangscode van de velden (#675), maar alléén op de speeldag zelf —
       *  daarbuiten is het ruis op een overzichtsscherm. Null zonder code,
       *  vóór de dag, of als de baan nog niet geboekt is. */
      accessCode: string | null;
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
/** Eén groep met zijn polls, opties en stemmen — wat loadOpenPolls teruggeeft. */
export type OpenPollBundle = {
  group: GroupSummary;
  polls: PlayPoll[];
  options: PollOption[];
  votes: PollVote[];
};

export function pickPollBanner(
  rows: OpenPollBundle[],
  myId: string,
  nowMs: number,
): PollPick | null {
  for (const { group, polls, options, votes } of rows) {
    const open = polls.find(
      (p) => p.status === "open" && !pollExpired(p, options, nowMs),
    );
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
      if (opt && !pollExpired(fixed, options, nowMs)) {
        // Alleen wie zich als "kan" (yes) zette op de vastgelegde optie speelt
        // mee — anderen krijgen geen "Jullie spelen…"-reminder.
        const iCan = votes.some(
          (v) =>
            v.option_id === fixed.locked_option_id &&
            v.player_id === myId &&
            v.status === "yes",
        );
        if (!iCan) continue;
        const isVandaag =
          opt.date === dateInZone(fixed.club_timezone, 0, nowMs);
        return {
          kind: "fixed",
          group,
          booked: fixed.status === "booked",
          date: opt.date,
          startTime: opt.start_time,
          accessCode:
            fixed.status === "booked" && isVandaag ? fixed.access_code : null,
        };
      }
    }
  }
  return null;
}

export type RivalRec = { won: number; drawn: number; lost: number; played: number };

/** Tegenstander met de meeste onderlinge duels (min. 3), of null. */
/** De vaste tegenstander plus de onderlinge balans. */
export type Rival = { oppId: string; rec: RivalRec };

export function pickRival(
  matches: Match[],
  teams: Record<string, Team>,
  myId: string,
): Rival | null {
  let best: Rival | null = null;
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
  const day = (m: Match) => dayInZone(m.played_at ?? m.created_at, timezone);
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
