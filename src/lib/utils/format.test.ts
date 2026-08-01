import { describe, it, expect } from "vitest";

import {
  aantalTekst,
  formatDate,
  formatPlannedDay,
  formatRelativeDay,
} from "@/lib/utils/format";

describe("formatDate", () => {
  it("geeft een lege string bij ontbrekende datum", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("formatteert een ISO-datum naar een korte NL-datum", () => {
    const out = formatDate("2026-07-01T10:00:00.000Z");
    expect(out).not.toBe("");
    // Bevat de dag; maand-afkorting is locale-afhankelijk, dus niet hard vastgepind.
    expect(out).toMatch(/1/);
  });
});

describe("formatRelativeDay", () => {
  const now = new Date(2026, 6, 7, 20, 0, 0); // 7 jul 2026, lokale tijd

  it("is leeg bij ontbrekende datum", () => {
    expect(formatRelativeDay(null, now)).toBe("");
  });

  it("noemt vandaag, gisteren en eergisteren bij naam", () => {
    expect(formatRelativeDay("2026-07-07T09:00:00", now)).toBe("vandaag");
    expect(formatRelativeDay("2026-07-06T23:00:00", now)).toBe("gisteren");
    expect(formatRelativeDay("2026-07-05T08:00:00", now)).toBe("eergisteren");
  });

  it("valt terug op een korte datum bij oudere dagen", () => {
    expect(formatRelativeDay("2026-07-01T10:00:00", now)).toBe(
      formatDate("2026-07-01T10:00:00"),
    );
  });
});

describe("formatPlannedDay", () => {
  const now = new Date(2026, 6, 7, 20, 0, 0); // 7 jul 2026, lokale tijd

  it("is leeg bij ontbrekende datum", () => {
    expect(formatPlannedDay(null, now)).toBe("");
  });

  it("noemt vandaag, morgen en overmorgen bij naam", () => {
    expect(formatPlannedDay("2026-07-07T22:00:00", now)).toBe("vandaag");
    expect(formatPlannedDay("2026-07-08T09:00:00", now)).toBe("morgen");
    expect(formatPlannedDay("2026-07-09T09:00:00", now)).toBe("overmorgen");
  });

  it("valt terug op een korte datum bij verdere dagen", () => {
    expect(formatPlannedDay("2026-07-15T10:00:00", now)).toBe(
      formatDate("2026-07-15T10:00:00"),
    );
  });
});
describe("aantalTekst", () => {
  it("kiest enkelvoud, meervoud en nul", () => {
    expect(aantalTekst(0, "speler", "spelers")).toBe("geen spelers");
    expect(aantalTekst(1, "speler", "spelers")).toBe("1 speler");
    expect(aantalTekst(7, "speler", "spelers")).toBe("7 spelers");
  });
});
