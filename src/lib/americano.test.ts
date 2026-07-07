import { describe, it, expect } from "vitest";
import {
  americanoRound,
  applyRound,
  emptyHistory,
  historyFromMatches,
  type AmericanoCourt,
} from "./americano";
import type { Match, Team } from "./types";

// Deterministische rng (mulberry32) zodat de tests reproduceerbaar zijn.
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const players = (n: number) =>
  Array.from({ length: n }, (_, i) => `p${i + 1}`);

function courtPlayers(c: AmericanoCourt): string[] {
  return [...c.teamA, ...c.teamB];
}

describe("americanoRound — vorm", () => {
  it("vormt zoveel mogelijk banen van vier, rest op de bank", () => {
    const r = americanoRound(players(10), emptyHistory(), seeded(1));
    expect(r.courts).toHaveLength(2);
    expect(r.reserves).toHaveLength(2);
    // Iedereen komt precies één keer voor (spelend of reserve).
    const all = [...r.courts.flatMap(courtPlayers), ...r.reserves].sort();
    expect(all).toEqual(players(10).sort());
  });

  it("elke baan heeft vier verschillende spelers", () => {
    const r = americanoRound(players(8), emptyHistory(), seeded(2));
    for (const c of r.courts) {
      expect(new Set(courtPlayers(c)).size).toBe(4);
    }
  });

  it("geen banen bij minder dan vier spelers", () => {
    expect(americanoRound(players(3), emptyHistory(), seeded(3)).courts).toHaveLength(0);
  });
});

describe("americanoRound — variatie van partners", () => {
  it("kiest de partner met de minste eerdere koppelingen", () => {
    // p1 speelde al 3× met p2 en 0× met p3/p4 → p1 hoort NIET weer met p2.
    const history = emptyHistory();
    history.partner.set("p1|p2", 3);
    const r = americanoRound(["p1", "p2", "p3", "p4"], history, seeded(5));
    const team = r.courts[0].teamA.includes("p1")
      ? r.courts[0].teamA
      : r.courts[0].teamB;
    expect(team).toContain("p1");
    expect(team).not.toContain("p2");
  });

  it("rouleert de bank naar wie deze generatie al het meest speelde", () => {
    const history = emptyHistory();
    // p1 speelde al 2 rondes, de rest 0 → p1 rust bij 5 spelers (1 reserve).
    history.played.set("p1", 2);
    const r = americanoRound(players(5), history, seeded(7));
    expect(r.reserves).toEqual(["p1"]);
  });
});

describe("americanoRound — minder herhaling dan puur willekeurig", () => {
  // Genereer een reeks rondes met het geschiedenis-bewuste algoritme en meet de
  // maximale keren dat één koppel samen speelt. Dat moet duidelijk lager liggen
  // dan bij een naïeve willekeurige indeling.
  function maxPartnerRepeat(
    generate: (round: number) => AmericanoCourt[],
    rounds: number,
  ): number {
    const counts = new Map<string, number>();
    for (let i = 0; i < rounds; i++) {
      for (const c of generate(i)) {
        for (const [x, y] of [c.teamA, c.teamB]) {
          const k = x < y ? `${x}|${y}` : `${y}|${x}`;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
    return Math.max(0, ...counts.values());
  }

  it("verdeelt partners gelijkmatiger over 8 spelers / 10 rondes", () => {
    const ids = players(8);
    const rng = seeded(42);

    const history = emptyHistory();
    const smart = maxPartnerRepeat(() => {
      const { courts } = americanoRound(ids, history, rng);
      applyRound(history, courts);
      return courts;
    }, 10);

    // Naïef: elke ronde puur willekeurig, zonder geheugen (het oude gedrag).
    const rng2 = seeded(42);
    const naive = maxPartnerRepeat(() => {
      const shuffled = [...ids].sort(() => rng2() - 0.5);
      const courts: AmericanoCourt[] = [];
      for (let i = 0; i + 3 < shuffled.length; i += 4) {
        courts.push({
          teamA: [shuffled[i], shuffled[i + 1]],
          teamB: [shuffled[i + 2], shuffled[i + 3]],
        });
      }
      return courts;
    }, 10);

    expect(smart).toBeLessThan(naive);
    // Bij 8 spelers heeft iedereen 7 mogelijke partners over 10 rondes; het
    // slimme algoritme houdt de herhaling laag.
    expect(smart).toBeLessThanOrEqual(3);
  });
});

describe("historyFromMatches", () => {
  const teams: Record<string, Team> = {
    tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
    tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  };
  const match = (part: Partial<Match>): Match => ({
    id: "m",
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    played_at: "",
    created_by: null,
    created_at: "",
    group_id: "g",
    round_number: 1,
    score_a: null,
    score_b: null,
    ...part,
  });

  it("telt partners en tegenstanders, en negeert geannuleerde matches", () => {
    const h = historyFromMatches(
      [match({ id: "m1" }), match({ id: "m2", status: "cancelled" })],
      teams,
    );
    expect(h.partner.get("p1|p2")).toBe(1);
    expect(h.partner.get("p3|p4")).toBe(1);
    expect(h.opponent.get("p1|p3")).toBe(1);
    expect(h.opponent.get("p2|p4")).toBe(1);
    // played blijft leeg (bankrotatie is per generatie, niet historisch).
    expect(h.played.size).toBe(0);
  });

  it("een net gegenereerde ronde beïnvloedt de volgende via applyRound", () => {
    const h = emptyHistory();
    applyRound(h, [{ teamA: ["p1", "p2"], teamB: ["p3", "p4"] }]);
    expect(h.partner.get("p1|p2")).toBe(1);
    expect(h.played.get("p1")).toBe(1);
  });
});
