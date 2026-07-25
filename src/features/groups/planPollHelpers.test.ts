import { describe, it, expect } from "vitest";
import { MAX_ACCESS_CODE, normalizeAccessCode } from "./planPollHelpers";

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
