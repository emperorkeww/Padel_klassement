// Deelbare samenvatting van de baanbeschikbaarheid: per starttijd welke banen
// vrij zijn (dag) en een regel per dag (week). Puur en testbaar; de UI in
// ShareAvailability.tsx voedt hiermee zowel de deeltekst als de poster.
//
// Zelfde filter-semantiek als nextFreeSlot/bestWeekMoment in api.ts: het
// duurfilter geldt, en vandaag (nowMinutes ≠ null) tellen alleen starttijden
// ná nu — een start ≤ nu is voorbij.

import {
  dateInZone,
  fromMinutes,
  minutesNowInZone,
  toMinutes,
} from "../../lib/time";
import type { DayAvailability, WeekDay } from "./api";

/** Eén boekbare starttijd met de banen die dan vrij zijn (rastervolgorde). */
export interface FreeStart {
  time: string;
  /** Volledige baannamen die vrij zijn, in rastervolgorde. */
  courts: string[];
  /** Beschikbare speelduren (minuten) op dit uur, oplopend. */
  durations: number[];
}

/**
 * Alle boekbare starttijden van een dag met de vrije banen én de mogelijke
 * speelduren erbij, oplopend op tijd. Respecteert het duurfilter en de
 * "voorbij"-grens (nowMinutes).
 */
export function freeStartTimes(
  data: DayAvailability,
  duration: number | null,
  nowMinutes: number | null,
): FreeStart[] {
  const cutoff = nowMinutes ?? -1;
  const byTime = new Map<number, { courts: string[]; durs: Set<number> }>();
  for (const row of data.courts) {
    for (const [t, options] of row.free) {
      const m = toMinutes(t);
      if (m <= cutoff) continue;
      if (duration != null && !options.some((o) => o.duration === duration)) continue;
      const entry = byTime.get(m) ?? { courts: [], durs: new Set<number>() };
      entry.courts.push(row.court.name);
      for (const o of options) entry.durs.add(o.duration);
      byTime.set(m, entry);
    }
  }
  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, e]) => ({
      time: fromMinutes(m),
      courts: e.courts,
      durations: [...e.durs].sort((a, b) => a - b),
    }));
}

/** "Terrein 1" → "T1" (compacte weergave in de weektekst). */
export function shortCourtName(name: string): string {
  const num = name.match(/\d+/);
  return num ? `T${num[0]}` : name.slice(0, 3);
}

/** Vrije starttijden van één weekdag, met de eigen "vanaf nu"-grens in clubtijd. */
export function dayStarts(day: WeekDay, duration: number | null): FreeStart[] {
  if (!day.data) return [];
  const isToday = day.date === dateInZone(day.data.timeZone);
  const cutoff = isToday ? minutesNowInZone(day.data.timeZone) : null;
  return freeStartTimes(day.data, duration, cutoff);
}

/** Eén dag in de weekheatmap: per starttijd het aantal tegelijk vrije banen. */
export interface HeatDay {
  date: string;
  /** "HH:MM" → aantal vrije banen (alleen tijden met minstens één vrije baan). */
  counts: Record<string, number>;
  error: string | null;
}

/** Week als heatmap: een gedeelde tijd-as + per dag de baanaantallen per tijd. */
export interface WeekHeatmap {
  /** Alle starttijden waarop érgens in de week minstens één baan vrij is,
   *  oplopend gesorteerd. Vormt de rijen van het raster. */
  times: string[];
  days: HeatDay[];
}

/**
 * Bouwt de weekheatmap: per dag (met de eigen "vanaf nu"-grens in clubtijd) het
 * aantal vrije banen per boekbare starttijd. Rijen zonder enige vrije baan in de
 * hele week vallen weg, zodat het raster compact en relevant blijft.
 */
export function weekHeatmap(
  week: WeekDay[],
  duration: number | null,
): WeekHeatmap {
  const timeSet = new Set<number>();
  const days: HeatDay[] = week.map((day) => {
    if (!day.data) return { date: day.date, counts: {}, error: day.error };
    const counts: Record<string, number> = {};
    for (const s of dayStarts(day, duration)) {
      counts[s.time] = s.courts.length;
      timeSet.add(toMinutes(s.time));
    }
    return { date: day.date, counts, error: null };
  });
  const times = [...timeSet].sort((a, b) => a - b).map(fromMinutes);
  return { times, days };
}

/** Eén moment in de week (dag + uur) met een aantal tegelijk vrije banen. */
export interface HeatMoment {
  date: string;
  time: string;
  count: number;
}

/** Een aaneengesloten vrij tijdsblok binnen één dag (opeenvolgende halfuren). */
export interface FreeBlock {
  /** Vroegste vrije starttijd van het blok ("HH:MM"). */
  start: string;
  /** Laatste vrije starttijd van het blok ("HH:MM"); gelijk aan start bij één slot. */
  end: string;
  /** Minste en meeste tegelijk vrije banen binnen het blok. */
  min: number;
  max: number;
}

/**
 * Voegt de vrije starttijden van een dag samen tot aaneengesloten blokken: een
 * reeks halfuren die telkens 30 min na elkaar liggen wordt één blok. Zo toon je
 * "18:00–21:30 · 2–4 banen" i.p.v. een lange lijst losse tijden.
 */
export function freeBlocks(counts: Record<string, number>): FreeBlock[] {
  const times = Object.keys(counts).sort();
  const blocks: FreeBlock[] = [];
  for (const t of times) {
    const n = counts[t];
    const prev = blocks[blocks.length - 1];
    if (prev && toMinutes(t) - toMinutes(prev.end) === 30) {
      prev.end = t;
      prev.min = Math.min(prev.min, n);
      prev.max = Math.max(prev.max, n);
    } else {
      blocks.push({ start: t, end: t, min: n, max: n });
    }
  }
  return blocks;
}

/** Het moment in de week met de meeste tegelijk vrije banen (of null). */
export function bestHeatMoment(heat: WeekHeatmap): HeatMoment | null {
  let best: HeatMoment | null = null;
  for (const day of heat.days) {
    for (const [time, count] of Object.entries(day.counts)) {
      if (!best || count > best.count) best = { date: day.date, time, count };
    }
  }
  return best;
}

// 's Middags formatteren, zodat een DST-omschakeling de datum niet kantelt
// (zelfde truc als slotShareText/formatBestDay).
function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(
    new Date(`${date}T12:00:00`),
  );
}
const longDay = (date: string) =>
  fmtDate(date, { weekday: "long", day: "numeric", month: "long" });
const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

/** Links die in de deeltekst mee reizen. */
export interface ShareLinks {
  clubName: string;
  bookingUrl: string;
  viewUrl: string;
}

/** Zoveel starttijden tonen we maximaal in de deeltekst; de rest vatten we
 *  samen als "+ N meer tijden". */
export const DAY_TEXT_CAP = 16;

/**
 * Deeltekst voor één dag: per starttijd de vrije banen, plus de reserveer- en
 * "Bekijk"-links. `nowMinutes` ≠ null betekent "vandaag" (toont "vanaf nu").
 */
export function dayShareText(
  data: DayAvailability,
  date: string,
  duration: number | null,
  nowMinutes: number | null,
  links: ShareLinks,
): string {
  const isToday = nowMinutes != null;
  const starts = freeStartTimes(data, duration, nowMinutes);

  const sub = [longDay(date)];
  if (isToday) sub.push("vanaf nu");
  if (duration != null) sub.push(`${duration} min`);

  const lines = [
    `🎾 Baanbeschikbaarheid — ${links.clubName}`,
    `📅 ${sub.join(" · ")}`,
    "",
  ];
  if (starts.length === 0) {
    lines.push(isToday ? "Vandaag niets meer vrij." : "Geen vrije banen op deze dag.");
  } else {
    for (const s of starts.slice(0, DAY_TEXT_CAP)) {
      lines.push(
        `${s.time}  ${s.courts.join(", ")} · ${s.durations.join("/")} min`,
      );
    }
    if (starts.length > DAY_TEXT_CAP) {
      lines.push(`+ ${starts.length - DAY_TEXT_CAP} meer tijden`);
    }
  }
  lines.push("", `Reserveren: ${links.bookingUrl}`, `Bekijk: ${links.viewUrl}`);
  return lines.join("\n");
}

/** Zoveel vrije momenten tonen we maximaal per dag in de weektekst. */
export const WEEK_DAY_SLOT_CAP = 10;

/**
 * Deeltekst voor de week: per dag elke vrije starttijd met de vrije banen
 * (compacte namen) én de speelduren, plus het drukste moment en de "Bekijk"-link.
 * Zo heeft de groep genoeg detail om concreet een dag én uur te kiezen.
 */
export function weekShareText(
  week: WeekDay[],
  duration: number | null,
  links: Pick<ShareLinks, "clubName" | "viewUrl">,
): string {
  const range =
    week.length > 0
      ? `${shortDay(week[0].date)} – ${shortDay(week[week.length - 1].date)}`
      : "";
  const sub = [range];
  if (duration != null) sub.push(`${duration} min`);

  const lines = [`🎾 Weekoverzicht — ${links.clubName}`, `📅 ${sub.join(" · ")}`, ""];
  for (const day of week) {
    const label = shortDay(day.date);
    if (!day.data) {
      lines.push(`${label} — geen gegevens`);
      continue;
    }
    const starts = dayStarts(day, duration);
    if (starts.length === 0) {
      lines.push(`${label} — niets vrij`);
      continue;
    }
    const woord = starts.length === 1 ? "moment" : "momenten";
    lines.push(`${label} — ${starts.length} ${woord} vrij`);
    for (const s of starts.slice(0, WEEK_DAY_SLOT_CAP)) {
      const namen = s.courts.map(shortCourtName).join(", ");
      lines.push(`  ${s.time}  ${namen} · ${s.durations.join("/")} min`);
    }
    if (starts.length > WEEK_DAY_SLOT_CAP) {
      lines.push(`  +${starts.length - WEEK_DAY_SLOT_CAP} latere tijden`);
    }
  }

  const best = bestHeatMoment(weekHeatmap(week, duration));
  if (best) {
    lines.push(
      "",
      `💡 Meeste banen tegelijk: ${shortDay(best.date)} om ${best.time} (${best.count} banen)`,
    );
  }
  lines.push(
    "",
    "Tn = terrein n · getallen na · = mogelijke speelduren (min)",
    `Bekijk: ${links.viewUrl}`,
  );
  return lines.join("\n");
}
