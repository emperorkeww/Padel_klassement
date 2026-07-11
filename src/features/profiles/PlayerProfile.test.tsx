import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";
import { invalidateAll } from "../../lib/queryCache";
import { PROFILES, TEAMS, MATCH_DONE, MATCH_PLANNED } from "../../test/fixtures";

// De mock leest de tabellen pas bij elke query uit, dus per test kunnen we
// `state.tables` hermuteren (o.a. de bekeken speler vooraan zetten, want
// maybeSingle geeft altijd de eerste rij terug).
const state = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  return {
    supabase: makeSupabaseMock({
      session: { user: { id: "p1", email: "alice@example.com" } },
      tables: state.tables,
    }),
  };
});

import PlayerProfile from "./PlayerProfile";

// Extra duo's bovenop de fixtures: alice speelde ook één keer mét carol
// tégen bob & dave. Zo zijn alice en bob partners én tegenstanders geweest.
const T_AC = { id: "t-ac", name: null, player1_id: "p1", player2_id: "p3", created_at: "" };
const T_BD = { id: "t-bd", name: null, player1_id: "p2", player2_id: "p4", created_at: "" };

// Team alice & bob: 3 afgewerkte matches, 2 gewonnen (67%).
const M_SAMEN_2 = { ...MATCH_DONE, id: "m-samen2", group_id: null, round_number: null };
const M_SAMEN_3 = { ...MATCH_DONE, id: "m-samen3", winner_team_id: "t-cd", score_a: 3, score_b: 6, group_id: null, round_number: null };
// Alice tegen bob: alice & carol winnen.
const M_TEGEN = { ...MATCH_DONE, id: "m-tegen", team_a_id: "t-ac", team_b_id: "t-bd", winner_team_id: "t-ac", group_id: null, round_number: null };

// Erik speelde nog nooit met of tegen alice.
const P_ERIK = { id: "p5", username: "erik", full_name: "Erik Evers", avatar_url: null, created_at: "" };

function setTables(viewedId: string) {
  const profiles = [...PROFILES, P_ERIK];
  state.tables.profiles = [
    ...profiles.filter((p) => p.id === viewedId),
    ...profiles.filter((p) => p.id !== viewedId),
  ];
  state.tables.player_standings = [
    { player_id: viewedId, username: "x", full_name: null, played: 4, won: 2, drawn: 0, lost: 2, points: 6, goal_diff: 0 },
  ];
  state.tables.teams = [...TEAMS, T_AC, T_BD];
  state.tables.matches = [MATCH_DONE, M_SAMEN_2, M_SAMEN_3, M_TEGEN, MATCH_PLANNED];
  state.tables.player_ratings = [];
  state.tables.rating_history = [];
}

function renderProfile(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/spelers/${id}`]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/spelers/:id" element={<PlayerProfile />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // De querycache is module-globaal; leegmaken zodat elke test verse
  // (per test gemuteerde) tabellen ziet.
  invalidateAll();
});

describe("<PlayerProfile />", () => {
  it("toont naam en statistieken van de speler", async () => {
    setTables("p2");
    state.tables.player_ratings = [
      { player_id: "p2", rating: 1012, games: 1, updated_at: "" },
    ];
    renderProfile("p2");
    expect(
      await screen.findByRole("heading", { name: /bob boers/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("6")).toBeInTheDocument();
    // Tier-badge (#127) in de hero: rating 1012 = Goud III, gedimd (1 match).
    expect(await screen.findByText("Goud III")).toHaveClass("is-dim");
  });

  it("toont de onderlinge balans op andermans profiel", async () => {
    setTables("p2");
    renderProfile("p2");
    expect(await screen.findByText("Onderling")).toBeInTheDocument();
    // Als tegenstanders: alice won 1 van de 1 (m-tegen).
    expect(screen.getByText(/jij won 1 van de 1/i)).toBeInTheDocument();
    // Als partners: 3 matches, 2 gewonnen → 67%. De geplande match telt niet.
    expect(screen.getByText(/3 matches · 67% gewonnen/)).toBeInTheDocument();
  });

  it("toont het beste maatje met winstpercentage en profiellink", async () => {
    setTables("p2");
    renderProfile("p2");
    expect(await screen.findByText("Beste maatje")).toBeInTheDocument();
    // Bobs beste maatje is alice: 3 samen, 2 gewonnen (dave haalt het minimum niet).
    expect(screen.getByText(/67% samen gewonnen \(3 matches\)/)).toBeInTheDocument();
  });

  it("verbergt de Onderling-sectie op het eigen profiel", async () => {
    setTables("p1");
    renderProfile("p1");
    expect(
      await screen.findByRole("heading", { name: /alice anders/i }),
    ).toBeInTheDocument();
    // Beste maatje staat er wél (ook op het eigen profiel)...
    expect(await screen.findByText("Beste maatje")).toBeInTheDocument();
    // ...maar de balans met jezelf niet.
    expect(screen.queryByText("Onderling")).not.toBeInTheDocument();
  });

  it("meldt sober dat er nog geen gezamenlijke matches zijn", async () => {
    setTables("p5");
    renderProfile("p5");
    expect(
      await screen.findByRole("heading", { name: /erik evers/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/nog geen gezamenlijke matches/i),
    ).toBeInTheDocument();
  });

  it("opent Wrapped vanaf het eigen profiel, met deelbare kaarten", async () => {
    // Vast "nu" in het eindejaarsvenster: beschikbaar jaar = 2026, waarin de
    // fixture-matches (juli 2026) vallen. Alleen Date faken.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 20, 12) });
    try {
      setTables("p1");
      renderProfile("p1");
      const knop = await screen.findByRole("button", { name: /wrapped 2026/i });
      fireEvent.click(knop);
      const dialog = await screen.findByRole("dialog", { name: /wrapped 2026/i });
      // Elke kaart heeft een eigen deelknop; navigatie met dots aanwezig.
      expect(
        within(dialog).getAllByRole("button", { name: /deel/i }).length,
      ).toBeGreaterThan(0);
      expect(
        within(dialog).getAllByRole("button", { name: /kaart \d+ van/i }).length,
      ).toBeGreaterThan(2);
      // Sluiten geeft de focus terug aan de pagina.
      fireEvent.click(within(dialog).getByRole("button", { name: "Sluiten" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("verbergt de Wrapped-knop op andermans profiel", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 20, 12) });
    try {
      setTables("p2");
      renderProfile("p2");
      expect(
        await screen.findByRole("heading", { name: /bob boers/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /wrapped/i })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
