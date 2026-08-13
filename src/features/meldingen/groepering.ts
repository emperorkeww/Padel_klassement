import { calendarDayDiff } from "@/lib/utils/format";
import type { Melding } from "./api";

/**
 * De lijst in tijdvakken (#1273).
 *
 * `formatRelatieveTijd` slaat op dag zeven om van "2 dagen geleden" naar een
 * kale datum. In één ononderbroken kolom staat "13 min geleden" dan acht rijen
 * boven "4 jul", zonder dat er iets aangeeft dat je een grens overgaat — en met
 * de bewaartermijn van 90 dagen loopt die kolom in de praktijk door tot
 * honderden rijen.
 *
 * Kalenderdagen en geen 24-uursvensters: om vijf over middernacht hoort de
 * melding van gisteravond bij "Deze week", niet bij "Vandaag". Dat is precies
 * het onderscheid dat `calendarDayDiff` al maakt voor `formatRelativeDay`.
 */
export type Tijdvak = "Vandaag" | "Deze week" | "Eerder";

export interface Groep {
  kop: Tijdvak;
  meldingen: Melding[];
}

export function tijdvakVan(iso: string, now: Date = new Date()): Tijdvak {
  const dagen = calendarDayDiff(now, new Date(iso));
  if (dagen <= 0) return "Vandaag";
  if (dagen < 7) return "Deze week";
  return "Eerder";
}

/**
 * Groepeert een aflopend gesorteerde lijst in tijdvakken. De volgorde van de
 * meldingen blijft precies zoals hij binnenkwam: dit knipt alleen, het
 * hersorteert niet.
 */
export function groepeer(meldingen: Melding[], now: Date = new Date()): Groep[] {
  const groepen: Groep[] = [];
  for (const melding of meldingen) {
    const kop = tijdvakVan(melding.created_at, now);
    const laatste = groepen[groepen.length - 1];
    if (laatste?.kop === kop) laatste.meldingen.push(melding);
    else groepen.push({ kop, meldingen: [melding] });
  }
  return groepen;
}
