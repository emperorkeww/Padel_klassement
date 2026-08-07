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

describe("<FairTeamsCard /> meerdere rondes (#1141)", () => {
  beforeEach(() => {
    rpcState.createFairRound = ["m1", "m2"];
    vi.clearAllMocks();
  });

  // De knop op de speeldagkaart zette 1–10 Elo-rondes in één tik klaar en gaat
  // weg; die mogelijkheid hoort hier terug te komen — met per ronde een eigen
  // verdeling en een eigen starttijd (#827), niet drie keer hetzelfde uur.
  it("schrijft evenveel rondes weg als gevraagd, met oplopende starttijden", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const { supabase } = await import("@/lib/supabase/client");
    const onGenerated = vi.fn();
    render(
      <AuthProvider>
        <ToastProvider>
          <FairTeamsCard
            groupId="g1"
            playerIds={PLAYER_IDS}
            profiles={PROFILE_MAP}
            aantal={3}
            startVoor={(i) =>
              new Date(Date.UTC(2030, 0, 10, 19, i * 10)).toISOString()
            }
            onGenerated={onGenerated}
          />
        </ToastProvider>
      </AuthProvider>,
    );

    const voorstel = await screen.findByRole("button", {
      name: /stel eerlijke teams voor/i,
    });
    await waitFor(() => expect(voorstel).toBeEnabled());
    await userEvent.click(voorstel);
    // Het label zegt wat er gaat gebeuren: niet "deze teams" maar drie rondes.
    await userEvent.click(
      await screen.findByRole("button", { name: /speel deze 3 rondes/i }),
    );

    await waitFor(() => {
      const calls = vi
        .mocked(supabase.rpc)
        .mock.calls.filter(([naam]) => naam === "create_fair_round");
      expect(calls).toHaveLength(3);
      expect(calls.map((c) => (c[1] as { p_played_at: string }).p_played_at)).toEqual([
        "2030-01-10T19:00:00.000Z",
        "2030-01-10T19:10:00.000Z",
        "2030-01-10T19:20:00.000Z",
      ]);
    });
    // De ouder hoort te horen dat er iets bij kwam: de speeldagpagina luisterde
    // nergens mee en toonde de nieuwe rondes anders pas na een refresh.
    expect(onGenerated).toHaveBeenCalled();
  });
});
