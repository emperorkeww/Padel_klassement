import { describe, it, expect } from "vitest";
import {
  courtsLabel,
  MAX_ACCESS_CODE,
  MAX_COURTS,
  normalizeAccessCode,
  normalizeCourts,
} from "./planPollHelpers";

// Toegangscode van de velden (#675). Bewust vrije tekst: clubs gebruiken
// cijfers, letters of een code per baan. Alleen opschonen, niet valideren.
describe("normalizeAccessCode", () => {
  it("leeg of witruimte wordt null — overslaan blijft overslaan", () => {
    expect(normalizeAccessCode("")).toBeNull();
    expect(normalizeAccessCode("   ")).toBeNull();
    expect(normalizeAccessCode("\n\t ")).toBeNull();
  });

  it("null en undefined blijven null", () => {
    expect(normalizeAccessCode(null)).toBeNull();
    expect(normalizeAccessCode(undefined)).toBeNull();
  });

  it("trimt en klapt witruimte in", () => {
    expect(normalizeAccessCode("  1234  ")).toBe("1234");
    expect(normalizeAccessCode("b3:   1234  ·  b4: 5678")).toBe(
      "b3: 1234 · b4: 5678",
    );
  });

  it("laat letters en leestekens staan", () => {
    expect(normalizeAccessCode("#A12")).toBe("#A12");
    expect(normalizeAccessCode("poort*90#")).toBe("poort*90#");
  });

  it("kapt af op de DB-limiet", () => {
    const lang = "9".repeat(MAX_ACCESS_CODE + 20);
    expect(normalizeAccessCode(lang)).toHaveLength(MAX_ACCESS_CODE);
  });

  it("is idempotent", () => {
    const eens = normalizeAccessCode("  b3: 1234 ");
    expect(normalizeAccessCode(eens)).toBe(eens);
  });
});

// Banen van de boeking (#802). Zelfde opschoning als de code — de club bepaalt
// de notatie, wij tonen 'm terug.
describe("normalizeCourts", () => {
  it("leeg of witruimte wordt null — de boeker weet ze soms nog niet", () => {
    expect(normalizeCourts("")).toBeNull();
    expect(normalizeCourts("   ")).toBeNull();
    expect(normalizeCourts(null)).toBeNull();
    expect(normalizeCourts(undefined)).toBeNull();
  });

  it("trimt en klapt witruimte in", () => {
    expect(normalizeCourts("  3  &   4 ")).toBe("3 & 4");
  });

  it("kapt af op de DB-limiet", () => {
    expect(normalizeCourts("3".repeat(MAX_COURTS + 20))).toHaveLength(MAX_COURTS);
  });
});

// Het label onder de banen-tekst: nummers krijgen er "Baan" voor, wie zelf al
// een woord schreef houdt precies dat.
describe("courtsLabel", () => {
  it("zet 'Baan' voor een kaal nummer", () => {
    expect(courtsLabel("3")).toBe("Baan 3");
    expect(courtsLabel("3 & 4")).toBe("Baan 3 & 4");
  });

  it("laat een zelfgeschreven naam staan", () => {
    expect(courtsLabel("Baan 3")).toBe("Baan 3");
    expect(courtsLabel("banen 3 en 4")).toBe("banen 3 en 4");
    expect(courtsLabel("Center Court")).toBe("Center Court");
    expect(courtsLabel("Terrein 2")).toBe("Terrein 2");
  });
});
