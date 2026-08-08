import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Bounty-banner (#805) op de geplande matchkaart: staat er een leider op het
// veld, dan moet de kaart vóór de aftrap tonen wat er te halen valt.

const OVER_2_DAGEN = new Date(Date.now() + 2 * 86400_000).toISOString();

const { tables } = vi.hoisted(() => ({
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlannedMatchCard } from "@/features/matches/components/PlannedMatchCard";
import { MATCH_PLANNED, PROFILES, TABLES, TEAMS } from "@/test/fixtures";
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

const GEPLAND = { ...MATCH_PLANNED, played_at: OVER_2_DAGEN } as Match;

/** Rij zoals public.active_bounties hem levert. */
function bountyRij(
  playerId: string,
  groupId: string | null,
  pool: number,
  streak = 0,
) {
  return {
    player_id: playerId,
    group_id: groupId,
    reden: groupId ? "bigdaddy" : "dictator",
    streak,
    pool,
  };
}

function setTables(over: Record<string, unknown[]> = {}) {
  for (const key of Object.keys(tables)) delete tables[key];
  Object.assign(tables, {
    ...TABLES,
    matches: [GEPLAND],
    match_stakes: [],
    active_bounties: [],
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

beforeEach(() => {
  setTables();
  vi.clearAllMocks();
});

describe("<PlannedMatchCard /> bounty", () => {
  it("kondigt de kroon van de groep aan met de actuele waarde", async () => {
    // p1 speelt mee in t-ab en draagt de kroon van g1 met een reeks van drie.
    setTables({ active_bounties: [bountyRij("p1", "g1", 24, 3)] });
    renderCard();
    expect(
      await screen.findByText(/bounty actief: \+24 elo op het spel/i),
    ).toBeInTheDocument();
  });

  it("zwijgt als geen van de deelnemers een bounty draagt", async () => {
    // Een kroon in een andere groep hoort deze kaart niet te halen.
    setTables({ active_bounties: [bountyRij("p1", "g-anders", 15)] });
    renderCard();
    // De toto-samenvatting bewijst dat de kaart geladen is; die zit sinds #941
    // achter de uitklapknop.
    await openPlannedCards();
    await screen.findByText(/toto/i);
    expect(screen.queryByText(/bounty actief/i)).not.toBeInTheDocument();
  });

  it("noemt de hoogste pool als er twee dragers meespelen", async () => {
    setTables({
      active_bounties: [bountyRij("p1", "g1", 18, 1), bountyRij("p3", null, 30, 9)],
    });
    renderCard();
    expect(
      await screen.findByText(/bounty actief: \+30 elo op het spel/i),
    ).toBeInTheDocument();
  });

  it("zwijgt bij een pool van nul (#1168)", async () => {
    // Met de bounty uit levert active_bounties niets meer op, maar mocht er
    // ooit een 0-rij doorheen glippen, dan is "+0 Elo op het spel" een lege
    // belofte. Zelfde afspraak als in BountyMark.
    setTables({ active_bounties: [bountyRij("p1", "g1", 0, 3)] });
    renderCard();
    await openPlannedCards();
    await screen.findByText(/toto/i);
    expect(screen.queryByText(/bounty actief/i)).not.toBeInTheDocument();
  });

  it("verdwijnt zodra de match gespeeld is", async () => {
    setTables({ active_bounties: [bountyRij("p1", "g1", 24, 3)] });
    renderCard({ ...GEPLAND, status: "completed" } as Match);
    expect(screen.queryByText(/bounty actief/i)).not.toBeInTheDocument();
  });
});
