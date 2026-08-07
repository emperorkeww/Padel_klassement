// ICS-opbouw voor de agenda-feed (#1099). Deno en src/ kunnen niet uit elkaars
// boom importeren; dit is de tegenhanger van src/lib/utils/ics.ts, net zoals
// klok.ts dat is van src/lib/utils/time.ts.
//
// Twee verschillen met de client-kant, allebei omdat dit een feed is en geen
// download:
//
// 1. Alles in UTC (`DTSTART:…Z`). Elke poll draagt zijn eigen club_timezone
//    (#322), en een VTIMEZONE per gebruikte zone meeslepen is veel gedoe voor
//    iets wat een absoluut tijdstip al oplost. De omrekening deed de database
//    al (calendar_feed_events).
// 2. Regels worden gevouwen op 75 octetten, zoals RFC 5545 voorschrijft. Een
//    feed wordt door machines gelezen, niet door één agenda-app die je zelf
//    uitkoos, dus strikte parsers moeten er ook doorheen komen.

const CRLF = "\r\n";

export type FeedEvent = {
  /** Stabiele id; dezelfde als de losse download, zodat ze samenvallen. */
  uid: string;
  title: string;
  description?: string;
  location?: string;
  /** Absoluut beginmoment (ISO-timestamp). */
  startsAt: string;
  durationMin: number;
  /** Versie van dit event; hoger = nieuwer voor de agenda-app. */
  sequence: number;
};

/** Escaping van TEXT-waardes: backslash eerst, dan ; , en regeleindes. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "20260814T180000Z" — de basic-format van een UTC-tijdstip. */
export function utcStamp(moment: Date | string): string {
  const d = typeof moment === "string" ? new Date(moment) : moment;
  return `${d.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/**
 * Vouwt een regel op 75 octetten, met een spatie aan het begin van elke
 * vervolgregel. Telt in bytes en niet in tekens: één é is twee octetten, en
 * midden in een multibyte-teken knippen levert een kapotte feed op.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const stukken: string[] = [];
  let start = 0;
  // Eerste regel 75 octetten, daarna 74 (de leidende spatie telt mee).
  let limiet = 75;
  while (start < bytes.length) {
    let eind = Math.min(start + limiet, bytes.length);
    // Niet midden in een UTF-8-teken knippen: vervolgbytes zijn 10xxxxxx.
    while (eind > start && eind < bytes.length && (bytes[eind] & 0xc0) === 0x80) {
      eind--;
    }
    stukken.push(new TextDecoder().decode(bytes.slice(start, eind)));
    start = eind;
    limiet = 74;
  }
  return stukken.join(`${CRLF} `);
}

/**
 * De hele kalender. `name` verschijnt als naam van het abonnement in de
 * agenda-app; de refresh-hints vertellen hoe vaak ze zou mógen ophalen — of ze
 * dat doet bepaalt de app zelf, en Google neemt daar uren voor.
 */
export function icsFeed(
  name: string,
  events: FeedEvent[],
  now: Date = new Date(),
): string {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//vamos//padel//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];

  for (const e of events) {
    const start = new Date(e.startsAt);
    const end = new Date(start.getTime() + e.durationMin * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${utcStamp(start)}`,
      `DTEND:${utcStamp(end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${escapeText(e.location)}`] : []),
      `SEQUENCE:${e.sequence}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join(CRLF) + CRLF;
}

/**
 * Het venster dat de feed draagt: een maand terug tot een half jaar vooruit.
 *
 * Terug, omdat een agenda zonder verleden raar leest als je een week later
 * terugbladert. Begrensd, omdat een feed die eeuwig groeit bij élke refresh
 * opnieuw in zijn geheel wordt opgehaald.
 */
export function feedVenster(now: Date = new Date()): { from: string; to: string } {
  const dag = (offset: number) => {
    const d = new Date(now.getTime());
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  return { from: dag(-31), to: dag(183) };
}

/** Spiegel van courtsLabel in src/features/groups/planPollHelpers.ts. */
export function banenLabel(courts: string): string {
  return /^(baan|banen|court|center|centre|terrein|veld)/i.test(courts)
    ? courts
    : `Baan ${courts}`;
}
