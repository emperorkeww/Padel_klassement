import { describe, it, expect } from "vitest";

import {
  aantalTekst,
  formatDate,
  formatPlannedDay,
  formatRelatieveTijd,
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
// De tijdstempel in de meldingenlijst (#1090).
describe("formatRelatieveTijd", () => {
  const nu = new Date("2026-08-07T12:00:00.000Z");
  const geleden = (ms: number) => new Date(nu.getTime() - ms).toISOString();

  it("geeft een lege string bij ontbrekende datum", () => {
    expect(formatRelatieveTijd(null, nu)).toBe("");
    expect(formatRelatieveTijd(undefined, nu)).toBe("");
  });

  it("noemt het eerste minuutje gewoon 'nu'", () => {
    expect(formatRelatieveTijd(geleden(0), nu)).toBe("nu");
    expect(formatRelatieveTijd(geleden(59_000), nu)).toBe("nu");
  });

  it("telt in minuten, uren en dagen", () => {
    expect(formatRelatieveTijd(geleden(60_000), nu)).toBe("1 min geleden");
    expect(formatRelatieveTijd(geleden(45 * 60_000), nu)).toBe("45 min geleden");
    expect(formatRelatieveTijd(geleden(2 * 3_600_000), nu)).toBe("2 u geleden");
    expect(formatRelatieveTijd(geleden(23 * 3_600_000), nu)).toBe("23 u geleden");
    expect(formatRelatieveTijd(geleden(86_400_000), nu)).toBe("1 dag geleden");
    // Voluit sinds #1273: "dgn" was de enige afkorting van zijn soort.
    expect(formatRelatieveTijd(geleden(3 * 86_400_000), nu)).toBe("3 dagen geleden");
  });

  it("valt vanaf een week terug op een korte datum", () => {
    const oud = geleden(9 * 86_400_000);
    expect(formatRelatieveTijd(oud, nu)).toBe(formatDate(oud));
  });

  // Een serverklok die een seconde voorloopt mag geen "in 1 min" opleveren.
  it("houdt een toekomstige tijdstempel op 'nu'", () => {
    expect(formatRelatieveTijd(geleden(-30_000), nu)).toBe("nu");
  });
});

describe("aantalTekst", () => {
  it("kiest enkelvoud, meervoud en nul", () => {
    expect(aantalTekst(0, "speler", "spelers")).toBe("geen spelers");
    expect(aantalTekst(1, "speler", "spelers")).toBe("1 speler");
    expect(aantalTekst(7, "speler", "spelers")).toBe("7 spelers");
  });
});
