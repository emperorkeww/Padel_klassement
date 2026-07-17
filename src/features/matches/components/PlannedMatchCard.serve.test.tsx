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
import { teamLabel } from "@/features/matches/api";
import { serveerTeam } from "@/features/matches/serve";
import { MATCH_DONE, MATCH_PLANNED, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";

const tmap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;
const pmap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;

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

describe("<PlannedMatchCard /> eerste opslag", () => {
  it("toont de serve-chip bij precies één team: het team dat serveerTeam aanwijst", async () => {
    renderCard(MATCH_PLANNED as Match);
    const chips = await screen.findAllByRole("img", {
      name: /begint met opslaan/,
    });
    expect(chips).toHaveLength(1);

    // De chip benoemt het juiste team — dezelfde afleiding als de component.
    const kant = serveerTeam(MATCH_PLANNED);
    const team =
      kant === "a" ? tmap[MATCH_PLANNED.team_a_id] : tmap[MATCH_PLANNED.team_b_id];
    expect(chips[0]).toHaveAccessibleName(
      `${teamLabel(team, pmap)} begint met opslaan`,
    );
    // Naast de emoji staat er ook leesbare tekst.
    expect(chips[0]).toHaveTextContent(/begint/);
  });

  it("toont geen serve-chip bij een afgeronde match", () => {
    renderCard(MATCH_DONE as Match);
    expect(
      screen.queryByRole("img", { name: /begint met opslaan/ }),
    ).not.toBeInTheDocument();
  });
});
