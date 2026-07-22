import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Muteerbare rpc-respons zodat elke test success (ids) of leeg ([]) kan sturen.
const rpcState = vi.hoisted(() => ({ createFairRound: ["m1", "m2"] as string[] }));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: TABLES,
      rpc: { create_fair_round: () => rpcState.createFairRound },
    }),
  };
});

import { FairTeamsCard } from "./FairTeams";
import { PROFILES } from "@/test/fixtures";
import type { Profile } from "@/types";

// Fixtures p1-p4 als lookup-map, zoals de component (profiles[id]) hem verwacht.
const PROFILE_MAP: Record<string, Profile> = Object.fromEntries(
  PROFILES.map((p) => [p.id, p as Profile]),
);
// Vier aanwezigen → precies één volle baan (deelbaar door 4), geen reserves.
const PLAYER_IDS = ["p1", "p2", "p3", "p4"];

function renderCard() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <FairTeamsCard
          groupId="g1"
          playerIds={PLAYER_IDS}
          profiles={PROFILE_MAP}
        />
      </ToastProvider>
    </AuthProvider>,
  );
}

// Klikt "Stel eerlijke teams voor" (zodra de ratings geladen zijn) en daarna
// "Speel deze teams" — het punt waarop createFairRound wordt aangeroepen.
async function proposeAndPlay() {
  const userEvent = (await import("@testing-library/user-event")).default;
  const voorstel = await screen.findByRole("button", {
    name: /stel eerlijke teams voor/i,
  });
  await waitFor(() => expect(voorstel).toBeEnabled());
  await userEvent.click(voorstel);
  const spelen = await screen.findByRole("button", { name: /speel deze teams/i });
  await userEvent.click(spelen);
}

describe("<FairTeamsCard /> speel eerlijke teams (#62)", () => {
  beforeEach(() => {
    rpcState.createFairRound = ["m1", "m2"];
    vi.clearAllMocks();
  });

  it("schrijft het voorstel weg via create_fair_round en meldt succes", async () => {
    const { supabase } = await import("@/lib/supabase/client");
    renderCard();

    await proposeAndPlay();

    // De RPC is aangeroepen met de groep en de spelers van het voorstel.
    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "create_fair_round",
        expect.objectContaining({
          p_group_id: "g1",
          p_players: expect.arrayContaining(PLAYER_IDS),
        }),
      ),
    );
    // Twee ids terug → succes-toast in het meervoud.
    expect(
      await screen.findByText(/matches ingepland — vul straks de uitslagen in/i),
    ).toBeInTheDocument();
  });

  it("toont een fout-toast wanneer er geen matches worden aangemaakt", async () => {
    rpcState.createFairRound = [];
    renderCard();

    await proposeAndPlay();

    // Lege respons → error-toast, en geen succesmelding.
    expect(
      await screen.findByText(/geen matches aangemaakt/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/ingepland — vul straks de uitslag/i),
    ).not.toBeInTheDocument();
  });
});
