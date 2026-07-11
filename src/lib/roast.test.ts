import { describe, it, expect } from "vitest";
import { roast, ROAST_MIN_MATCHES } from "./roast";
import type { Match, Team } from "./types";

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
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

/** Team A (p1/p2) verliest met de gegeven cijfers. */
const aVerliest = (a: number, b: number) =>
  match({ winner_team_id: "tB", score_a: a, score_b: b });

describe("roast", () => {
  it("geeft null onder het minimum aantal matches", () => {
    const ms = [aVerliest(0, 6), aVerliest(0, 6)];
    expect(ms.length).toBeLessThan(ROAST_MIN_MATCHES);
    expect(roast(ms, teams, "p1", 1)).toBeNull();
  });

  it("roast een speler met genoeg matches en een verliesreeks", () => {
    // 8 nederlagen op rij → boven het minimum, met een verliesreeks.
    const ms = Array.from({ length: 8 }, () => aVerliest(3, 6));
    const tekst = roast(ms, teams, "p1", 0);
    expect(tekst).toBeTruthy();
    expect(typeof tekst).toBe("string");
  });

  it("is deterministisch: zelfde seed → zelfde roast", () => {
    const ms = Array.from({ length: 8 }, () => aVerliest(0, 6));
    expect(roast(ms, teams, "p1", 3)).toBe(roast(ms, teams, "p1", 3));
  });

  it("roast een winnaar niet (geen passende observatie)", () => {
    // 8 nette overwinningen: geen verliesreeks, geen bagels, hoge winrate.
    const ms = Array.from({ length: 8 }, () =>
      match({ winner_team_id: "tA", score_a: 6, score_b: 4 }),
    );
    // Zonder ratings is er ook geen divisie-observatie → null.
    expect(roast(ms, teams, "p1", 0)).toBeNull();
  });
});
