import { headToHead } from "@/features/rating/results";
import { dateInZone } from "@/lib/utils/time";
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

/** Statussen die de dashboard-hero een eigen skin geven (#613/#644). */
export type HeroThema = "dictator" | "bigdaddy" | "pias" | "piet" | null;

/** Prioriteit: het eerste thema dat de speler draagt wint. Bewust dezelfde
 *  volgorde als EDITIE_PRIORITEIT op de FUT-kaart (edities.ts) — verdienste
 *  verdringt schande, en binnen de schande wint de weeklens (de pias van déze
 *  week) van het rondgaande token (de Piet), net als inform › onfire daar.
 *
 *  De twee assen zijn onafhankelijk: dictator/Big Daddy komen uit het
 *  club-klassement, pias/Piet uit een groep. Je kunt dus tegelijk #1 én
 *  schande-token-drager zijn; dan kleurt de hero naar de eer en blijft de
 *  schande-crest ernaast staan. Kleur is nooit de enige indicator (#613), dus
 *  het verliezende thema verdwijnt alleen als vlak, niet als chip.
 *
 *  Dictator staat vóór Big Daddy zoals de hero dat al deed sinds #613 (en
 *  Podium.tsx op het klassement): in de praktijk sluiten ze elkaar al uit —
 *  een bezette troon dooft de kroon — maar de volgorde legt vast wat er zou
 *  gebeuren als dat ooit verandert. Op de FUT-kaart draagt de dictator juist
 *  géén editie (troonkaart); hier is de hero zélf zijn troonvlak. */
export const HERO_THEMA_PRIORITEIT = [
  "dictator",
  "bigdaddy",
  "pias",
  "piet",
] as const;

/** Welk thema draagt de hero? `schild` is het roast-schild (#183) van de
 *  speler zelf: dat dooft de twee schande-thema's volledig — de hero valt terug
 *  op neutraal, precies zoals de FUT-kaart bij een schild z'n mond houdt. De
 *  crest-chip blijft wél staan (met de neutrale 📊-variant, zie Dashboard.tsx):
 *  het feit blijft, de spot verdwijnt. Halfslachtig dempen — kartonnen vlak met
 *  een neutraal woordje erop — zou geen schild zijn maar een zachtere sneer.
 *  Op eer heeft het schild geen invloed: er valt niets te beschermen. */
export function heroThema(s: {
  dictator: boolean;
  bigDaddy: boolean;
  pias: boolean;
  piet: boolean;
  schild: boolean;
}): HeroThema {
  for (const thema of HERO_THEMA_PRIORITEIT) {
    switch (thema) {
      case "dictator":
        if (s.dictator) return "dictator";
        break;
      case "bigdaddy":
        if (s.bigDaddy) return "bigdaddy";
        break;
      case "pias":
        if (s.pias && !s.schild) return "pias";
        break;
      case "piet":
        if (s.piet && !s.schild) return "piet";
        break;
    }
  }
  return null;
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
): Promise<
  { group: GroupSummary; polls: PlayPoll[]; options: PollOption[]; votes: PollVote[] }[]
> {
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
export function pickPollBanner(
  rows: {
    group: GroupSummary;
    polls: PlayPoll[];
    options: PollOption[];
    votes: PollVote[];
  }[],
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
