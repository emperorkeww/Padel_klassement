import { describe, it, expect } from "vitest";
import { headToHead, bestPartner } from "./headToHead";
import type { Match, Team } from "../../lib/types";

// Vijf spelers in wisselende duo's, zodat p1 en p2 zowel partners als
// tegenstanders kunnen zijn — of allebei afwezig.
const teams: Record<string, Team> = {
  tAB: { id: "tAB", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tCD: { id: "tCD", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tAC: { id: "tAC", name: null, player1_id: "p1", player2_id: "p3", created_at: "" },
  tBD: { id: "tBD", name: null, player1_id: "p2", player2_id: "p4", created_at: "" },
  tBC: { id: "tBC", name: null, player1_id: "p2", player2_id: "p3", created_at: "" },
  tDE: { id: "tDE", name: null, player1_id: "p4", player2_id: "p5", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  return {
    id: `m${seq}`,
    team_a_id: "tAB",
    team_b_id: "tCD",
    status: "completed",
    winner_team_id: null,
    played_at: "2026-07-01T12:00:00Z",
    created_by: null,
    created_at: "2026-07-01T12:00:00Z",
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

/** Afgewerkte match tussen twee teams; winner "a" | "b" | "draw". */
function done(a: string, b: string, winner: "a" | "b" | "draw"): Match {
  return match({
    team_a_id: a,
    team_b_id: b,
    winner_team_id: winner === "a" ? a : winner === "b" ? b : null,
  });
}

describe("headToHead", () => {
  it("telt winst en verlies als tegenstanders vanuit meId", () => {
    const matches = [
      done("tAC", "tBD", "a"), // p1 wint van p2
      done("tAC", "tBD", "a"), // p1 wint van p2
      done("tBD", "tAC", "a"), // p2 wint van p1
    ];
    const h = headToHead(matches, teams, "p1", "p2");
    expect(h.alsTegenstanders).toEqual({ gewonnen: 2, verloren: 1, gespeeld: 3 });
    expect(h.alsPartners).toEqual({ samen: 0, gewonnen: 0 });
  });

  it("telt een gelijkspel als tegenstanders wel mee in gespeeld", () => {
    const h = headToHead([done("tAC", "tBD", "draw")], teams, "p1", "p2");
    expect(h.alsTegenstanders).toEqual({ gewonnen: 0, verloren: 0, gespeeld: 1 });
  });

  it("telt gezamenlijke matches als partners", () => {
    const matches = [
      done("tAB", "tCD", "a"), // samen gewonnen
      done("tAB", "tCD", "b"), // samen verloren
      done("tAB", "tCD", "draw"), // samen gelijk: telt in samen, niet in gewonnen
    ];
    const h = headToHead(matches, teams, "p1", "p2");
    expect(h.alsPartners).toEqual({ samen: 3, gewonnen: 1 });
    expect(h.alsTegenstanders.gespeeld).toBe(0);
  });

  it("houdt partner- en tegenstandermatches tegelijk uit elkaar", () => {
    const matches = [
      done("tAB", "tCD", "a"), // partners, gewonnen
      done("tAC", "tBD", "b"), // tegenstanders, p2 wint
    ];
    const h = headToHead(matches, teams, "p1", "p2");
    expect(h.alsPartners).toEqual({ samen: 1, gewonnen: 1 });
    expect(h.alsTegenstanders).toEqual({ gewonnen: 0, verloren: 1, gespeeld: 1 });
  });

  it("negeert niet-afgewerkte matches en matches zonder beide spelers", () => {
    const matches = [
      match({ team_a_id: "tAB", team_b_id: "tCD", status: "scheduled" }),
      done("tAC", "tDE", "a"), // p2 deed niet mee
      done("tBC", "tDE", "a"), // p1 deed niet mee
    ];
    const h = headToHead(matches, teams, "p1", "p2");
    expect(h.alsPartners).toEqual({ samen: 0, gewonnen: 0 });
    expect(h.alsTegenstanders).toEqual({ gewonnen: 0, verloren: 0, gespeeld: 0 });
  });

  it("geeft nullen zonder matches", () => {
    const h = headToHead([], teams, "p1", "p2");
    expect(h.alsTegenstanders.gespeeld).toBe(0);
    expect(h.alsPartners.samen).toBe(0);
  });
});

describe("bestPartner", () => {
  it("geeft null als geen enkele partner 3 gezamenlijke matches haalt", () => {
    const matches = [done("tAB", "tCD", "a"), done("tAB", "tCD", "a")];
    expect(bestPartner(matches, teams, "p1")).toBeNull();
  });

  it("telt alleen afgewerkte matches mee voor het minimum", () => {
    const matches = [
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "a"),
      match({ team_a_id: "tAB", team_b_id: "tCD", status: "scheduled" }),
    ];
    expect(bestPartner(matches, teams, "p1")).toBeNull();
  });

  it("kiest de partner met het hoogste winstpercentage", () => {
    const matches = [
      // Met p2: 4 samen, 3 gewonnen (75%).
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "b"),
      // Met p3: 3 samen, 3 gewonnen (100%).
      done("tAC", "tBD", "a"),
      done("tAC", "tBD", "a"),
      done("tAC", "tBD", "a"),
    ];
    expect(bestPartner(matches, teams, "p1")).toEqual({
      partnerId: "p3",
      samen: 3,
      gewonnen: 3,
    });
  });

  it("kiest bij gelijk percentage de partner met de meeste matches", () => {
    const matches = [
      // Met p2: 2 van de 4 (50%).
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "b"),
      done("tAB", "tCD", "b"),
      // Met p3: 3 van de 6 (50%), meer matches → wint de tie-break.
      done("tAC", "tBD", "a"),
      done("tAC", "tBD", "a"),
      done("tAC", "tBD", "a"),
      done("tAC", "tBD", "b"),
      done("tAC", "tBD", "b"),
      done("tAC", "tBD", "b"),
    ];
    expect(bestPartner(matches, teams, "p1")).toEqual({
      partnerId: "p3",
      samen: 6,
      gewonnen: 3,
    });
  });

  it("telt een gelijkspel niet als winst", () => {
    const matches = [
      done("tAB", "tCD", "a"),
      done("tAB", "tCD", "draw"),
      done("tAB", "tCD", "draw"),
    ];
    expect(bestPartner(matches, teams, "p1")).toEqual({
      partnerId: "p2",
      samen: 3,
      gewonnen: 1,
    });
  });

  it("geeft null zonder matches", () => {
    expect(bestPartner([], teams, "p1")).toBeNull();
  });
});
