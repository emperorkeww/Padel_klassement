import { describe, it, expect } from "vitest";
import {
  magDictatorPortretGenereren,
  PREWARM_ONDERGRENS,
} from "./dictatorPortret";

describe("magDictatorPortretGenereren (pre-warm-drempel #554)", () => {
  it("onder 1576 nooit — één match haalt de 1600 niet", () => {
    expect(
      magDictatorPortretGenereren({ rating: 1575, echteDictatorRating: null }),
    ).toBe(false);
    expect(PREWARM_ONDERGRENS).toBe(1576);
  });

  it("1576+ zonder echte dictator (vacant/waarnemend) → wel", () => {
    expect(
      magDictatorPortretGenereren({ rating: 1576, echteDictatorRating: null }),
    ).toBe(true);
    expect(
      magDictatorPortretGenereren({ rating: 1620, echteDictatorRating: null }),
    ).toBe(true);
  });

  it("null rating → nooit", () => {
    expect(
      magDictatorPortretGenereren({ rating: null, echteDictatorRating: null }),
    ).toBe(false);
  });

  it("met echte dictator: enkel binnen 24 punten (machtsbehoud #545)", () => {
    // Dictator op 1700, uitdager op 1676 → gat 24 → wel.
    expect(
      magDictatorPortretGenereren({ rating: 1676, echteDictatorRating: 1700 }),
    ).toBe(true);
    // Uitdager op 1675 → gat 25 → nog niet.
    expect(
      magDictatorPortretGenereren({ rating: 1675, echteDictatorRating: 1700 }),
    ).toBe(false);
  });

  it("de zittende dictator zelf voldoet altijd (verschil 0) → vangnet", () => {
    expect(
      magDictatorPortretGenereren({ rating: 1700, echteDictatorRating: 1700 }),
    ).toBe(true);
  });

  it("een uitdager die al voorligt op de dictator voldoet ook", () => {
    expect(
      magDictatorPortretGenereren({ rating: 1710, echteDictatorRating: 1700 }),
    ).toBe(true);
  });
});
