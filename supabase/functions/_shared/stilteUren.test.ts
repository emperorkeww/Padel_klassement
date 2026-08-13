import { describe, expect, it } from "vitest";
import { inStilteVenster, minutenInZone, minutenVanTijd } from "./stilteUren";

/** 13 augustus 2026, een zomerdag: Europe/Brussels staat op UTC+2. */
const om = (uurUtc: number, minuut = 0) =>
  new Date(Date.UTC(2026, 7, 13, uurUtc, minuut));

describe("minutenVanTijd", () => {
  it("leest de vorm die Postgres teruggeeft", () => {
    expect(minutenVanTijd("23:00:00")).toBe(23 * 60);
    expect(minutenVanTijd("07:30")).toBe(450);
  });

  it("geeft null voor leeg of onzin", () => {
    for (const waarde of [null, undefined, "", "later", "25:00", "07:99"]) {
      expect(minutenVanTijd(waarde)).toBeNull();
    }
  });
});

describe("minutenInZone", () => {
  it("rekent naar clubtijd en niet naar UTC", () => {
    // 01:05 UTC is 03:05 in Brussel — precies het uur waarop poll-deadline de
    // dag-van-herinnering voor een speeldag om 08:00 verstuurt.
    expect(minutenInZone(om(1, 5))).toBe(3 * 60 + 5);
  });

  it("houdt middernacht op nul", () => {
    expect(minutenInZone(om(22, 0))).toBe(0);
  });
});

describe("inStilteVenster", () => {
  const van = "23:00";
  const tot = "07:30";

  it("zwijgt midden in de nacht", () => {
    // 03:05 clubtijd: de push uit meting 12.
    expect(inStilteVenster(om(1, 5), van, tot)).toBe(true);
    // 06:00 clubtijd: de match-reminder voor een ochtendmatch om 09:00.
    expect(inStilteVenster(om(4, 0), van, tot)).toBe(true);
  });

  it("praat overdag gewoon", () => {
    expect(inStilteVenster(om(10, 0), van, tot)).toBe(false); // 12:00
    expect(inStilteVenster(om(18, 0), van, tot)).toBe(false); // 20:00
  });

  it("neemt de begintijd mee en laat de eindtijd los", () => {
    expect(inStilteVenster(om(21, 0), van, tot)).toBe(true); // 23:00 precies
    expect(inStilteVenster(om(5, 30), van, tot)).toBe(false); // 07:30 precies
    expect(inStilteVenster(om(5, 29), van, tot)).toBe(true); // 07:29
  });

  it("kent ook een venster binnen één dag", () => {
    // Wie overdag rust wil: 13:00–15:00.
    expect(inStilteVenster(om(12, 0), "13:00", "15:00")).toBe(true); // 14:00
    expect(inStilteVenster(om(14, 0), "13:00", "15:00")).toBe(false); // 16:00
  });

  it("faalt open", () => {
    // Geen venster, half ingevuld of onleesbaar: gewoon pushen. Een kapotte
    // instelling mag niemand stil zijn meldingen kosten.
    expect(inStilteVenster(om(1, 5), null, null)).toBe(false);
    expect(inStilteVenster(om(1, 5), "23:00", null)).toBe(false);
    expect(inStilteVenster(om(1, 5), "kapot", "07:30")).toBe(false);
    // Een venster van nul minuten is geen venster.
    expect(inStilteVenster(om(1, 5), "23:00", "23:00")).toBe(false);
  });
});
