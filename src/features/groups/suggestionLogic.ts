import type { WeekHeatmap } from "@/features/availability/availabilityShare";

// Pure scoring voor de suggestiekaart: combineert vrije banen, "kan dan"-
// signalen uit poll-stemmen, de speelhistoriek van de groep en eerder
// succesvolle voorstellen tot een top-N van concrete momenten. Getest in
// suggestionLogic.test.ts.

/** Een moment in de groepshistoriek: weekdag (0=zo..6=za) + beginuur. */
export interface PlayedMoment {
  weekday: number;
  hour: number;
}

/**
 * "Kan dan"-signaal van een lid op een concreet moment. Komt uitsluitend uit
 * stemmen op poll-opties: die zijn zichtbaar en intrekbaar via de poll zelf.
 * (Voorheen telden ook stemmen uit het verwijderde slot-raster mee — spook-
 * signalen die niemand nog kon zien of beheren; zie issue #121.)
 */
export interface CanSignal {
  player_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // "HH:MM" clubtijd
  status: "yes" | "no" | "maybe";
}

export interface SuggestionSources {
  /** Vrije banen per halfuur voor de komende week. */
  heat: WeekHeatmap;
  /** Leden die aangaven te kunnen op een moment (uit poll-stemmen). */
  slotVotes: CanSignal[];
  /** Wanneer de groep eerder speelde (weekdag + uur, in clubtijd). */
  history: PlayedMoment[];
  /** Eerdere voorstellen die speelbaar raakten (datum + "HH:MM"). */
  pastPlayable: { date: string; start_time: string }[];
  /** Al voorgestelde komende momenten — niet opnieuw suggereren. */
  existing: { date: string; start_time: string }[];
}

export interface Suggestion {
  date: string;
  time: string;
  freeCourts: number;
  score: number;
  /** Korte uitleg waarom dit moment bovenaan staat ("3 banen vrij", …). */
  reasons: string[];
}

/** Weekdag (0=zo..6=za) van een YYYY-MM-DD; middag-truc tegen DST-kanteling. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

const hourOf = (time: string) => Number(time.slice(0, 2));

/** Voorkeur per dagdeel: avond > randen > overdag > vroege ochtend. */
export function timeOfDayPrior(hour: number): number {
  if (hour >= 18 && hour <= 21) return 2;
  if (hour === 17 || hour === 22) return 1;
  if (hour >= 12) return 0;
  return -2;
}

/** ISO-tijdstippen → speel-momenten (weekdag + uur) in de clubtijdzone. */
export function playedMoments(
  playedAtIsos: string[],
  timeZone: string,
): PlayedMoment[] {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const dayNum: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return playedAtIsos.map((iso) => {
    const parts = fmt.formatToParts(new Date(iso));
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    return { weekday: dayNum[wd] ?? 0, hour: hour === 24 ? 0 : hour };
  });
}

/**
 * Top-N momenten uit de komende week. Alleen slots met minstens één vrije
 * baan doen mee; per dag wint het beste slot (anders vullen drie halfuren
 * van dezelfde avond de hele lijst).
 */
export function suggestMoments(
  sources: SuggestionSources,
  topN = 3,
): Suggestion[] {
  const proposed = new Set(
    sources.existing.map((p) => `${p.date}|${p.start_time}`),
  );
  const playableAt = sources.pastPlayable.map((p) => ({
    weekday: weekdayOf(p.date),
    time: p.start_time,
  }));

  const all: Suggestion[] = [];
  for (const day of sources.heat.days) {
    const weekday = weekdayOf(day.date);
    for (const [time, freeCourts] of Object.entries(day.counts)) {
      if (freeCourts <= 0 || proposed.has(`${day.date}|${time}`)) continue;

      const reasons = [
        freeCourts === 1 ? "1 baan vrij" : `${freeCourts} banen vrij`,
      ];
      // Banen zijn een randvoorwaarde, geen doel: laag plafond zodat een
      // lege ochtend niet wint van een realistisch avonduur.
      let score = Math.min(freeCourts, 3);

      // Dagdeel-prior: zolang er weinig historiek is, sturen we naar de
      // uren waarop vriendengroepen realistisch spelen (avond).
      const hour = hourOf(time);
      score += timeOfDayPrior(hour);

      // Leden die aangaven te kunnen op dit moment (poll- of slot-stemmen).
      const votes = sources.slotVotes.filter(
        (v) => v.date === day.date && v.start_time === time,
      );
      const yes = votes.filter((v) => v.status === "yes").length;
      const maybe = votes.filter((v) => v.status === "maybe").length;
      score += yes * 2 + maybe;
      if (yes > 0) {
        reasons.push(yes === 1 ? "1 lid kan dan" : `${yes} leden kunnen dan`);
      }

      // Historiek weegt zwaar: hoe meer de groep speelt, hoe meer de
      // suggesties naar de eigen vaste uren toegroeien.
      const played = sources.history.filter(
        (h) => h.weekday === weekday && Math.abs(h.hour - hour) <= 1,
      ).length;
      score += Math.min(played * 2, 8);
      if (played > 0) {
        reasons.push(
          played === 1
            ? "jullie speelden hier al eens"
            : `jullie speelden hier al ${played} keer`,
        );
      }

      // Eerdere voorstellen op ditzelfde moment raakten vol.
      const succeeded = playableAt.filter(
        (p) => p.weekday === weekday && p.time === time,
      ).length;
      score += 2 * Math.min(succeeded, 2);
      if (succeeded > 0) reasons.push("eerder voorstel hier raakte vol");

      all.push({ date: day.date, time, freeCourts, score, reasons });
    }
  }

  // Beste slot per dag, dan de beste dagen bovenaan (gelijk → vroegste eerst).
  const bestPerDay = new Map<string, Suggestion>();
  for (const s of all) {
    const cur = bestPerDay.get(s.date);
    if (!cur || s.score > cur.score) bestPerDay.set(s.date, s);
  }
  return [...bestPerDay.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.date.localeCompare(b.date) ||
        a.time.localeCompare(b.time),
    )
    .slice(0, topN);
}
