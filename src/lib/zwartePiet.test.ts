import { describe, it, expect } from "vitest";
import { zwartePiet } from "./zwartePiet";
import type { MatchRatings } from "./maandpias";
import type { Match, RatingPoint, Team } from "@/types";

// Twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  const ts = new Date(2026, 0, 1, 12, seq).toISOString();
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    played_at: ts,
    created_by: null,
    created_at: ts,
    group_id: "g1",
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

/** B wint → team A (p1/p2) gaat af, met de gegeven scores. */
const aVerliest = (a: number, b: number) =>
  match({ winner_team_id: "tB", score_a: a, score_b: b });
/** A wint → team B (p3/p4) gaat af. */
const bVerliest = (a: number, b: number) =>
  match({ winner_team_id: "tA", score_a: a, score_b: b });

/** rating_history-map voor de choke-detectie: elke speler krijgt één punt. */
function ratings(matchId: string, byPlayer: Record<string, number>): Map<string, MatchRatings> {
  const inner: MatchRatings = new Map();
  for (const [pid, before] of Object.entries(byPlayer)) {
    inner.set(pid, { match_id: matchId, rating_before: before, rating_after: before, delta: 0, played_at: "" } as RatingPoint);
  }
  return new Map([[matchId, inner]]);
}

describe("zwartePiet — basis", () => {
  it("null zonder matches", () => {
    expect(zwartePiet([], teams)).toBeNull();
  });

  it("null bij een nipt verlies onder alle drempels", () => {
    expect(zwartePiet([aVerliest(5, 6)], teams)).toBeNull();
  });

  it("wijst de flopper aan bij een afdroging (tie-break laagste id)", () => {
    const p = zwartePiet([aVerliest(2, 6)], teams);
    expect(p?.holderId).toBe("p1");
    expect(p?.reden).toBe("afdroging");
    expect(p?.fromId).toBeNull();
    expect(p?.since).toBe("2026-01-01");
  });

  it("kiest binnen een speler de ergste reden (bagel boven afdroging)", () => {
    const p = zwartePiet([aVerliest(0, 6)], teams);
    expect(p?.reden).toBe("bagel");
  });
});

describe("zwartePiet — recency & verlossing", () => {
  it("elke nieuwe afgang pakt de Piet af", () => {
    const p = zwartePiet([aVerliest(2, 6), bVerliest(6, 2)], teams);
    expect(p?.holderId).toBe("p3"); // team B ging als laatste af
    expect(p?.fromId).toBe("p1"); // pakte 'm af van p1
  });

  it("de drager houdt 'm als hij opnieuw flopt (since blijft lopen)", () => {
    const m1 = aVerliest(2, 6);
    const m2 = aVerliest(1, 6);
    const p = zwartePiet([m1, m2], teams);
    expect(p?.holderId).toBe("p1");
    expect(p?.matchId).toBe(m1.id); // overname was m1, niet m2
    expect(p?.since).toBe("2026-01-01");
  });

  it("de drager wordt verlost bij winst → Piet vrij", () => {
    // p1 pakt de Piet (m1), dan wint team A nipt (m2: B verliest met 1, geen flop).
    const p = zwartePiet([aVerliest(2, 6), bVerliest(6, 5)], teams);
    expect(p).toBeNull();
  });

  it("na verlossing gaat de Piet naar de eerstvolgende flopper", () => {
    const p = zwartePiet(
      [aVerliest(2, 6), bVerliest(6, 5), bVerliest(6, 2)], teams,
    );
    expect(p?.holderId).toBe("p3");
    expect(p?.fromId).toBeNull(); // Piet was vrij na de verlossing
  });
});

describe("zwartePiet — reeks & choke", () => {
  it("zwarte-reeks pakt pas op de 3e nederlaag", () => {
    // Drie nipte verliezen op rij (marge 1, geen afdroging/bagel).
    const reeks = [aVerliest(5, 6), aVerliest(5, 6), aVerliest(5, 6)];
    const p = zwartePiet(reeks, teams);
    expect(p?.reden).toBe("zwarte-reeks");
    expect(p?.matchId).toBe(reeks[2].id); // pas de derde
  });

  it("herkent een choke: favoriet verliest nipt", () => {
    const m = aVerliest(5, 6); // A verliest nipt
    const rb = ratings(m.id, { p1: 1300, p2: 1300, p3: 1000, p4: 1000 });
    const p = zwartePiet([m], teams, rb);
    expect(p?.reden).toBe("choke");
    expect(p?.holderId).toBe("p1");
  });
});
