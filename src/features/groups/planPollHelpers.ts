import type { PollVoteStatus } from "@/features/groups/pollsApi";

// Gedeelde constants en pure helpers voor de Speeldag-poll (PlanPoll).

/** De drie stemknoppen. Het teken zelf tekent PollOptionRow (#946): ✓ en ✗ als
 *  tekst vielen per platform anders uit — in de doorloop verscheen het vinkje
 *  als het wortelteken √ en het kruis als een hoofdletter X. */
export const VOTE_SEGMENTS: { status: PollVoteStatus; label: string }[] = [
  { status: "yes", label: "Ik kan" },
  { status: "maybe", label: "Misschien" },
  { status: "no", label: "Kan niet" },
];
export const MAX_OPTIONS = 5;
export const DURATIONS = [60, 90, 120] as const;
/** Avonduren als standaardvenster in de wizard. */
export const EVENING_FROM = 17;

// 's Middags formatteren zodat DST de datum niet kantelt.
export function fmtDate(date: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("nl-BE", opts).format(new Date(`${date}T12:00:00`));
}
export const longDay = (date: string) =>
  fmtDate(date, { weekday: "long", day: "numeric", month: "long" });
export const shortDay = (date: string) =>
  fmtDate(date, { weekday: "short", day: "numeric", month: "short" });

/** "20:15" → "20:00": lookup-sleutel voor het halfuur-raster. */
export function floorHalfHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${m < 30 ? "00" : "30"}`;
}

export const optKey = (o: { date: string; startTime: string }) => `${o.date}|${o.startTime}`;

/** Maximale lengte van de toegangscode (#675); spiegelt de CHECK in de DB. */
export const MAX_ACCESS_CODE = 60;

/** Maximale lengte van de banen-tekst (#802); spiegelt de CHECK in de DB. */
export const MAX_COURTS = 60;

/**
 * Vrij tekstveld van een boeking klaarmaken voor opslag: trimmen, witruimte
 * inklappen en afkappen. Leeg → null, zodat "niet ingevuld" één representatie
 * heeft en het lege veld gewoon overslaan blijft.
 */
function normalizeBookingText(raw: string | null | undefined, max: number): string | null {
  if (raw == null) return null;
  const tekst = raw.replace(/\s+/g, " ").trim().slice(0, max);
  return tekst === "" ? null : tekst;
}

/**
 * Toegangscode van de velden (#675). Bewust géén cijfer-validatie: clubs
 * gebruiken ook letters of een code per baan.
 */
export function normalizeAccessCode(raw: string | null | undefined): string | null {
  return normalizeBookingText(raw, MAX_ACCESS_CODE);
}

/**
 * Banen van de boeking (#802). Net als de code vrije tekst: "3", "Baan 3 & 4"
 * en "Center Court" zijn allemaal geldig — de club bepaalt de notatie, wij
 * tonen 'm gewoon terug.
 */
export function normalizeCourts(raw: string | null | undefined): string | null {
  return normalizeBookingText(raw, MAX_COURTS);
}

/**
 * De banen-tekst als leesbaar label (#802). Het veld is vrije tekst, dus wie
 * "3 & 4" invulde krijgt er "Baan" voor; wie zelf al "Baan 3" of "Center Court"
 * schreef, houdt precies dat — anders lees je "Baan Baan 3".
 */
export function courtsLabel(courts: string): string {
  return /^(baan|banen|court|center|centre|terrein|veld)/i.test(courts)
    ? courts
    : `Baan ${courts}`;
}