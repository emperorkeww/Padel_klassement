import { describe, it, expect } from "vitest";
import { bijnaam } from "@/features/profiles/nickname";
import type { Match, Team } from "@/types";

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
    format: "2v2",
    ...part,
  };
}

describe("bijnaam", () => {
  it("geeft altijd een bijnaam, ook zonder matches", () => {
    expect(typeof bijnaam([], teams, "p1")).toBe("string");
    expect(bijnaam([], teams, "p1").length).toBeGreaterThan(0);
  });

  it("is deterministisch per speler-id", () => {
    const ms = [match({ winner_team_id: "tA", score_a: 6, score_b: 0 })];
    expect(bijnaam(ms, teams, "p1")).toBe(bijnaam(ms, teams, "p1"));
  });

  it("kent een dominante speler een 'winnaars'-bijnaam toe", () => {
    // Tien keer met 6–0 winnen: alleen winnaars-kandidaten passen, geen
    // 'Underdog' of 'Rookie'.
    const ms = Array.from({ length: 10 }, () =>
      match({ winner_team_id: "tA", score_a: 6, score_b: 0 }),
    );
    const naam = bijnaam(ms, teams, "p1");
    expect(["De Beul van Baan 1 🔪", "De Bagelbakker 🥯", "De Sloopkogel 💥", "De Glazen Wand 🛡️"]).toContain(naam);
    expect(naam).not.toBe("Sponsor van de Tegenstander 💸");
    expect(naam).not.toBe("De Groene Banaan 🍌");
  });
});
