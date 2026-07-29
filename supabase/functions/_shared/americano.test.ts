import { describe, expect, it } from "vitest";
import {
  americanoRound,
  applyRound,
  emptyHistory,
} from "./americano.ts";
// De client-implementatie waar deze module een spiegel van is. Vitest kan wél
// in beide bomen kijken, dus de pariteit is hier hard te maken.
import * as client from "@/features/groups/americano";

const spelers = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Deterministische rng (mulberry32), zodat beide kanten dezelfde keuzes maken. */
function seeded(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const platteBanen = (courts: { teamA: string[]; teamB: string[] }[]) =>
  courts.map((c) => [...c.teamA, ...c.teamB]);

describe("americanoRound", () => {
  it("vormt volle banen van vier en zet de rest op de bank", () => {
    const { courts, reserves } = americanoRound(spelers(10), emptyHistory(), seeded(1));
    expect(courts).toHaveLength(2);
    expect(reserves).toHaveLength(2);
  });

  it("levert geen banen bij minder dan vier spelers", () => {
    expect(americanoRound(spelers(3), emptyHistory(), seeded(1)).courts).toEqual([]);
  });

  it("laat partners wisselen over opeenvolgende rondes", () => {
    // Acht spelers, vier rondes: met een lege historie mag hetzelfde koppel
    // niet blijven terugkomen zolang er nog verse combinaties zijn.
    const ids = spelers(8);
    const history = emptyHistory();
    const rng = seeded(7);
    const koppels: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { courts } = americanoRound(ids, history, rng);
      applyRound(history, courts);
      for (const c of courts) {
        koppels.push([...c.teamA].sort().join("|"));
        koppels.push([...c.teamB].sort().join("|"));
      }
    }
    expect(new Set(koppels).size).toBe(koppels.length);
  });

  it("laat de bank rouleren over de rondes", () => {
    // Vijf spelers: elke ronde zit er precies één, en over vijf rondes komt
    // iedereen aan de beurt in plaats van steeds dezelfde.
    const ids = spelers(5);
    const history = emptyHistory();
    const rng = seeded(3);
    const gezeten = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { courts, reserves } = americanoRound(ids, history, rng);
      applyRound(history, courts);
      reserves.forEach((id) => gezeten.add(id));
    }
    expect(gezeten.size).toBe(5);
  });
});

describe("pariteit met americano in de client", () => {
  it.each([4, 5, 8, 9, 12])("deelt %i spelers identiek in", (n) => {
    const ids = spelers(n);
    const hier = americanoRound(ids, emptyHistory(), seeded(42));
    const daar = client.americanoRound(ids, client.emptyHistory(), seeded(42));
    expect(platteBanen(hier.courts)).toEqual(platteBanen(daar.courts));
    expect(hier.reserves).toEqual(daar.reserves);
  });

  it("blijft gelijk over een hele avond, historie en al", () => {
    const ids = spelers(10);
    const hierH = emptyHistory();
    const daarH = client.emptyHistory();
    const rngHier = seeded(99);
    const rngDaar = seeded(99);
    for (let i = 0; i < 8; i++) {
      const hier = americanoRound(ids, hierH, rngHier);
      const daar = client.americanoRound(ids, daarH, rngDaar);
      expect(platteBanen(hier.courts)).toEqual(platteBanen(daar.courts));
      expect(hier.reserves).toEqual(daar.reserves);
      applyRound(hierH, hier.courts);
      client.applyRound(daarH, daar.courts);
    }
  });
});
