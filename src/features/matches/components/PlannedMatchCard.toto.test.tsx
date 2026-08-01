import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { supabase } from "@/lib/supabase/client";
import { MATCH_PLANNED, PROFILES, TEAMS } from "@/test/fixtures";
import type { Match, Profile, Team } from "@/types";
import { openPlannedCards } from "@/test/plannedCard";

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

describe("<PlannedMatchCard /> toto", () => {
  it("toont de tip-chips direct in de open toto-tegel", async () => {
    renderCard(MATCH_PLANNED as Match);
    // De toto zit sinds #941 achter de uitklapknop; open tegel bínnen de kaart:
    // beide teams direct tapbaar, geen accordeon.
    await openPlannedCards();
    const chipA = await screen.findByRole("button", {
      name: /^tip alice anders & bob boers$/i,
    });
    expect(chipA).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^tip carol claes & dave de vos$/i }),
    ).toBeInTheDocument();
    // Alice (ingelogd) heeft nog niet getipt → de uitnodiging in de voetregel.
    expect(screen.getByText(/tip de winnaar/i)).toBeInTheDocument();
    // Carol tipte team A (fixture): haar naam in de tooltip.
    expect(chipA).toHaveAttribute("title", expect.stringMatching(/carol/i));
  });

  it("plaatst een tip via de chip", async () => {
    renderCard(MATCH_PLANNED as Match);
    await openPlannedCards();
    await userEvent.click(
      await screen.findByRole("button", {
        name: /^tip carol claes & dave de vos$/i,
      }),
    );
    expect(supabase.from).toHaveBeenCalledWith("match_predictions");
    expect(
      await screen.findByText(/tip geplaatst op carol claes & dave de vos/i),
    ).toBeInTheDocument();
  });

  it("toont geen tip-chips op een match zonder groep", async () => {
    renderCard({ ...MATCH_PLANNED, group_id: null } as Match);
    await openPlannedCards();
    // De kaart is er wel (score-invoer), maar zonder toto-tegel.
    await screen.findByLabelText(/^score alice anders & bob boers$/i);
    expect(screen.queryByText(/🎯 toto/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^tip / }),
    ).not.toBeInTheDocument();
  });

  it("vergrendelt de chips zodra de starttijd verstreken is", async () => {
    renderCard({
      ...MATCH_PLANNED,
      played_at: "2026-07-01T18:00:00.000Z",
    } as Match);
    await openPlannedCards();
    // Kopregel van de tegel: gesloten + teller (Carol's fixture-tip).
    expect(
      await screen.findByText(/tippen gesloten · 1 tip/i),
    ).toBeInTheDocument();
    const chipA = await screen.findByRole("button", {
      name: /^tip alice anders & bob boers$/i,
    });
    expect(chipA).toBeDisabled();
    // Geen tip-uitnodiging meer als tippen dicht is.
    expect(
      screen.queryByText(/tippen kan tot de starttijd/i),
    ).not.toBeInTheDocument();
  });
});
