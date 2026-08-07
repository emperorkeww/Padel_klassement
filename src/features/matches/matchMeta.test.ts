import { describe, it, expect, vi } from "vitest";

// matchMeta leest via api.ts de set-stand uit; die module laadt de
// Supabase-client, en die crasht bij het laden zonder env. Zelfde stub als in
// de andere pure matches-tests.
vi.mock("@/lib/supabase/client", () => ({ supabase: {} }));

import { historieMeta } from "./matchMeta";
import { MATCH_DONE } from "@/test/fixtures";
import type { Match } from "@/types";
import type { Upset } from "@/features/matches/upset";

const gespeeld = MATCH_DONE as Match;
const UPSET: Upset = { chance: 0.3 } as Upset;

describe("historieMeta", () => {
  it("geeft null als er niets bijzonders te melden is", () => {
    expect(historieMeta({ match: gespeeld })).toBeNull();
  });

  it("kiest de upset boven de rest", () => {
    const meta = historieMeta({
      match: { ...gespeeld, set_scores: [[6, 3]] } as Match,
      upset: UPSET,
      joker: "🃏 Alice — 🛡️ Schild, winst",
      lef: "🎲 lef ×2 · Alice — winst",
    });
    expect(meta?.sleutel).toBe("upset");
    expect(meta?.tekst).toContain("30% kans");
    // De rest is niet weg, alleen niet zichtbaar op de lijstkaart.
    expect(meta?.rest).toBe(3);
  });

  it("kiest de joker boven de lef-inzet", () => {
    // Eén kaart per maand weegt zwaarder dan één inzet per dag.
    const meta = historieMeta({
      match: gespeeld,
      joker: "🃏 Alice — 🎲 Dubbel of niets, winst",
      lef: "🎲 lef ×2 · Alice — winst",
    });
    expect(meta?.sleutel).toBe("joker");
    expect(meta?.rest).toBe(1);
  });

  it("valt terug op de traktatie en dan op de sets", () => {
    const metDrankje = historieMeta({
      match: { ...gespeeld, wager_drink: "duvel", wager_drink_qty: 2 } as Match,
    });
    expect(metDrankje?.sleutel).toBe("traktatie");

    const alleenSets = historieMeta({
      match: { ...gespeeld, set_scores: [[6, 3]] } as Match,
    });
    expect(alleenSets?.sleutel).toBe("sets");
    expect(alleenSets?.tekst).toBe("6-3");
    expect(alleenSets?.rest).toBe(0);
  });

  it("toont geen upset op een nog te spelen match", () => {
    // De upset-uitkomst bestaat pas ná afloop; vooraf zou hij de uitslag
    // verklappen die er nog niet is.
    const meta = historieMeta({
      match: { ...gespeeld, status: "scheduled" } as Match,
      upset: UPSET,
      lef: "🎲 lef ×2 · Alice",
    });
    expect(meta?.sleutel).toBe("lef");
  });

  it("telt alleen wat er werkelijk is", () => {
    const meta = historieMeta({ match: gespeeld, lef: "🎲 lef ×2 · Alice" });
    expect(meta?.rest).toBe(0);
  });
});
