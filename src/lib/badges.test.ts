import { describe, it, expect } from "vitest";
import { deriveBadges, REUZENDODER_DREMPEL } from "./badges";
import type { Badge } from "./badges";
import type { Match, PlayerRating, Team } from "./types";

// Vier spelers, twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  // Strikt oplopende tijdstempels: de volgorde in de array is de speelvolgorde.
  const ts = new Date(Date.UTC(2026, 0, 1) + seq * 60_000).toISOString();
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

const win = () => match({ winner_team_id: "tA" });
const loss = () => match({ winner_team_id: "tB" });

function ratingsFor(perPlayer: Record<string, number>): Record<string, PlayerRating> {
  return Object.fromEntries(
    Object.entries(perPlayer).map(([id, rating]) => [
      id,
      { player_id: id, rating, games: 1, updated_at: "" },
    ]),
  );
}

function badge(badges: Badge[], id: string): Badge {
  const b = badges.find((x) => x.id === id);
  if (!b) throw new Error(`badge ${id} ontbreekt`);
  return b;
}

describe("deriveBadges — lege input", () => {
  it("geeft de volledige set terug, niets behaald, voortgang 0", () => {
    const badges = deriveBadges([], teams, "p1");
    expect(badges).toHaveLength(9);
    expect(badges.every((b) => !b.behaald)).toBe(true);
    expect(badge(badges, "matches-10").voortgang).toEqual({ nu: 0, doel: 10 });
    expect(badge(badges, "reeks-3").voortgang).toEqual({ nu: 0, doel: 3 });
  });
});

describe("deriveBadges — mijlpalen", () => {
  it("telt alleen afgewerkte matches waarin de speler meedeed", () => {
    const gepland = match({ status: "scheduled", winner_team_id: null });
    const zonderMij = match({
      team_a_id: "tX",
      team_b_id: "tB",
      winner_team_id: "tB",
    });
    const badges = deriveBadges([loss(), gepland, zonderMij], teams, "p1");
    expect(badge(badges, "matches-10").voortgang).toEqual({ nu: 1, doel: 10 });
  });

  it("kent 'Vaste klant' toe bij precies 10 matches, de rest nog niet", () => {
    const tien = Array.from({ length: 10 }, loss);
    const badges = deriveBadges(tien, teams, "p1");
    expect(badge(badges, "matches-10").behaald).toBe(true);
    expect(badge(badges, "matches-25").behaald).toBe(false);
    expect(badge(badges, "matches-25").voortgang).toEqual({ nu: 10, doel: 25 });
  });

  it("blijft niet-behaald bij 9 matches", () => {
    const negen = Array.from({ length: 9 }, loss);
    expect(badge(deriveBadges(negen, teams, "p1"), "matches-10").behaald).toBe(false);
  });

  it("kent alle mijlpalen toe bij 100 matches", () => {
    const honderd = Array.from({ length: 100 }, win);
    const badges = deriveBadges(honderd, teams, "p1");
    for (const id of ["matches-10", "matches-25", "matches-50", "matches-100"])
      expect(badge(badges, id).behaald).toBe(true);
  });
});

describe("deriveBadges — winreeksen", () => {
  it("kent bij een reeks van exact 5 'Hattrick' en 'On fire' toe, 'Onstuitbaar' niet", () => {
    // Verlies errond: de reeks is exact 5 en niet de huidige reeks.
    const matches = [loss(), win(), win(), win(), win(), win(), loss()];
    const badges = deriveBadges(matches, teams, "p1");
    expect(badge(badges, "reeks-3").behaald).toBe(true);
    expect(badge(badges, "reeks-5").behaald).toBe(true);
    expect(badge(badges, "reeks-10").behaald).toBe(false);
    expect(badge(badges, "reeks-10").voortgang).toEqual({ nu: 5, doel: 10 });
  });

  it("kent geen reeksbadge toe bij 2 winsten op rij", () => {
    const badges = deriveBadges([win(), win(), loss()], teams, "p1");
    expect(badge(badges, "reeks-3").behaald).toBe(false);
    expect(badge(badges, "reeks-3").voortgang).toEqual({ nu: 2, doel: 3 });
  });
});

describe("deriveBadges — eerste overwinning", () => {
  it("wordt behaald na één winst en heeft geen telbare voortgang", () => {
    const met = deriveBadges([win()], teams, "p1");
    const zonder = deriveBadges([loss()], teams, "p1");
    expect(badge(met, "eerste-overwinning").behaald).toBe(true);
    expect(badge(met, "eerste-overwinning").voortgang).toBeUndefined();
    expect(badge(zonder, "eerste-overwinning").behaald).toBe(false);
  });
});

describe("deriveBadges — reuzendoder", () => {
  const winst = [win()];

  it("wordt behaald bij winst tegen een team dat gemiddeld exact de drempel hoger staat", () => {
    const ratings = ratingsFor({
      p1: 1000,
      p2: 1000,
      p3: 1000 + REUZENDODER_DREMPEL,
      p4: 1000 + REUZENDODER_DREMPEL,
    });
    expect(badge(deriveBadges(winst, teams, "p1", ratings), "reuzendoder").behaald).toBe(true);
  });

  it("blijft niet-behaald nét onder de drempel", () => {
    const ratings = ratingsFor({
      p1: 1000,
      p2: 1000,
      p3: 1000 + REUZENDODER_DREMPEL,
      p4: 1000 + REUZENDODER_DREMPEL - 1,
    });
    expect(badge(deriveBadges(winst, teams, "p1", ratings), "reuzendoder").behaald).toBe(false);
  });

  it("telt verliezen tegen reuzen niet mee", () => {
    const ratings = ratingsFor({ p1: 1000, p2: 1000, p3: 1200, p4: 1200 });
    expect(badge(deriveBadges([loss()], teams, "p1", ratings), "reuzendoder").behaald).toBe(false);
  });

  it("blijft niet-behaald zonder ratings of met een ontbrekende rating", () => {
    expect(badge(deriveBadges(winst, teams, "p1"), "reuzendoder").behaald).toBe(false);
    expect(badge(deriveBadges(winst, teams, "p1", {}), "reuzendoder").behaald).toBe(false);
    // p4 heeft geen rating → tegenteam-gemiddelde onbekend → telt niet.
    const deels = ratingsFor({ p1: 1000, p2: 1000, p3: 1300 });
    expect(badge(deriveBadges(winst, teams, "p1", deels), "reuzendoder").behaald).toBe(false);
  });
});
