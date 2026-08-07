import { describe, it, expect, vi, afterEach } from "vitest";
import {
  downloadIcs,
  icsEvent,
  localDate,
  localTime,
  minuutStempel,
} from "@/lib/utils/ics";

const NOW = new Date("2026-07-03T09:15:30.000Z");

const base = {
  title: "Padel: Alice & Bob vs Carol & Dave",
  location: "LAGO CLUB Padel Beveren",
  date: "2026-07-10",
  uid: "match-m1@vamos-padel",
};

describe("icsEvent", () => {
  it("bouwt een geldige VCALENDAR met CRLF-regeleindes", () => {
    const ics = icsEvent(base, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Elke regel eindigt op CRLF: zonder \r\n blijven er geen kale \n over.
    expect(ics.split("\r\n").join("")).not.toContain("\n");
    const lines = ics.split("\r\n");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines).toContain("DTSTAMP:20260703T091530Z");
    expect(lines).toContain("SUMMARY:Padel: Alice & Bob vs Carol & Dave");
  });

  it("maakt zonder startTime een event voor de hele dag (DTEND = dag erna)", () => {
    const lines = icsEvent(base, NOW).split("\r\n");
    expect(lines).toContain("DTSTART;VALUE=DATE:20260710");
    expect(lines).toContain("DTEND;VALUE=DATE:20260711");
    expect(lines.join("")).not.toContain("VTIMEZONE");
  });

  it("kantelt de all-day-einddatum correct over een maandgrens", () => {
    const lines = icsEvent({ ...base, date: "2026-07-31" }, NOW).split("\r\n");
    expect(lines).toContain("DTSTART;VALUE=DATE:20260731");
    expect(lines).toContain("DTEND;VALUE=DATE:20260801");
  });

  it("maakt met startTime een getimed event in Europe/Brussels", () => {
    const ics = icsEvent({ ...base, startTime: "19:30", durationMin: 90 }, NOW);
    const lines = ics.split("\r\n");
    expect(lines).toContain("DTSTART;TZID=Europe/Brussels:20260710T193000");
    expect(lines).toContain("DTEND;TZID=Europe/Brussels:20260710T210000");
    // TZID verwijst naar een meegeleverde tijdzonedefinitie.
    expect(lines).toContain("BEGIN:VTIMEZONE");
    expect(lines).toContain("TZID:Europe/Brussels");
  });

  it("laat een getimed event over middernacht heen lopen", () => {
    const lines = icsEvent(
      { ...base, startTime: "23:30", durationMin: 60 },
      NOW,
    ).split("\r\n");
    expect(lines).toContain("DTEND;TZID=Europe/Brussels:20260711T003000");
  });

  it("valt zonder durationMin terug op 90 minuten", () => {
    const lines = icsEvent({ ...base, startTime: "20:00" }, NOW).split("\r\n");
    expect(lines).toContain("DTEND;TZID=Europe/Brussels:20260710T213000");
  });

  it("escapet komma's, puntkomma's, backslashes en nieuwe regels", () => {
    const lines = icsEvent(
      {
        ...base,
        title: "Padel; met, alles\\erop",
        description: "regel 1\nregel 2",
        location: "LAGO, Beveren",
      },
      NOW,
    ).split("\r\n");
    expect(lines).toContain("SUMMARY:Padel\\; met\\, alles\\\\erop");
    expect(lines).toContain("DESCRIPTION:regel 1\\nregel 2");
    expect(lines).toContain("LOCATION:LAGO\\, Beveren");
  });

  it("houdt de UID stabiel: dezelfde invoer geeft exact dezelfde uitvoer", () => {
    expect(icsEvent(base, NOW)).toBe(icsEvent(base, NOW));
    expect(icsEvent(base, NOW).split("\r\n")).toContain(
      "UID:match-m1@vamos-padel",
    );
  });

  // #1099: zonder SEQUENCE en STATUS legt een agenda-app een herimport naast
  // het bestaande event neer i.p.v. het bij te werken.
  it("schrijft standaard een SEQUENCE uit `now` en STATUS:CONFIRMED", () => {
    const lines = icsEvent(base, NOW).split("\r\n");
    expect(lines).toContain(`SEQUENCE:${Math.floor(NOW.getTime() / 60_000)}`);
    expect(lines).toContain("STATUS:CONFIRMED");
  });

  it("neemt een meegegeven SEQUENCE en STATUS over", () => {
    const lines = icsEvent(
      { ...base, sequence: 42, status: "CANCELLED" },
      NOW,
    ).split("\r\n");
    expect(lines).toContain("SEQUENCE:42");
    expect(lines).toContain("STATUS:CANCELLED");
  });
});

describe("minuutStempel", () => {
  it("rekent een tijdstip om naar hele minuten sinds epoch", () => {
    // 09:15:30 valt binnen dezelfde minuut als 09:15:00.
    expect(minuutStempel(NOW)).toBe(minuutStempel("2026-07-03T09:15:00.000Z"));
    expect(minuutStempel("2026-07-03T09:16:00.000Z")).toBe(
      minuutStempel(NOW) + 1,
    );
  });

  it("loopt op met de tijd en blijft binnen de int32 van RFC 5545", () => {
    expect(minuutStempel("2026-01-01T00:00:00.000Z")).toBeLessThan(
      minuutStempel("2027-01-01T00:00:00.000Z"),
    );
    expect(minuutStempel("2999-01-01T00:00:00.000Z")).toBeLessThan(2 ** 31);
  });
});

describe("localDate/localTime", () => {
  it("formatteert lokale datum en kloktijd met voorloopnullen", () => {
    const d = new Date(2026, 8, 5, 9, 5); // 5 sep 2026, 09:05 lokale tijd
    expect(localDate(d)).toBe("2026-09-05");
    expect(localTime(d)).toBe("09:05");
  });
});

describe("downloadIcs", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("triggert een blob-download met de gevraagde bestandsnaam", () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadIcs("padel.ics", "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    click.mockRestore();
  });
});
