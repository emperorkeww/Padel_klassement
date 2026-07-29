// Kalenderrekenen in clubtijd voor de Edge Functions. Deno en src/ kunnen niet
// uit elkaars boom importeren; dit is de tegenhanger van src/lib/utils/time.ts.

/** Kalenderdag (YYYY-MM-DD) van een ISO-timestamp in de opgegeven tijdzone.
 *  Spiegel van dayInZone in src/lib/utils/time.ts. */
export function dagInZone(iso: string, timeZone: string): string {
  // en-CA formatteert als YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
