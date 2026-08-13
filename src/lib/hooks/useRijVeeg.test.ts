import { describe, expect, it } from "vitest";
import { besluit } from "./useRijVeeg";

/**
 * De beslissing apart, net als bij useSleepSluiten (#1180): het gebaar zelf
 * hangt aan native listeners en echte timestamps, maar of een veeg telt is
 * gewone rekenkunde — en dát is waar het misgaat.
 */
describe("besluit", () => {
  it("legt weg zodra je ver genoeg veegt", () => {
    expect(besluit(120, 0)).toBe("weg");
  });

  it("veert terug bij een wiebel", () => {
    expect(besluit(20, 0)).toBe("terug");
  });

  it("laat een korte, snelle zwiep ook tellen", () => {
    expect(besluit(50, 1.2)).toBe("weg");
  });

  it("laat een snelle beweging over een paar pixels níét tellen", () => {
    // Anders legt een snelle scroll die net iets schuin loopt een rij weg.
    expect(besluit(12, 2)).toBe("terug");
  });

  it("houdt de grens waar hij staat", () => {
    expect(besluit(96, 0)).toBe("terug");
    expect(besluit(97, 0)).toBe("weg");
  });
});
