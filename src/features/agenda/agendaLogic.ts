import { addDays, clubEpoch, fromMinutes, toMinutes } from "@/lib/utils/time";
import { longDay } from "@/features/groups/planPollHelpers";
import type {
  PlayPoll,
  PollOption,
  PollVoteStatus,
  PollWindow,
} from "@/features/groups/pollsApi";
import type { GroupSummary } from "@/features/groups/api";

/* ------------------------------------------------------------------ */
/* Agenda (#1091): van poll-rijen naar dagen in een maandraster.       */
/*                                                                     */
/* Alles hier is puur — geen React, geen supabase — zodat het raster,   */
/* de dag-sheet en de tests dezelfde afleiding delen.                   */
/* ------------------------------------------------------------------ */

/** Wat een dag draagt. De vorm (niet de kleur) van de glyph volgt hieruit. */
export type AgendaStatus = "booked" | "locked" | "open";

export type AgendaMarker = {
  pollId: string;
  optionId: string;
  groupId: string;
  groupName: string;
  clubName: string;
  clubTimezone: string;
  /** Kalenderdatum in clubtijd — precies zoals de kolom hem bewaart. */
  date: string;
  /** "HH:MM" in clubtijd. */
  startTime: string;
  duration: number;
  status: AgendaStatus;
  /** Slot al voorbij, gerekend in de tijdzone van díe club. */
  past: boolean;
  /** Stemde ik al op deze poll? Alleen zinvol bij een open poll. */
  iVoted: boolean;
  /** Mijn stem op dít moment; null als ik er niets over zei (#1104). Los van
   *  `iVoted`, dat over de hele poll gaat: op een poll met drie kandidaten kun
   *  je twee momenten beantwoord hebben en het derde niet. */
  myVote: PollVoteStatus | null;
  /** Aantal spelers dat op deze poll stemde (open-poll-hint). */
  voterCount: number;
  /** Spelers met "ik kan" op dít moment — de avatarstapel in het detail. */
  yesVoterIds: string[];
  /** Geboekte banen (#802) en toegangscode (#675); null zolang onbekend. */
  courts: string | null;
  accessCode: string | null;
  /** Laatste wijziging aan deze speeldag — voedt de SEQUENCE van de .ics
   *  (#1099), zodat een herimport het bestaande event bijwerkt. */
  changedAt: string;
};

/**
 * De kalenderdag van een speeldag komt uit `play_poll_options.date` en niet uit
 * een timestamp: die kolom bewaart de dag al in clubtijd, met `start_time` als
 * kloktijd van diezelfde club. Er valt hier dus niets te converteren — een
 * `dayInZone` over `created_at` zou juist een fout introduceren.
 *
 * Waar de tijdzone wél telt is "is dit al geweest?": dat is een vergelijking
 * met nu, en die moet per poll in de zone van díe club (#783). Vandaar
 * `clubEpoch` met `poll.club_timezone` hieronder.
 */
function isPast(option: PollOption, timeZone: string, nowMs: number): boolean {
  return (
    clubEpoch(option.date, option.start_time, timeZone) +
      option.duration * 60_000 <
    nowMs
  );
}

/**
 * Dezelfde vraag, maar voor een marker die al gebouwd is (#1104). `past` is
 * bevroren op het moment dat het venster geladen werd, en een dag-sheet kan
 * lang openstaan — over dat ene moment heen dat er nog te stemmen viel. Wie
 * stemknoppen toont, moet de vraag opnieuw stellen in plaats van `past` te
 * geloven.
 */
export function momentVoorbij(m: AgendaMarker, nowMs: number): boolean {
  return (
    clubEpoch(m.date, m.startTime, m.clubTimezone) + m.duration * 60_000 < nowMs
  );
}

/**
 * Markers van één venster.
 *
 * Vastgelegde en geboekte speeldagen leveren precies hun gekozen moment; een
 * open poll levert al zijn kandidaat-momenten, want dat is wat er te zien valt:
 * een vraag met meerdere antwoorden. Geannuleerde polls vallen weg.
 *
 * Een verlopen kandidaat-moment van een open poll valt óók weg: dat is een
 * vraag waar nooit iets van kwam, en op een kalender is dat ruis. Een geboekte
 * of vastgelegde dag in het verleden blijft juist staan — daar is gepadeld.
 *
 * Bewust géén `pollExpired`-filter: dat kijkt naar álle momenten van een poll,
 * en een venster bevat er soms maar een deel (een poll rond een maandgrens).
 * De vraag "is dit moment geweest?" is per moment te beantwoorden en heeft dat
 * probleem niet.
 */
export function buildMarkers(
  window: PollWindow,
  groups: GroupSummary[],
  myId: string,
  nowMs: number,
): AgendaMarker[] {
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const pollById = new Map<string, PlayPoll>(
    window.polls.map((p) => [p.id, p]),
  );

  // Stemmen per moment, per poll wie er stemde, en mijn eigen stem per moment:
  // één doorloop i.p.v. een filter per marker (een maandvenster kan honderden
  // stemmen dragen).
  const yesByOption = new Map<string, string[]>();
  const votersByPoll = new Map<string, Set<string>>();
  const mineByOption = new Map<string, PollVoteStatus>();
  const optionPoll = new Map(window.options.map((o) => [o.id, o.poll_id]));
  for (const vote of window.votes) {
    if (vote.status === "yes") {
      const list = yesByOption.get(vote.option_id);
      if (list) list.push(vote.player_id);
      else yesByOption.set(vote.option_id, [vote.player_id]);
    }
    if (vote.player_id === myId) mineByOption.set(vote.option_id, vote.status);
    const pollId = optionPoll.get(vote.option_id);
    if (pollId == null) continue;
    const voters = votersByPoll.get(pollId);
    if (voters) voters.add(vote.player_id);
    else votersByPoll.set(pollId, new Set([vote.player_id]));
  }

  const markers: AgendaMarker[] = [];
  for (const option of window.options) {
    const poll = pollById.get(option.poll_id);
    if (!poll || poll.status === "cancelled") continue;

    const vastgelegd = poll.status === "booked" || poll.status === "locked";
    // Bij een vastgelegde poll telt alleen het gekozen moment; de afgevallen
    // kandidaten zijn geen speeldag meer.
    if (vastgelegd && poll.locked_option_id !== option.id) continue;

    const past = isPast(option, poll.club_timezone, nowMs);
    if (!vastgelegd && past) continue;

    const voters = votersByPoll.get(poll.id);
    markers.push({
      pollId: poll.id,
      optionId: option.id,
      groupId: poll.group_id,
      groupName: groupName.get(poll.group_id) ?? "Groep",
      clubName: poll.club_name,
      clubTimezone: poll.club_timezone,
      date: option.date,
      startTime: option.start_time,
      duration: option.duration,
      status: vastgelegd ? (poll.status as AgendaStatus) : "open",
      past,
      iVoted: voters?.has(myId) ?? false,
      myVote: mineByOption.get(option.id) ?? null,
      voterCount: voters?.size ?? 0,
      yesVoterIds: yesByOption.get(option.id) ?? [],
      courts: poll.courts,
      accessCode: poll.access_code,
      // Boeken is de laatste stap, vastleggen de stap ervoor; zonder beide is
      // de poll sinds het aanmaken niet meer van fase veranderd.
      changedAt: poll.booked_at ?? poll.locked_at ?? poll.created_at,
    });
  }
  return markers;
}

/** Volgorde binnen een dag: op tijd, dan op groep — stabiel tussen renders. */
function byTime(a: AgendaMarker, b: AgendaMarker): number {
  return (
    a.startTime.localeCompare(b.startTime) || a.groupName.localeCompare(b.groupName)
  );
}

/** Markers per kalenderdag, elke dag op tijd gesorteerd. */
export function markersByDay(
  markers: AgendaMarker[],
): Record<string, AgendaMarker[]> {
  const out: Record<string, AgendaMarker[]> = {};
  for (const m of markers) (out[m.date] ??= []).push(m);
  for (const day of Object.values(out)) day.sort(byTime);
  return out;
}

/* ------------------------------------------------------------------ */
/* Het raster zelf.                                                    */
/* ------------------------------------------------------------------ */

/** Actief maandvenster; `maand` is 1-12, niet de 0-gebaseerde JS-maand. */
export type Maand = { jaar: number; maand: number };

export type RasterDag = { date: string; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");

/** Weekdag als index met maandag = 0. */
function weekdayIndex(date: string): number {
  // 's Middags, zodat een DST-omschakeling de dag niet kantelt (repo-conventie).
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
}

/** Aantal dagen in een maand (1-12). */
export function daysInMonth({ jaar, maand }: Maand): number {
  // Dag 0 van de vólgende maand = laatste dag van deze; in UTC zodat de
  // browserzone er niet tussen komt.
  return new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
}

/**
 * Het maandraster: hele weken van maandag t/m zondag, met de rand-dagen van de
 * vorige en volgende maand erbij. Vijf of zes rijen, afhankelijk van de maand.
 */
export function monthGrid(m: Maand): RasterDag[][] {
  const first = `${m.jaar}-${pad(m.maand)}-01`;
  const last = `${m.jaar}-${pad(m.maand)}-${pad(daysInMonth(m))}`;
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));

  const weeks: RasterDag[][] = [];
  let cursor = start;
  while (cursor <= end) {
    const week: RasterDag[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cursor, inMonth: cursor >= first && cursor <= last });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Het datumvenster dat het raster nodig heeft — inclusief de rand-dagen, want
 * die tonen hun markers gewoon mee. Dit is wat `getPollWindow` opvraagt.
 */
export function windowFor(m: Maand): { from: string; to: string } {
  const weeks = monthGrid(m);
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date };
}

/** De maand waarin een datum valt. */
export function maandVan(date: string): Maand {
  return { jaar: Number(date.slice(0, 4)), maand: Number(date.slice(5, 7)) };
}

/** Maand vooruit/achteruit, met jaarwissel. */
export function schuifMaand({ jaar, maand }: Maand, delta: number): Maand {
  const totaal = jaar * 12 + (maand - 1) + delta;
  return { jaar: Math.floor(totaal / 12), maand: (totaal % 12) + 1 };
}

export const zelfdeMaand = (a: Maand, b: Maand) =>
  a.jaar === b.jaar && a.maand === b.maand;

/** "augustus 2026" — de kop boven het raster. */
export function maandLabel({ jaar, maand }: Maand): string {
  return new Intl.DateTimeFormat("nl-BE", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${jaar}-${pad(maand)}-01T12:00:00`));
}

/** De week (ma t/m zo) waarin een datum valt — voedt de weekstrook. */
export function weekVan(date: string): string[] {
  const start = addDays(date, -weekdayIndex(date));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Zelfde dagnummer een maand verder of terug; een kortere maand kapt af
 *  (31 maart → PageDown → 30 april). */
export function zelfdeDagAndereMaand(date: string, delta: number): string {
  const m = schuifMaand(maandVan(date), delta);
  const dag = Math.min(Number(date.slice(8)), daysInMonth(m));
  return `${m.jaar}-${pad(m.maand)}-${pad(dag)}`;
}

/**
 * Toetsenbordnavigatie door het raster: links/rechts ±1 dag, boven/onder ±1
 * week, Home/End naar de rand van de week, PageUp/PageDown een maand. Geeft
 * null voor een toets die het raster niet kent, zodat de aanroeper hem gewoon
 * doorlaat.
 */
export function toetsStap(date: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(date, -1);
    case "ArrowRight":
      return addDays(date, 1);
    case "ArrowUp":
      return addDays(date, -7);
    case "ArrowDown":
      return addDays(date, 7);
    case "Home":
      return addDays(date, -weekdayIndex(date));
    case "End":
      return addDays(date, 6 - weekdayIndex(date));
    case "PageUp":
      return zelfdeDagAndereMaand(date, -1);
    case "PageDown":
      return zelfdeDagAndereMaand(date, 1);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/* Labels.                                                             */
/* ------------------------------------------------------------------ */

const STATUS_WOORD: Record<AgendaStatus, string> = {
  booked: "geboekt",
  locked: "vastgelegd, nog te boeken",
  open: "open poll",
};

/** "20:00 — 21:30": het tijdvak van een moment. Een slot dat over middernacht
 *  loopt telt gewoon door naar de kleine uurtjes. */
export function tijdvak(startTime: string, duration: number): string {
  return `${startTime} — ${fromMinutes((toMinutes(startTime) + duration) % 1440)}`;
}

/** Het statuswoord zoals het in badges en legenda staat. */
export function statusLabel(status: AgendaStatus, past = false): string {
  if (past) return "gespeeld";
  return status === "locked" ? "vastgelegd" : STATUS_WOORD[status];
}

/**
 * De toegankelijke naam van een dagknop. Het raster is een raster: elke dag
 * vertelt zelf wat erop staat, inclusief de status in woorden — de glyph-vorm
 * alleen is geen naam (WCAG 1.4.1 én 4.1.2).
 */
export function dagLabel(
  date: string,
  markers: AgendaMarker[],
  /** Een dag die geweest is nodigt niet uit om te plannen (#1091). */
  verleden = false,
): string {
  const dag = longDay(date);
  if (markers.length === 0) {
    return verleden
      ? `${dag}, niets gespeeld`
      : `${dag}, niets gepland, plan een speeldag`;
  }
  // Bij een open poll hoort de stemstand erbij: de brede cel zegt "stem" of
  // "jij ✓" (markerHint), en een naam die dat verzwijgt spreekt de cel tegen.
  const beschrijf = (m: AgendaMarker) =>
    `speeldag ${statusLabel(m.status, m.past)} om ${m.startTime}, ${m.groupName}, ${m.clubName}` +
    (m.status === "open" && !m.past
      ? m.myVote
        ? ", jij stemde al"
        : ", jij stemde nog niet"
      : "");
  if (markers.length === 1) return `${dag}, ${beschrijf(markers[0])}`;
  return `${dag}, ${markers.length} speeldagen: ${markers.map(beschrijf).join("; ")}`;
}

/** Wat een cel toont en wat er onder "+N" verdwijnt. De "+N" is een regel van
 *  9px onder de markers, geen marker-plek — vandaar het kale afkappen. */
export function splitMarkers(
  markers: AgendaMarker[],
  max: number,
): { shown: AgendaMarker[]; extra: number } {
  if (markers.length <= max) return { shown: markers, extra: 0 };
  return { shown: markers.slice(0, max), extra: markers.length - max };
}
