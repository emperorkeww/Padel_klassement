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
  /** Laatste faseverandering van de poll; bepaalt de SEQUENCE. */
  changedAt: string;
};

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
  ].filter(Boolean);
  return icsEvent(
    {
      title: `Padel: ${s.groupName}`,
      description: details.join(" · "),
      location: s.clubName,
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
