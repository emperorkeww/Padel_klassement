import { describe, it, expect } from "vitest";
import {
  magDictatorPortretGenereren,
  portretVervallen,
  PREWARM_ONDERGRENS,
  GEEN_AVATAR_BRON,
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

describe("portretVervallen (#554)", () => {
  it("geen portret → vervallen", () => {
    expect(
      portretVervallen({ avatar_url: "a.png", dictator_avatar_url: null }),
    ).toBe(true);
  });

  it("bron matcht de huidige foto → niet vervallen", () => {
    expect(
      portretVervallen({
        avatar_url: "a.png",
        dictator_avatar_url: "p.png",
        dictator_avatar_bron: "a.png",
      }),
    ).toBe(false);
  });

  it("fotowissel (bron ≠ huidige foto) → vervallen", () => {
    expect(
      portretVervallen({
        avatar_url: "nieuw.png",
        dictator_avatar_url: "p.png",
        dictator_avatar_bron: "oud.png",
      }),
    ).toBe(true);
  });

  it("geen avatar: sentinel-bron telt als geldig", () => {
    expect(
      portretVervallen({
        avatar_url: null,
        dictator_avatar_url: "p.png",
        dictator_avatar_bron: GEEN_AVATAR_BRON,
      }),
    ).toBe(false);
  });
});
