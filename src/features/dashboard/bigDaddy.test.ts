import { describe, it, expect } from "vitest";
import {
  BIG_DADDY_LOF,
  BIG_DADDY_LOF_NEUTRAAL,
  BIG_DADDY_REST_SNEER,
  bigDaddyCoachQuote,
  bigDaddyRoast,
} from "@/features/dashboard/bigDaddy";

describe("bigDaddyRoast", () => {
  it("is deterministisch: zelfde seed → zelfde roast", () => {
    expect(bigDaddyRoast("p1")).toBe(bigDaddyRoast("p1"));
    expect(bigDaddyRoast("alice-key")).toBe(bigDaddyRoast("alice-key"));
  });

  it("levert altijd een niet-lege zin", () => {
    for (const seed of ["p1", "p2", "p3", "", "xyz-123"]) {
      expect(bigDaddyRoast(seed).length).toBeGreaterThan(0);
    }
  });

  it("varieert over verschillende seeds", () => {
    const seeds = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const uniek = new Set(seeds.map(bigDaddyRoast));
    expect(uniek.size).toBeGreaterThan(1);
  });
});

describe("bigDaddyCoachQuote", () => {
  it("is deterministisch: zelfde key → zelfde regel, met en zonder schild", () => {
    expect(bigDaddyCoachQuote("p1", false)).toBe(bigDaddyCoachQuote("p1", false));
    expect(bigDaddyCoachQuote("p1", true)).toBe(bigDaddyCoachQuote("p1", true));
  });

  it("combineert zonder schild een lof-regel met een sneer richting de rest", () => {
    const quote = bigDaddyCoachQuote("p1", false);
    expect(BIG_DADDY_LOF.some((lof) => quote.startsWith(lof))).toBe(true);
    expect(BIG_DADDY_REST_SNEER.some((sneer) => quote.endsWith(sneer))).toBe(
      true,
    );
  });

  it("levert met schild alleen neutrale lof, zonder sneer-staart", () => {
    for (const key of ["p1", "p2", "alice-key"]) {
      const quote = bigDaddyCoachQuote(key, true);
      expect(BIG_DADDY_LOF_NEUTRAAL).toContain(quote);
      for (const sneer of BIG_DADDY_REST_SNEER) {
        expect(quote).not.toContain(sneer);
      }
    }
  });

  it("varieert over verschillende keys", () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
    const uniek = new Set(keys.map((k) => bigDaddyCoachQuote(k, false)));
    expect(uniek.size).toBeGreaterThan(1);
  });

  it('bevat nergens de letterlijke titel (podium-test matcht op "Big Daddy")', () => {
    const pools = [
      ...BIG_DADDY_LOF,
      ...BIG_DADDY_REST_SNEER,
      ...BIG_DADDY_LOF_NEUTRAAL,
    ];
    for (const regel of pools) {
      expect(regel).not.toMatch(/Big Daddy/i);
    }
  });
});
