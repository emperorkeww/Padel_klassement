/** NL-label bij een Playtomic-baantype, voor tooltips en rijkoppen. */
export function courtTypeLabel(type: string): string {
  if (type === "roofed") return "overdekt";
  if (type === "outdoor") return "buiten";
  return "";
}

/** Korte NL-datum, bv. "1 jul". Leeg bij ontbrekende datum. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

/** Klok-tijd, bv. "14:32". Leeg bij ontbrekende datum. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Aantal hele kalenderdagen tussen twee momenten (lokale tijd). */
function calendarDayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86_400_000);
}

/**
 * Datum leesbaar t.o.v. vandaag: "vandaag", "gisteren", "eergisteren" of een
 * korte datum. Sneller te lezen in een recente-lijst dan een kale datum.
 * `now` is injecteerbaar voor tests.
 */
export function formatRelativeDay(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const diff = calendarDayDiff(now, new Date(iso));
  if (diff === 0) return "vandaag";
  if (diff === 1) return "gisteren";
  if (diff === 2) return "eergisteren";
  return formatDate(iso);
}

/**
 * Vooruitkijkende variant voor geplande matches: "vandaag", "morgen",
 * "overmorgen" of een korte datum. `now` is injecteerbaar voor tests.
 */
export function formatPlannedDay(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const diff = calendarDayDiff(new Date(iso), now);
  if (diff === 0) return "vandaag";
  if (diff === 1) return "morgen";
  if (diff === 2) return "overmorgen";
  return formatDate(iso);
}

/** "12 spelers" / "1 speler" / "geen spelers" — de kern van een telmelding
 *  voor een screenreader (#924). */
export function aantalTekst(
  aantal: number,
  enkelvoud: string,
  meervoud: string,
): string {
  if (aantal === 0) return `geen ${meervoud}`;
  return `${aantal} ${aantal === 1 ? enkelvoud : meervoud}`;
}
