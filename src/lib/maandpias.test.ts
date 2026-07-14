import { describe, it, expect } from "vitest";
import { bepaalPias, AFDROGING_DREMPEL, type MatchRatings } from "./maandpias";
import type { Match, RatingPoint, Team } from "@/types";

// Vier spelers, twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

// Periode = de hele maand januari 2026 (lokale tijd), waarin de matches vallen.
const period = { start: new Date(2026, 0, 1), end: new Date(2026, 1, 1) };

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  // Strikt oplopende tijdstempels binnen januari 2026 (lokale tijd).
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

/** B wint met scores → team A (p1/p2) gaat af. */
const aVerliest = (score_a: number, score_b: number) =>
  match({ winner_team_id: "tB", score_a, score_b });

describe("bepaalPias — geen afgang", () => {
  it("geeft null zonder matches", () => {
    expect(bepaalPias([], teams, period)).toBeNull();
  });

  it("geeft null bij een nipt verlies onder alle drempels", () => {
    // A verliest met 1 game verschil, één keer: geen afdroging/reeks/bagel.
    const pias = bepaalPias([aVerliest(5, 6)], teams, period);
    expect(pias).toBeNull();
  });
});

describe("bepaalPias — redenen", () => {
  it("herkent een afdroging vanaf de drempel", () => {
    const pias = bepaalPias([aVerliest(2, 6)], teams, period);
    expect(pias?.reden).toBe("afdroging");
    // p1 of p2 (team A) is de klos; tie-break kiest de laagste id → p1.
    expect(pias?.playerId).toBe("p1");
    expect(6 - 2).toBeGreaterThanOrEqual(AFDROGING_DREMPEL);
  });

  it("laat een bagel zwaarder wegen dan een gewone afdroging", () => {
    // p1/p2 slikken een 0–6 bagel; dat moet de bagel-reden opleveren.
    const pias = bepaalPias([aVerliest(0, 6)], teams, period);
    expect(pias?.reden).toBe("bagel");
  });

  it("herkent een zwarte reeks van 3 verliezen", () => {
    // Drie nipte verliezen op rij: geen afdroging/bagel, wél een reeks.
    const pias = bepaalPias(
      [aVerliest(4, 6), aVerliest(5, 6), aVerliest(3, 6)],
      teams,
      period,
    );
    expect(pias?.reden).toBe("zwarte-reeks");
    expect(pias?.detail).toContain("3");
  });

  it("negeert matches buiten de periode", () => {
    const buiten = match({
      winner_team_id: "tB",
      score_a: 0,
      score_b: 6,
      played_at: new Date(2025, 11, 15, 12).toISOString(),
    });
    expect(bepaalPias([buiten], teams, period)).toBeNull();
  });
});

describe("bepaalPias — choke", () => {
  it("markeert een favoriet die verliest wanneer ratings meegegeven zijn", () => {
    // A is torenhoog favoriet (1400 vs 900) maar verliest nipt: geen andere
    // reden haalt de drempel, dus de choke moet overblijven.
    const m = aVerliest(5, 6);
    const punt = (before: number): RatingPoint => ({
      match_id: m.id,
      rating_before: before,
      rating_after: before,
      delta: 0,
      played_at: m.played_at!,
    });
    const ratings: Map<string, MatchRatings> = new Map([
      [
        m.id,
        new Map([
          ["p1", punt(1400)],
          ["p2", punt(1400)],
          ["p3", punt(900)],
          ["p4", punt(900)],
        ]),
      ],
    ]);
    const pias = bepaalPias([m], teams, period, ratings);
    expect(pias?.reden).toBe("choke");
  });
});