import { describe, it, expect } from "vitest";
import {
  chemie,
  CHEMIE_HOOG,
  CHEMIE_LAAG,
  MIN_SAMEN_CHEMIE,
} from "@/features/matches/chemistry";
import type { Match, RatingPoint, Team } from "@/types";

// Mini-fixtures: duo p1+p2 (team t-ab) tegen p3+p4 (team t-cd).
function team(id: string, p1: string, p2: string | null): Team {
  return { id, name: null, player1_id: p1, player2_id: p2, created_at: "" };
}
const TEAMS: Record<string, Team> = {
  "t-ab": team("t-ab", "p1", "p2"),
  "t-cd": team("t-cd", "p3", "p4"),
  "t-a": team("t-a", "p1", null),
  "t-c": team("t-c", "p3", null),
};

function match(id: string, status: Match["status"] = "completed"): Match {
  return {
    id,
    team_a_id: "t-ab",
    team_b_id: "t-cd",
    status,
    winner_team_id: status === "completed" ? "t-ab" : null,
    played_at: null,
    created_by: null,
    created_at: "",
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    format: "2v2",
  };
}

function punt(matchId: string, delta: number): RatingPoint {
  return {
    match_id: matchId,
    rating_before: 1000,
    rating_after: 1000 + delta,
    delta,
    played_at: "",
  };
}

/** n afgewerkte duo-matches met per match dezelfde delta voor p1. */
function reeks(n: number, delta: number) {
  const matches = Array.from({ length: n }, (_, i) => match(`m${i}`));
  const histories: Record<string, RatingPoint[]> = {
    p1: matches.map((m) => punt(m.id, delta)),
  };
  return { matches, histories };
}

describe("chemie", () => {
  it("is hoog bij een gemiddelde delta op of boven de grens", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, CHEMIE_HOOG);
    expect(chemie(matches, TEAMS, histories, "p1", "p2")).toEqual({
      samen: MIN_SAMEN_CHEMIE,
      gemiddeldeDelta: CHEMIE_HOOG,
      niveau: "hoog",
    });
  });

  it("is laag bij een gemiddelde delta op of onder de grens", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, CHEMIE_LAAG);
    expect(chemie(matches, TEAMS, histories, "p1", "p2")?.niveau).toBe("laag");
  });

  it("is midden tussen de grenzen in", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, 0);
    expect(chemie(matches, TEAMS, histories, "p1", "p2")?.niveau).toBe(
      "midden",
    );
  });

  it("is onbekend onder de drempel, ook met een sterk gemiddelde", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE - 1, 12);
    expect(chemie(matches, TEAMS, histories, "p1", "p2")).toEqual({
      samen: MIN_SAMEN_CHEMIE - 1,
      gemiddeldeDelta: 12,
      niveau: "onbekend",
    });
  });

  it("telt geplande matches niet mee", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, CHEMIE_HOOG);
    matches.push(match("m-plan", "scheduled"));
    expect(chemie(matches, TEAMS, histories, "p1", "p2")?.samen).toBe(
      MIN_SAMEN_CHEMIE,
    );
  });

  it("telt een gelijkspel gewoon mee (delta bestaat ook dan)", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, 4);
    matches[0].winner_team_id = null;
    expect(chemie(matches, TEAMS, histories, "p1", "p2")?.samen).toBe(
      MIN_SAMEN_CHEMIE,
    );
  });

  it("geeft null zonder partner (1v1) en bij a === b", () => {
    const { matches, histories } = reeks(3, 4);
    expect(chemie(matches, TEAMS, histories, "p1", null)).toBeNull();
    expect(chemie(matches, TEAMS, histories, "p1", "p1")).toBeNull();
  });

  it("slaat matches met een onbekend team over", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, 4);
    const kaal: Record<string, Team> = { "t-ab": TEAMS["t-ab"] };
    matches.push({ ...match("m-x"), team_a_id: "t-weg", team_b_id: "t-cd" });
    expect(chemie(matches, kaal, histories, "p1", "p2")?.samen).toBe(
      MIN_SAMEN_CHEMIE,
    );
  });

  it("valt terug op de historie van de partner als die van a ontbreekt", () => {
    const { matches } = reeks(MIN_SAMEN_CHEMIE, 0);
    const histories: Record<string, RatingPoint[]> = {
      p2: matches.map((m) => punt(m.id, 6)),
    };
    expect(chemie(matches, TEAMS, histories, "p1", "p2")).toEqual({
      samen: MIN_SAMEN_CHEMIE,
      gemiddeldeDelta: 6,
      niveau: "hoog",
    });
  });

  it("telt matches zonder delta wél als samen, niet in het gemiddelde", () => {
    const { matches, histories } = reeks(MIN_SAMEN_CHEMIE, 6);
    // Eén extra gezamenlijke match zonder history-rij bij beiden.
    matches.push(match("m-zonder"));
    const c = chemie(matches, TEAMS, histories, "p1", "p2");
    expect(c?.samen).toBe(MIN_SAMEN_CHEMIE + 1);
    expect(c?.gemiddeldeDelta).toBe(6);
  });

  it("legt de grenzen precies op de constanten (inclusief)", () => {
    const hoog = reeks(MIN_SAMEN_CHEMIE, CHEMIE_HOOG);
    const laag = reeks(MIN_SAMEN_CHEMIE, CHEMIE_LAAG);
    expect(chemie(hoog.matches, TEAMS, hoog.histories, "p1", "p2")?.niveau).toBe(
      "hoog",
    );
    expect(chemie(laag.matches, TEAMS, laag.histories, "p1", "p2")?.niveau).toBe(
      "laag",
    );
  });
});
