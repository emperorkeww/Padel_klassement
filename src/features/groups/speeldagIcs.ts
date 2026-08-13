import {
  downloadIcs,
  icsEvent,
  minuutStempel,
  type IcsStatus,
} from "@/lib/utils/ics";
import { courtsLabel } from "@/features/groups/planPollHelpers";

/* ------------------------------------------------------------------ */
/* Eén speeldag als los .ics-bestand (#1091, #1099).                   */
/*                                                                     */
/* De agenda (DagSheet) en de poll-kaart bieden hetzelfde event aan —   */
/* de eerste om het erin te zetten, de tweede om het er weer uit te     */
/* halen. Dezelfde UID en dezelfde opbouw op één plek, want juist bij   */
/* die twee moet het exact hetzelfde event zijn: verschilt de UID, dan  */
/* wist de annulering niets.                                            */
/* ------------------------------------------------------------------ */

export type SpeeldagAgenda = {
  pollId: string;
  groupName: string;
  clubName: string;
  /** Kalenderdag en kloktijd in clubtijd, zoals de kolommen ze bewaren. */
  date: string;
  startTime: string;
  duration: number;
  courts: string | null;
  accessCode: string | null;
  /** Namen van de bevestigde deelnemers (#1121). Weglaten mag: de agenda kent
   *  ze niet altijd, en dan blijft die regel gewoon weg. */
  deelnemers?: string[];
  /** Laatste faseverandering van de poll; bepaalt de SEQUENCE. */
  changedAt: string;
};

/**
 * Wanneer er voor het laatst iets aan deze speeldag veranderde (#1271).
 *
 * Dit voedt de SEQUENCE, en die moet omhóóg bij elke wijziging — anders laat
 * een agenda-app het bijgewerkte event liggen. Het was
 * `booked_at ?? locked_at ?? created_at`, en dat brak zodra je een geboekte
 * speeldag kon verzetten: `locked_at` schuift dan op, maar `booked_at` stond
 * er al en won de keten. Iedereen bleef een uur te vroeg op de baan staan.
 *
 * Het grootste van de drie dus, en niet de eerste die er is.
 */
export function laatsteWijziging(poll: {
  created_at: string;
  locked_at?: string | null;
  booked_at?: string | null;
}): string {
  return [poll.created_at, poll.locked_at, poll.booked_at]
    .filter((t): t is string => !!t)
    .reduce((a, b) => (a >= b ? a : b));
}

/**
 * Het VCALENDAR-bestand van één speeldag.
 *
 * `STATUS:CANCELLED` krijgt bewust de klok van nú als SEQUENCE en niet die van
 * `changedAt`: annuleren zet geen eigen timestamp op de poll, en een gelijke
 * SEQUENCE laten agenda-apps liggen. Nu ligt per definitie ná de laatste
 * faseverandering, dus de annulering wint altijd.
 */
export function speeldagIcs(
  s: SpeeldagAgenda,
  status: IcsStatus = "CONFIRMED",
  now: Date = new Date(),
): string {
  const details = [
    s.groupName,
    s.courts ? courtsLabel(s.courts) : null,
    s.accessCode ? `Toegangscode ${s.accessCode}` : null,
    // De deelnemers op een eigen regel: in een agenda-item lees je die als
    // lijstje, niet als vierde stukje achter een middelpunt.
    s.deelnemers?.length ? `\nDeelnemers: ${s.deelnemers.join(", ")}` : null,
  ].filter(Boolean);
  return icsEvent(
    {
      title: `Padel: ${s.groupName}`,
      description: details.join(" · "),
      // De baan hoort bij de plek: zo staat hij in de agenda-melding zelf, en
      // hoef je het item niet te openen als je voor de deur staat.
      location: s.courts ? `${s.clubName} · ${courtsLabel(s.courts)}` : s.clubName,
      date: s.date,
      startTime: s.startTime,
      durationMin: s.duration,
      // Stabiel per speeldag: opnieuw importeren werkt het event bij in plaats
      // van er een tweede naast te zetten.
      uid: `speeldag-${s.pollId}@vamos-padel`,
      sequence:
        status === "CANCELLED" ? minuutStempel(now) : minuutStempel(s.changedAt),
      status,
    },
    now,
  );
}

/** Biedt die speeldag aan als download. */
export function downloadSpeeldagIcs(
  s: SpeeldagAgenda,
  status: IcsStatus = "CONFIRMED",
): void {
  const naam = status === "CANCELLED" ? "speeldag-geannuleerd" : "speeldag";
  downloadIcs(`${naam}-${s.date}.ics`, speeldagIcs(s, status));
}
