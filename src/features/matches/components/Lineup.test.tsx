import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Match, PlayerRating, RatingPoint, Team } from "@/types";

// Lineup zelf praat niet met supabase, maar displayName leeft in profiles/api
// dat de client bij import aanmaakt — dus toch mocken.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  return { supabase: makeSupabaseMock() };
});

import { Lineup } from "./Lineup";
import {
  LINEUP_HISTORY,
  LINEUP_MATCHES,
  MATCH_DONE,
  MATCH_PLANNED,
  MATCH_SINGLES,
  PLAYER_RATINGS,
  PROFILES,
  TEAMS,
} from "@/test/fixtures";

const TEAMS_MAP = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
) as Record<string, Team>;
const PROFILES_MAP = Object.fromEntries(PROFILES.map((p) => [p.id, p]));
const RATINGS_MAP = Object.fromEntries(
  PLAYER_RATINGS.map((r) => [r.player_id, r]),
) as Record<string, PlayerRating>;
// Chemie-historie per speler, zoals getAllRatingHistories hem teruggeeft.
const HISTORIES = LINEUP_HISTORY.reduce<Record<string, RatingPoint[]>>(
  (acc, { player_id, ...punt }) => {
    (acc[player_id] ??= []).push(punt);
    return acc;
  },
  {},
);

function renderLineup(overrides: Partial<Parameters<typeof Lineup>[0]> = {}) {
  const props = {
    match: MATCH_DONE as Match,
    teams: TEAMS_MAP,
    profiles: PROFILES_MAP,
    histories: HISTORIES,
    ratings: RATINGS_MAP,
    matchesA: LINEUP_MATCHES as Match[],
    matchesB: LINEUP_MATCHES as Match[],
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <Lineup {...props} />
    </MemoryRouter>,
  );
}

describe("<Lineup />", () => {
  it("toont hoge chemie voor team A en lage voor team B, met de waarde als tekst", () => {
    const { container } = renderLineup();
    // p1+p2 halen gemiddeld +4 over 5 matches, p3+p4 −4 (zie fixtures).
    expect(container.querySelector(".lineup__lijn--hoog")).not.toBeNull();
    expect(container.querySelector(".lineup__lijn--laag")).not.toBeNull();
    expect(screen.getByText("+4 Elo")).toBeInTheDocument();
    expect(screen.getByText("−4 Elo")).toBeInTheDocument();
    expect(screen.getAllByText(/\(5 samen\)/)).toHaveLength(2);
  });

  it("velt geen oordeel onder de drempel: grijze lijn en 'te weinig samen'", () => {
    const { container } = renderLineup({
      matchesA: [MATCH_DONE] as Match[],
      matchesB: [MATCH_DONE] as Match[],
    });
    expect(
      container.querySelectorAll(".lineup__lijn--onbekend"),
    ).toHaveLength(2);
    expect(screen.getAllByText(/nog te weinig samen \(1\)/i)).toHaveLength(2);
  });

  it("toont bij 1v1 één kaart per helft, zonder chemielijn of -badge", () => {
    const { container } = renderLineup({
      match: MATCH_SINGLES as Match,
      matchesA: [MATCH_SINGLES] as Match[],
      matchesB: [MATCH_SINGLES] as Match[],
    });
    expect(container.querySelectorAll(".lineup-kaart")).toHaveLength(2);
    expect(container.querySelector(".lineup__lijn")).toBeNull();
    expect(container.querySelector(".lineup__chemie")).toBeNull();
    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
    expect(screen.getByText("Carol Claes")).toBeInTheDocument();
  });

  it("valt voor de kaart-Elo terug op de huidige rating bij een geplande match", () => {
    // Geen history-rij voor m-plan; p1 en p2 staan op 1012 in player_ratings.
    renderLineup({
      match: MATCH_PLANNED as Match,
      histories: {},
      matchesA: [],
      matchesB: [],
    });
    expect(screen.getAllByText("1012")).toHaveLength(2);
    expect(screen.getAllByText("988")).toHaveLength(2);
  });

  it("crasht niet op een ontbrekend profiel en toont 'Onbekend'", () => {
    const zonderBob = { ...PROFILES_MAP };
    delete zonderBob.p2;
    renderLineup({ profiles: zonderBob });
    expect(screen.getByText("Onbekend")).toBeInTheDocument();
    expect(screen.getByText("Alice Anders")).toBeInTheDocument();
  });
});
