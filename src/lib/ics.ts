/* ICS-export (RFC 5545): één VEVENT in een VCALENDAR, klaar om te downloaden.
   iOS/Android/desktop-agenda's openen zo'n .ics-bestand rechtstreeks. */

import { addDays } from "./time";

export type IcsEventInput = {
  title: string;
  description?: string;
  location?: string;
  /** Lokale kalenderdatum, "YYYY-MM-DD". */
  date: string;
  /** Lokale kloktijd "HH:MM"; weglaten = event voor de hele dag. */
  startTime?: string;
  /** Duur in minuten van een getimed event. */
  durationMin?: number;
  /** Stabiele id: opnieuw importeren werkt het event bij i.p.v. dupliceren. */
  uid: string;
};

const CRLF = "\r\n";
const TZID = "Europe/Brussels";

/* Vaste tijdzonedefinitie voor TZID-verwijzingen (EU-zomertijdregels). */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escaping van TEXT-waardes: backslash eerst, dan ; , en regeleindes. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "YYYY-MM-DD" → "YYYYMMDD". */
function basicDate(date: string): string {
  return date.replaceAll("-", "");
}

/** Eindtijdstip ("YYYYMMDDTHHMMSS") = date + startTime + durationMin.
 *  Gerekend in UTC-velden zodat de tijdzone van het toestel geen rol speelt. */
function localEnd(date: string, startTime: string, durationMin: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = startTime.split(":").map(Number);
  const end = new Date(Date.UTC(y, mo - 1, d, h, mi + durationMin));
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${end.getUTCFullYear()}${p(end.getUTCMonth() + 1)}${p(end.getUTCDate())}` +
    `T${p(end.getUTCHours())}${p(end.getUTCMinutes())}00`
  );
}

/** Lokale kalenderdatum ("YYYY-MM-DD") van een tijdstip. */
export function localDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lokale kloktijd ("HH:MM") van een tijdstip. */
export function localTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Bouwt een geldige VCALENDAR-string met één event. `now` is injecteerbaar
 *  (DTSTAMP) zodat de uitvoer in tests deterministisch is. */
export function icsEvent(event: IcsEventInput, now: Date = new Date()): string {
  const timed = event.startTime !== undefined;
  const stamp = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const start = basicDate(event.date);

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//vamos//padel//NL",
    ...(timed ? VTIMEZONE : []),
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    ...(timed
      ? [
          `DTSTART;TZID=${TZID}:${start}T${event.startTime!.replace(":", "")}00`,
          `DTEND;TZID=${TZID}:${localEnd(event.date, event.startTime!, event.durationMin ?? 90)}`,
        ]
      : [
          // Hele dag: DTEND is exclusief, dus de dag erna.
          `DTSTART;VALUE=DATE:${start}`,
          `DTEND;VALUE=DATE:${basicDate(addDays(event.date, 1))}`,
        ]),
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join(CRLF) + CRLF;
}

/** Biedt de ICS-inhoud client-side aan als download. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
