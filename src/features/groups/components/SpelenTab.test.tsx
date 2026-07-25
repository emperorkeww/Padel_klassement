import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Group, GroupMember, Match, Profile, Team } from "@/types";

const NOW = "2026-07-08T10:00:00.000Z";

// Muteerbare tabellen: elke test zet zijn eigen poll-situatie neer; de
// querycache wordt tussen tests geleegd (src/test/setup.ts). vi.hoisted,
// want de mock-factory hieronder wordt boven de imports gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables, rpc: ["m-x"] }),
  };
});

import { SpelenTab } from "./SpelenTab";
import { supabase } from "@/lib/supabase/client";
import {
  GROUPS,
  GROUP_MEMBERS,
  PROFILES,
  TEAMS,
  MATCH_PLANNED,
} from "@/test/fixtures";
import { dateInZone } from "@/lib/utils/time";

// MakeTeams filtert de poll op de clubdag; dateer fixtures dus op vandaag
// in de clubtijdzone (geen hardgecodeerde datum → geen middernacht-flakiness).
const today = dateInZone("Europe/Brussels");

const profileMap = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
) as Record<string, Profile>;
const teamMap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;

/** De geplande fixture-match, verplaatst naar vandaag (open uitslag). */
const PLANNED_TODAY: Match = {
  ...(MATCH_PLANNED as Match),
  created_at: `${today}T18:00:00.000Z`,
};

function renderTab(
  overrides: Partial<React.ComponentProps<typeof SpelenTab>> = {},
) {
  const onMatches = vi.fn();
  const onGuestCreated = vi.fn();
  const onShowRondes = vi.fn();
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <SpelenTab
            groupId="g1"
            group={GROUPS[0] as unknown as Group}
            myId="p1"
            members={GROUP_MEMBERS as GroupMember[]}
            profiles={profileMap}
            matches={[]}
            todaysMatches={[]}
            teams={teamMap}
            openRound={null}
            busy={false}
            intensiteit="gemeen"
            onMatches={onMatches}
            onGuestCreated={onGuestCreated}
            onShowRondes={onShowRondes}
            {...overrides}
          />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { onMatches, onGuestCreated, onShowRondes };
}

/** Wacht tot MakeTeams zijn default-selectie heeft gezet (#292). */
async function waitForSelection() {
  await waitFor(() => {
    const toggles = screen.getAllByRole("button", { pressed: true });
    expect(toggles.length).toBeGreaterThanOrEqual(4);
  });
}

describe("<SpelenTab />", () => {
  beforeEach(() => {
    tables.play_polls = [];
    tables.play_poll_options = [];
    tables.play_poll_votes = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("zet de teamgenerator prominent bovenaan en de losse partij als voetnoot", async () => {
    renderTab();

    const generator = await screen.findByRole("heading", {
      name: /maak teams/i,
    });
    // De losse partij is gedegradeerd tot voetnoot: geen eigen kaartkop meer,
    // wel een gelabelde sectie ónder de generator.
    expect(
      screen.queryByRole("heading", { name: /losse partij/i }),
    ).not.toBeInTheDocument();
    const footer = screen.getByRole("region", { name: /losse partij/i });
    expect(
      generator.compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /\+ log match/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /plan match/i }),
    ).toBeInTheDocument();
  });

  it("zonder poll staan alle leden aan als vertrekpunt", async () => {
    renderTab();
    expect(
      await screen.findByText(/geen poll voor vandaag/i),
    ).toBeInTheDocument();
    await waitForSelection();
  });

  it("met een poll voor vandaag telt de poll de deelnemers", async () => {
    tables.play_polls = [
      {
        id: "poll-1",
        group_id: "g1",
        created_by: "p1",
        status: "open",
        locked_option_id: null,
        created_at: NOW,
        locked_at: null,
        booked_at: null,
      },
    ];
    tables.play_poll_options = [
      {
        id: "opt-today",
        poll_id: "poll-1",
        group_id: "g1",
        date: today,
        start_time: "20:00",
        duration: 90,
        courts_free: 2,
        created_at: NOW,
      },
    ];
    tables.play_poll_votes = ["p1", "p2", "p3", "p4"].map((pid) => ({
      option_id: "opt-today",
      group_id: "g1",
      player_id: pid,
      status: "yes",
      updated_at: NOW,
    }));
    renderTab();
    expect(
      await screen.findByText(/deelnemers uit de poll van vandaag/i),
    ).toBeInTheDocument();
  });

  it("genereert een Americano-ronde en meldt dat via onMatches", async () => {
    const { onMatches } = renderTab();
    await waitForSelection();

    await userEvent.click(screen.getByRole("button", { name: /^americano$/i }));
    const genBtn = screen.getByRole("button", {
      name: /genereer americano-ronde/i,
    });
    await waitFor(() => expect(genBtn).toBeEnabled());
    await userEvent.click(genBtn);

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith(
        "create_fair_round",
        expect.anything(),
      ),
    );
    expect(onMatches).toHaveBeenCalled();
  });

  it("wijst met open wedstrijden door naar Vandaag en blokkeert Mexicano", async () => {
    const { onShowRondes } = renderTab({
      matches: [PLANNED_TODAY],
      todaysMatches: [PLANNED_TODAY],
      openRound: { round: 2 },
    });

    // Reis-CTA: er staat een wedstrijd klaar → door naar de Vandaag-tab.
    // Op tekst i.p.v. role="status" — de toast-live-region heeft die rol ook.
    expect(
      await screen.findByText(/er staat 1 wedstrijd klaar om te spelen/i),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /naar vandaag/i }),
    );
    expect(onShowRondes).toHaveBeenCalled();

    // Mexicano paart op de volledige stand en blijft dus geblokkeerd.
    await waitForSelection();
    await userEvent.click(screen.getByRole("button", { name: /^mexicano$/i }));
    expect(
      screen.getByRole("button", { name: /genereer mexicano-ronde/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/vul eerst alle uitslagen van ronde 2 in/i),
    ).toBeInTheDocument();
  });

  it("toont geen reis-CTA zonder wedstrijden van vandaag", async () => {
    renderTab();
    await screen.findByRole("heading", { name: /maak teams/i });
    expect(
      screen.queryByText(/klaar om te spelen/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /naar vandaag/i }),
    ).not.toBeInTheDocument();
  });

  // #524: de vendetta-kaart verhuisde van de Stand- naar de Teams-tab.
  it("toont de vendetta-kaart met een uitklapbare uitleg (#524)", async () => {
    renderTab();

    // Kaart aanwezig: lege staat + startknop voor het lid.
    expect(
      await screen.findByRole("button", { name: /Verklaar vendetta/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nog geen actieve vendetta/)).toBeInTheDocument();

    // De uitleg zit achter het ⓘ-icoon en verschijnt pas na een tik.
    expect(
      screen.queryByText(/verklaarde aartsrivaliteit/i),
    ).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /wat is een vendetta/i }),
    );
    expect(
      await screen.findByText(/verklaarde aartsrivaliteit/i),
    ).toBeInTheDocument();
  });

  it("opent de sheet om een losse partij te loggen of te plannen", async () => {
    renderTab();

    await userEvent.click(
      screen.getByRole("button", { name: /\+ log match/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /match loggen/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /plan match/i }));
    expect(
      await screen.findByRole("dialog", { name: /match plannen/i }),
    ).toBeInTheDocument();
  });
});
