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
export function calendarDayDiff(a: Date, b: Date): number {
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

/**
 * Hoe lang geleden, kort: "nu", "5 min geleden", "2 u geleden", "3 dagen
 * geleden", en vanaf een week een korte datum (#1090).
 *
 * Een meldingenlijst leest op tijdsafstand, niet op klokstand: "2 u geleden"
 * zegt wat "14:32" pas zegt nadat je zelf hebt nagerekend hoe laat het is. Voor
 * alles ouder dan een week draait dat om — dan is de datum juist concreter.
 *
 * Bewust geen Intl.RelativeTimeFormat: die maakt van 90 minuten "2 uur geleden"
 * (afgerond) of "90 minuten geleden" (niet afgerond), en de eenheidkeuze zou
 * hier alsnog met de hand moeten. `now` is injecteerbaar voor tests.
 */
export function formatRelatieveTijd(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const ms = now.getTime() - new Date(iso).getTime();
  // Een klok die een seconde voorloopt op de server mag geen "in 1 min" tonen.
  const minuten = Math.max(0, Math.floor(ms / 60_000));
  if (minuten < 1) return "nu";
  if (minuten < 60) return `${minuten} min geleden`;
  const uren = Math.floor(minuten / 60);
  if (uren < 24) return `${uren} u geleden`;
  const dagen = Math.floor(uren / 24);
  // Voluit (#1273): "dgn" was de enige afkorting van zijn soort in de app, en
  // hij staat in een kolom waar ruimte genoeg is.
  if (dagen < 7) return `${dagen} ${dagen === 1 ? "dag" : "dagen"} geleden`;
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
