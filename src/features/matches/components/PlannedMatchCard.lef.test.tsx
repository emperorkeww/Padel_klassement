import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Alice (p1) speelt mee in t-ab, heeft haar rating ingelopen en de match begint
// pas over twee dagen: precies het venster waarin inzetten mag.
const OVER_2_DAGEN = new Date(Date.now() + 2 * 86400_000).toISOString();

// De mock leest deze map bij elke from(); door hem per test in plaats te
// muteren wisselt de testdata mee zonder de client opnieuw op te bouwen.
const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { supabase } from "@/lib/supabase/client";
import { MATCH_PLANNED, PROFILES, TABLES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

// Los 1v1-team van Bob, zodat er een match bestaat waarin Alice niet meespeelt.
const T_B = {
  id: "t-b",
  name: null,
  player1_id: "p2",
  player2_id: null,
  created_at: OVER_2_DAGEN,
};

const tmap = Object.fromEntries(
  [...TEAMS, T_B].map((t) => [t.id, t]),
) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const INGELOPEN = [
  { player_id: "p1", rating: 1012, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p2", rating: 1012, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p3", rating: 988, games: 12, updated_at: OVER_2_DAGEN },
  { player_id: "p4", rating: 988, games: 12, updated_at: OVER_2_DAGEN },
];

const GEPLAND = { ...MATCH_PLANNED, played_at: OVER_2_DAGEN } as Match;

function stakeRij(matchId: string, playerId: string) {
  return {
    match_id: matchId,
    player_id: playerId,
    group_id: "g1",
    play_date: "2026-01-01",
    created_at: OVER_2_DAGEN,
  };
}

function setTables(over: Record<string, unknown[]> = {}) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, {
    ...TABLES,
    matches: [GEPLAND],
    player_ratings: INGELOPEN,
    match_stakes: [],
    ...over,
  });
}

function renderCard(match: Match = GEPLAND) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <PlannedMatchCard match={match} teams={tmap} profiles={pmap} />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Klapt de (standaard ingeklapte) lef-sectie uit via de samenvattingsregel. */
async function expandLef() {
  const summary = await screen.findByRole("button", { name: /^🎲 lef/i });
  await userEvent.click(summary);
  return summary;
}

beforeEach(() => {
  setTables();
  vi.clearAllMocks();
});

describe("<PlannedMatchCard /> lef-tip", () => {
  it("toont wat er op het spel staat en zet de inzet weg", async () => {
    renderCard();
    const summary = await expandLef();
    expect(summary).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/verlies je, dan telt je verlies net zo hard/i),
    ).toBeInTheDocument();
    // Beide kanten worden getoond: verdubbeld én de normale mutatie.
    expect(screen.getByText(/zonder inzet/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /zet je lef in/i }));
    expect(supabase.from).toHaveBeenCalledWith("match_stakes");
  });

  it("trekt een bestaande inzet weer in", async () => {
    setTables({ match_stakes: [stakeRij(GEPLAND.id, "p1")] });
    renderCard();
    // De samenvatting verraadt de eigen inzet al vóór het uitklappen.
    expect(await screen.findByText(/jouw lef staat ingezet/i)).toBeInTheDocument();
    await expandLef();
    await userEvent.click(screen.getByRole("button", { name: /inzet intrekken/i }));
    expect(supabase.from).toHaveBeenCalledWith("match_stakes");
  });

  it("houdt een speler met een nog niet ingelopen rating tegen", async () => {
    setTables({
      player_ratings: INGELOPEN.map((r) =>
        r.player_id === "p1" ? { ...r, games: 4 } : r,
      ),
    });
    renderCard();
    await expandLef();
    expect(screen.getByRole("button", { name: /zet je lef in/i })).toBeDisabled();
    expect(screen.getByText(/nog 6 matches te gaan/i)).toBeInTheDocument();
  });

  it("onthult pas na de aftrap wie er lef had", async () => {
    const begonnen = {
      ...GEPLAND,
      played_at: new Date(Date.now() - 3600_000).toISOString(),
    } as Match;
    setTables({
      matches: [begonnen],
      match_stakes: [stakeRij(begonnen.id, "p2")],
    });
    renderCard(begonnen);
    await expandLef();
    expect(screen.getByText(/lef getoond door bob/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /zet je lef in/i })).toBeDisabled();
  });

  it("toont geen lef-blok bij een match waarin je niet meespeelt", async () => {
    const anderen = {
      ...GEPLAND,
      team_a_id: "t-b",
      team_b_id: "t-c",
      format: "1v1",
    } as Match;
    setTables({ matches: [anderen] });
    renderCard(anderen);
    // De toto-regel hoort er wel te staan (het blijft een groepsmatch).
    await screen.findByRole("button", { name: /toto/i });
    expect(
      screen.queryByRole("button", { name: /^🎲 lef/i }),
    ).not.toBeInTheDocument();
  });
});
