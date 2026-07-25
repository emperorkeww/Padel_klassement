import { describe, it, expect } from "vitest";
import { KLIKKER_CATEGORIEEN } from "@/features/klikker/klikkerData";

describe("KLIKKER_CATEGORIEEN", () => {
  it("bevat precies 4 categorieën met elk 4 quotes (issue #260)", () => {
    expect(KLIKKER_CATEGORIEEN).toHaveLength(4);
    for (const cat of KLIKKER_CATEGORIEEN) {
      expect(cat.quotes).toHaveLength(4);
    }
  });

  it("heeft overal unieke id's", () => {
    const ids = KLIKKER_CATEGORIEEN.flatMap((c) => [c.id, ...c.quotes.map((q) => q.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("heeft nergens lege titels of teksten", () => {
    for (const cat of KLIKKER_CATEGORIEEN) {
      expect(cat.titel.trim()).not.toBe("");
      expect(cat.emoji.trim()).not.toBe("");
      for (const quote of cat.quotes) {
        expect(quote.titel.trim()).not.toBe("");
        expect(quote.tekst.trim()).not.toBe("");
      }
    }
  });

  it("heeft geen dubbele quote-teksten", () => {
    const teksten = KLIKKER_CATEGORIEEN.flatMap((c) => c.quotes.map((q) => q.tekst));
    expect(new Set(teksten).size).toBe(teksten.length);
  });
});
