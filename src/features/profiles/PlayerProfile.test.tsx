import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { PROFILES, TEAMS, MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";

// De mock leest de tabellen pas bij elke query uit, dus per test kunnen we
// `state.tables` hermuteren (o.a. de bekeken speler vooraan zetten, want
// maybeSingle geeft altijd de eerste rij terug).
const state = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
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

function renderProfileAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
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

// De profielinhoud zit sinds #103 achter tabs; deze helper opent er één.
function clickTab(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
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
      await screen.findByRole("heading", { name: /bob boers/i, level: 1 }),
    ).toBeInTheDocument();
    // Tier-badge (#127) op de rating-tegel: rating 1012 = Wannabe III, gedimd
    // (1 match). Sinds #496 noemt ook de hero-kaart de divisie, vandaar
    // findAll + filteren op de badge.
    const tiers = await screen.findAllByText("Wannabe III");
    expect(tiers.find((el) => el.classList.contains("tier-badge"))).toHaveClass(
      "is-dim",
    );
    // Punten (6) staan onder de Statistieken-tab.
    clickTab("Statistieken");
    expect(await screen.findByText("6")).toBeInTheDocument();
  });

  it("kroont de #1 van het klassement met een Big Daddy-badge in de hero", async () => {
    setTables("p2");
    state.tables.player_standings = [
      { player_id: "p1", username: "x", full_name: null, played: 4, won: 1, drawn: 0, lost: 3, points: 3, goal_diff: 0 },
      { player_id: "p2", username: "x", full_name: null, played: 4, won: 3, drawn: 0, lost: 1, points: 9, goal_diff: 0 },
    ];
    state.tables.player_ratings = [
      { player_id: "p2", rating: 1300, games: 5, updated_at: "" },
      { player_id: "p1", rating: 1000, games: 5, updated_at: "" },
    ];
    renderProfile("p2");
    expect(
      await screen.findByRole("heading", { name: /bob boers/i, level: 1 }),
    ).toBeInTheDocument();
    // Twee keer Big Daddy: de badge naast de naam én — sinds #621 — de
    // Icon-editie-regel op de hero-kaart, net als op het klassement.
    expect(screen.getAllByText(/Big Daddy/)).toHaveLength(2);
  });

  it("toont geen Big Daddy-badge als de speler niet #1 staat", async () => {
    setTables("p2");
    state.tables.player_standings = [
      { player_id: "p1", username: "x", full_name: null, played: 4, won: 3, drawn: 0, lost: 1, points: 9, goal_diff: 0 },
      { player_id: "p2", username: "x", full_name: null, played: 4, won: 1, drawn: 0, lost: 3, points: 3, goal_diff: 0 },
    ];
    state.tables.player_ratings = [
      { player_id: "p1", rating: 1300, games: 5, updated_at: "" },
      { player_id: "p2", rating: 1000, games: 5, updated_at: "" },
    ];
    renderProfile("p2");
    expect(
      await screen.findByRole("heading", { name: /bob boers/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Big Daddy/)).not.toBeInTheDocument();
  });

  it("toont de jij-vs-balans op het overzicht van andermans profiel", async () => {
    setTables("p2");
    renderProfile("p2");
    expect(
      await screen.findByRole("heading", { name: /jij vs bob boers/i }),
    ).toBeInTheDocument();
    // Als tegenstanders: alice won 1 van de 1 (m-tegen).
    expect(screen.getByText(/jij won 1 van de 1/i)).toBeInTheDocument();
    // Als partners: 3 matches, 2 gewonnen → 67%. De geplande match telt niet.
    expect(screen.getByText(/3 matches · 67% gewonnen/)).toBeInTheDocument();
  });

  it("toont het beste maatje met winstpercentage en profiellink", async () => {
    setTables("p2");
    renderProfile("p2");
    await screen.findByRole("heading", { name: /bob boers/i, level: 1 });
    // Beste maatje staat onder Statistieken.
    clickTab("Statistieken");
    expect(await screen.findByText("Beste maatje")).toBeInTheDocument();
    // Bobs beste maatje is alice: 3 samen, 2 gewonnen (dave haalt het minimum niet).
    expect(screen.getByText(/67% samen gewonnen \(3 matches\)/)).toBeInTheDocument();
  });

  it("toont geen jij-vs-balans op het eigen profiel", async () => {
    setTables("p1");
    renderProfile("p1");
    expect(
      await screen.findByRole("heading", { name: /alice anders/i, level: 1 }),
    ).toBeInTheDocument();
    // Geen balans-met-jezelf op het overzicht...
    expect(screen.queryByText(/jij vs/i)).not.toBeInTheDocument();
    // ...maar het beste maatje staat er wél (onder Statistieken).
    clickTab("Statistieken");
    expect(await screen.findByText("Beste maatje")).toBeInTheDocument();
  });

  it("toont het rating-verloop; de positie-grafiek staat sinds #461 uit", async () => {
    setTables("p1");
    // Twee ratingpunten → de rating-verloopkaart verschijnt. Het rang-verloop
    // (positie-grafiek) is in fase 1 van #461 uitgezet: het werd client-side uit
    // álle ruwe matchrijen berekend, die niet meer publiek leesbaar zijn. Dus
    // geen "Positie"-toggle en geen positie-grafiek (herstel in fase 2 via RPC).
    state.tables.rating_history = [
      { player_id: "p1", match_id: "m-dag1", rating_before: 1000, rating_after: 1005, delta: 5, played_at: "2026-07-01T10:00:00.000Z" },
      { player_id: "p1", match_id: "m-done", rating_before: 1005, rating_after: 1012, delta: 7, played_at: "2026-07-02T10:00:00.000Z" },
    ];
    state.tables.matches = [
      { ...MATCH_DONE, id: "m-dag1", played_at: "2026-07-01T10:00:00.000Z" },
      MATCH_DONE,
      MATCH_PLANNED,
    ];
    renderProfile("p1");
    await screen.findByRole("heading", { name: /alice anders/i, level: 1 });
    // De verloop-grafiek staat onder Statistieken.
    clickTab("Statistieken");

    expect(
      await screen.findByRole("heading", { name: "Rating-verloop" }),
    ).toBeInTheDocument();
    // Geen positie-toggle en geen positie-grafiek in fase 1.
    expect(screen.queryByRole("button", { name: "Positie" })).toBeNull();
    expect(screen.queryByText(/Klassementspositie na elke speeldag/)).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Positie-verloop" }),
    ).toBeNull();
  });

  it("meldt sober dat er nog geen gezamenlijke matches zijn", async () => {
    setTables("p5");
    renderProfile("p5");
    expect(
      await screen.findByRole("heading", { name: /erik evers/i, level: 1 }),
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

  it("opent rechtstreeks de Statistieken-tab via ?tab= in de URL", async () => {
    setTables("p2");
    renderProfileAt("/spelers/p2?tab=statistieken");
    // Beste maatje hoort bij Statistieken en verschijnt zonder te klikken.
    expect(await screen.findByText("Beste maatje")).toBeInTheDocument();
  });

  it("valt terug op Overzicht bij een onbekende ?tab=", async () => {
    setTables("p2");
    renderProfileAt("/spelers/p2?tab=bestaatniet");
    // Overzicht toont de jij-vs-kaart; de Statistieken-inhoud staat er niet.
    expect(
      await screen.findByRole("heading", { name: /jij vs bob boers/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Beste maatje")).not.toBeInTheDocument();
  });

  it("verbergt de Wrapped-knop op andermans profiel", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 20, 12) });
    try {
      setTables("p2");
      renderProfile("p2");
      expect(
        await screen.findByRole("heading", { name: /bob boers/i, level: 1 }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /wrapped/i })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("toont 'Verzoek sturen' op het profiel van een niet-vriend (#282)", async () => {
    // Erik (p5) heeft geen relatie met de ingelogde alice (p1).
    setTables("p5");
    state.tables.friendships = [];
    renderProfile("p5");
    expect(
      await screen.findByRole("heading", { name: /erik evers/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /verzoek sturen/i }),
    ).toBeInTheDocument();
  });

  it("toont 'Vrienden ✓' bij een bestaande vriendschap (#282)", async () => {
    setTables("p2");
    state.tables.friendships = [
      { id: "f2", requester_id: "p1", addressee_id: "p2", status: "accepted", created_at: "", updated_at: "" },
    ];
    renderProfile("p2");
    expect(
      await screen.findByRole("heading", { name: /bob boers/i, level: 1 }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/vrienden ✓/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verzoek sturen/i })).toBeNull();
  });

  it("toont geen vriendknop op je eigen profiel (#282)", async () => {
    setTables("p1");
    state.tables.friendships = [];
    renderProfile("p1");
    expect(
      await screen.findByRole("heading", { name: /alice anders/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verzoek/i })).toBeNull();
    expect(screen.queryByText(/vrienden ✓/i)).toBeNull();
  });
});
