import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { MATCH_PLANNED, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

// Alice (p1, de ingelogde gebruiker) bezit groep g1 maar speelt hier niet mee
// en maakte de match niet aan: Carol tegen Dave, gepland door Bob. Precies de
// speeldag-situatie waarin de organisator de uitslag moet kunnen invullen.
const TEAM_C: Team = {
  id: "t-c",
  name: null,
  player1_id: "p3",
  player2_id: null,
  created_at: "2026-07-02T10:00:00.000Z",
};
const TEAM_D: Team = {
  id: "t-d",
  name: null,
  player1_id: "p4",
  player2_id: null,
  created_at: "2026-07-02T10:00:00.000Z",
};

const tmap = Object.fromEntries(
  [...TEAMS, TEAM_D].map((t) => [t.id, t]),
) as Record<string, Team>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

const MATCH_VAN_ANDEREN = {
  ...MATCH_PLANNED,
  id: "m-anderen",
  team_a_id: TEAM_C.id,
  team_b_id: TEAM_D.id,
  created_by: "p2",
  format: "1v1",
} as Match;

function renderCard(match: Match) {
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

describe("<PlannedMatchCard /> groepseigenaar", () => {
  it("toont de score-invoer aan de eigenaar van de groep", async () => {
    renderCard(MATCH_VAN_ANDEREN);
    expect(await screen.findByText(/opslaan/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/alleen de spelers, de aanmaker of de groepseigenaar/i),
    ).not.toBeInTheDocument();
  });

  it("houdt de score-invoer dicht in een groep die je niet bezit", async () => {
    renderCard({ ...MATCH_VAN_ANDEREN, group_id: "g-onbekend" } as Match);
    expect(
      await screen.findByText(
        /alleen de spelers, de aanmaker of de groepseigenaar/i,
      ),
    ).toBeInTheDocument();
  });
});
