import { describe, it, expect } from "vitest";
import { banenLabel, feedVenster, icsFeed, utcStamp } from "./ics.ts";

const NU = new Date("2026-08-07T09:15:30.000Z");

const event = {
  uid: "speeldag-poll-1@vamos-padel",
  title: "Padel: Vrijdagavond",
  description: "Vrijdagavond · Baan 3",
  location: "LAGO CLUB Padel Beveren, Beveren",
  // 14 aug 2026 20:00 in Brussel = 18:00 UTC.
  startsAt: "2026-08-14T18:00:00.000Z",
  durationMin: 90,
  sequence: 29_000_000,
};

describe("icsFeed", () => {
  it("bouwt een geldige VCALENDAR met CRLF en een abonnementsnaam", () => {
    const ics = icsFeed("Padel — jouw speeldagen", [event], NU);
    const lines = ics.split("\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("X-WR-CALNAME:Padel — jouw speeldagen");
    // De hints waarmee een agenda-app zou mógen weten hoe vaak ze ophaalt.
    expect(lines).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
    expect(lines).toContain("X-PUBLISHED-TTL:PT6H");
  });

  /* De kern van de zone-afhandeling: absolute tijdstippen, geen TZID. Elke
     poll draagt zijn eigen club_timezone, dus een vaste TZID zou een club
     buiten Brussel een uur naast leggen. */
  it("zendt het tijdstip in UTC uit, zonder VTIMEZONE", () => {
    const lines = icsFeed("Padel", [event], NU).split("\r\n");
    expect(lines).toContain("DTSTART:20260814T180000Z");
    expect(lines).toContain("DTEND:20260814T193000Z");
    expect(lines.join("")).not.toContain("VTIMEZONE");
    expect(lines.join("")).not.toContain("TZID");
  });

  it("draagt UID, SEQUENCE en STATUS zodat een refresh bijwerkt", () => {
    const lines = icsFeed("Padel", [event], NU).split("\r\n");
    expect(lines).toContain("UID:speeldag-poll-1@vamos-padel");
    expect(lines).toContain("SEQUENCE:29000000");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("DTSTAMP:20260807T091530Z");
  });

  it("zet meerdere speeldagen naast elkaar in één kalender", () => {
    const ics = icsFeed(
      "Padel",
      [event, { ...event, uid: "speeldag-poll-2@vamos-padel" }],
      NU,
    );
    expect(ics.split("BEGIN:VEVENT").length - 1).toBe(2);
  });

  it("geeft bij nul speeldagen een lege maar geldige kalender", () => {
    const ics = icsFeed("Padel", [], NU);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("escapet komma's, puntkomma's en nieuwe regels", () => {
    const lines = icsFeed(
      "Padel",
      [{ ...event, title: "Padel; met, alles", description: "regel 1\nregel 2" }],
      NU,
    ).split("\r\n");
    expect(lines).toContain("SUMMARY:Padel\\; met\\, alles");
    expect(lines).toContain("DESCRIPTION:regel 1\\nregel 2");
  });

  // RFC 5545 vouwt op 75 octetten. Een feed wordt door machines gelezen, dus
  // ook een strikte parser moet erdoorheen komen.
  it("vouwt lange regels op 75 octetten, met een spatie als voortzetting", () => {
    const lang = "Vrijdagavond padel met de hele ploeg ".repeat(4);
    const ics = icsFeed("Padel", [{ ...event, description: lang }], NU);
    const lines = ics.split("\r\n");
    for (const l of lines) {
      expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    }
    expect(lines.some((l) => l.startsWith(" "))).toBe(true);
  });

  it("knipt niet midden in een teken van meerdere bytes", () => {
    const ics = icsFeed(
      "Padel",
      [{ ...event, description: "café ".repeat(30) }],
      NU,
    );
    // Ontvouwen levert de oorspronkelijke tekst weer op — bij een kapotte
    // knip zou hier een vervangingsteken staan.
    const ontvouwen = ics.replaceAll("\r\n ", "");
    expect(ontvouwen).toContain(`DESCRIPTION:${"café ".repeat(30).trimEnd()}`);
    expect(ics).not.toContain("�");
  });
});

describe("utcStamp", () => {
  it("formatteert als basic-format met Z", () => {
    expect(utcStamp("2026-08-14T18:00:00.000Z")).toBe("20260814T180000Z");
  });
});

describe("feedVenster", () => {
  it("draagt een maand terug tot een half jaar vooruit", () => {
    const { from, to } = feedVenster(new Date("2026-08-07T12:00:00.000Z"));
    expect(from).toBe("2026-07-07");
    expect(to).toBe("2027-02-06");
  });

  it("kantelt netjes over een jaargrens", () => {
    const { from } = feedVenster(new Date("2026-01-10T12:00:00.000Z"));
    expect(from).toBe("2025-12-10");
  });
});

describe("banenLabel", () => {
  it("zet er 'Baan' voor bij een kaal nummer, en laat een zin staan", () => {
    expect(banenLabel("3")).toBe("Baan 3");
    expect(banenLabel("Banen 3 & 4")).toBe("Banen 3 & 4");
  });
});
