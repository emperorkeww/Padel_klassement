import type { Melding } from "./api";

/**
 * Het filter van /meldingen (#1273), los van de chips die het bedienen.
 *
 * Client-side op het geladen venster: de lijst staat er al, en een tweede query
 * zou alleen maar uit de pas kunnen lopen met de realtime-updates die er
 * ondertussen binnenkomen.
 *
 * Eén as: "ongelezen" en een soort combineren klinkt handig, maar dit is een
 * lijst waarin je iets terugzoekt en geen rapportage.
 */
export const FILTER_ALLES = "alles";
export const FILTER_ONGELEZEN = "ongelezen";

export function filterMeldingen(meldingen: Melding[], actief: string): Melding[] {
  if (actief === FILTER_ALLES) return meldingen;
  if (actief === FILTER_ONGELEZEN) return meldingen.filter((m) => !m.read_at);
  return meldingen.filter((m) => m.soort === actief);
}
