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

/** Klapt de (standaard ingeklapte) toto-sectie uit via de samenvattingsregel. */
async function expandToto() {
  const summary = await screen.findByRole("button", { name: /toto/i });
  await userEvent.click(summary);
  return summary;
}

describe("<PlannedMatchCard /> toto", () => {
  it("toont tip-chips per team met de tips van de groep", async () => {
    renderCard(MATCH_PLANNED as Match);
    // Ingeklapt (#362): alleen de samenvattingsregel, nog geen chips.
    const summary = await screen.findByRole("button", { name: /toto/i });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: /^tip / }),
    ).not.toBeInTheDocument();
    // Alice (ingelogd) heeft nog niet getipt → de uitnodiging in de samenvatting.
    expect(screen.getByText(/tip de winnaar/i)).toBeInTheDocument();

    // Uitgeklapt: beide teams krijgen een tapbare tip-chip.
    await userEvent.click(summary);
    const chipA = await screen.findByRole("button", {
      name: /^tip alice anders & bob boers$/i,
    });
    expect(chipA).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /^tip carol claes & dave de vos$/i }),
    ).toBeInTheDocument();
    // Carol tipte team A (fixture): haar naam in de tooltip.
    expect(chipA).toHaveAttribute("title", expect.stringMatching(/carol/i));
  });

  it("plaatst een tip via de chip", async () => {
    renderCard(MATCH_PLANNED as Match);
    await expandToto();
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
    // De kaart is er wel (score-invoer), maar zonder toto-sectie.
    await screen.findByLabelText(/^score alice anders & bob boers$/i);
    expect(
      screen.queryByRole("button", { name: /toto/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^tip / }),
    ).not.toBeInTheDocument();
  });

  it("vergrendelt de chips zodra de starttijd verstreken is", async () => {
    renderCard({
      ...MATCH_PLANNED,
      played_at: "2026-07-01T18:00:00.000Z",
    } as Match);
    // Ingeklapte samenvatting: gesloten + teller (Carol's fixture-tip).
    expect(
      await screen.findByText(/tippen gesloten · 1 tip/i),
    ).toBeInTheDocument();
    await expandToto();
    const chipA = await screen.findByRole("button", {
      name: /^tip alice anders & bob boers$/i,
    });
    expect(chipA).toBeDisabled();
    // Geen tip-uitnodiging meer als tippen dicht is.
    expect(screen.queryByText(/tippen kan tot de starttijd/i)).not.toBeInTheDocument();
  });
});
