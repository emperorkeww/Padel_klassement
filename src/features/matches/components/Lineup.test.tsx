import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Match, PlayerRating, RatingPoint, Team } from "@/types";

// Lineup zelf praat niet met supabase, maar displayName leeft in profiles/api
// dat de client bij import aanmaakt, en de kaart-achterkant laadt zijn eigen
// (gecachte) matches — dus mocken, met de standaard-fixturetabellen.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ tables: TABLES }) };
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
    dictatorId: null as string | null,
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <Lineup {...props} />
    </MemoryRouter>,
  );
}

// De legenda in de uitleg gebruikt dezelfde lijnklassen; alleen lijnen op het
// veld zelf staan binnen een .lineup__helft.
const veldLijn = (container: HTMLElement, extra = "") =>
  container.querySelectorAll(`.lineup__helft .lineup__lijn${extra}`);

describe("<Lineup />", () => {
  it("toont hoge chemie voor team A en lage voor team B, met de waarde als tekst", () => {
    const { container } = renderLineup();
    // p1+p2 halen gemiddeld +4 over 5 matches, p3+p4 −4 (zie fixtures).
    expect(veldLijn(container, "--hoog")).toHaveLength(1);
    expect(veldLijn(container, "--laag")).toHaveLength(1);
    expect(screen.getByText("+4 Elo")).toBeInTheDocument();
    expect(screen.getByText("−4 Elo")).toBeInTheDocument();
    expect(screen.getAllByText(/\(5 samen\)/)).toHaveLength(2);
  });

  it("velt geen oordeel onder de drempel: grijze lijn en 'te weinig samen'", () => {
    const { container } = renderLineup({
      matchesA: [MATCH_DONE] as Match[],
      matchesB: [MATCH_DONE] as Match[],
    });
    expect(veldLijn(container, "--onbekend")).toHaveLength(2);
    expect(screen.getAllByText(/nog te weinig samen \(1\)/i)).toHaveLength(2);
  });

  it("toont bij 1v1 één kaart per helft, zonder chemielijn of -badge", () => {
    const { container } = renderLineup({
      match: MATCH_SINGLES as Match,
      matchesA: [MATCH_SINGLES] as Match[],
      matchesB: [MATCH_SINGLES] as Match[],
    });
    expect(container.querySelectorAll(".lineup-kaart")).toHaveLength(2);
    expect(veldLijn(container)).toHaveLength(0);
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

  it("draait de kaart om naar de statistieken en weer terug", async () => {
    const { container } = renderLineup();
    const kaart = container.querySelector(".lineup-kaart");
    expect(kaart).not.toHaveClass("is-omgedraaid");

    await userEvent.click(
      screen.getByRole("button", { name: /statistieken van alice anders/i }),
    );
    expect(kaart).toHaveClass("is-omgedraaid");
    // Vorm en balans komen uit de gemockte tabellen (m-done: winst voor p1).
    expect(await screen.findByText("1W · 0G · 0V")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /profiel/i })).toHaveAttribute(
      "href",
      "/spelers/p1",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /draai de kaart terug/i }),
    );
    expect(kaart).not.toHaveClass("is-omgedraaid");
  });

  it("legt het veld uit in een uitklapbare uitleg met lijn-legenda", () => {
    const { container } = renderLineup();
    expect(screen.getByText(/wat zie ik hier\?/i)).toBeInTheDocument();
    expect(screen.getByText(/nog te weinig samen"/i)).toBeInTheDocument();
    // De legenda toont alle vier de niveaus als voorbeeldlijn.
    expect(
      container.querySelectorAll(".lineup__lijn--voorbeeld"),
    ).toHaveLength(4);
  });

  it("toont GOAT voor niet-dictator met dictator-band rating (#621)", () => {
    // p1 heeft in de fixture een rating van 1012 (Wannabe), maar we overschrijven
    // met een dictator-band rating (1600+) voor een niet-dictator.
    const rating1600plus = {
      ...RATINGS_MAP,
      p1: { ...RATINGS_MAP.p1, rating: 1650 },
    };
    const { container } = renderLineup({
      ratings: rating1600plus,
      dictatorId: "p2", // p2 is de dictator, p1 niet
    });
    // p1 heeft rating 1650 maar is geen dictator → moet GOAT (legende) tonen,
    // niet dictator. De kaart-kleur voor GOAT is "legende".
    const p1Kaart = container.querySelector(".lineup-kaart") as HTMLElement;
    expect(p1Kaart).toHaveClass("fut-kaart--legende");
    expect(p1Kaart).not.toHaveClass("fut-kaart--dictator");
  });

  it("toont dictator-special voor zittende dictator (#621)", () => {
    // p1 is de dictator met een dictator-band rating
    const rating1600plus = {
      ...RATINGS_MAP,
      p1: { ...RATINGS_MAP.p1, rating: 1650 },
    };
    const { container } = renderLineup({
      ratings: rating1600plus,
      dictatorId: "p1", // p1 is de dictator
    });
    // p1 heeft rating 1650 en IS de dictator → moet dictator-special tonen
    const p1Kaart = container.querySelector(".lineup-kaart") as HTMLElement;
    expect(p1Kaart).toHaveClass("fut-kaart--dictator");
    expect(p1Kaart).not.toHaveClass("fut-kaart--legende");
  });
});
