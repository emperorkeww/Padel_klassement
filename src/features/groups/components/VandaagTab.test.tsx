import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Group, GroupMember, Match, Profile, Team } from "@/types";

const NOW = "2026-07-08T10:00:00.000Z";

// Muteerbare tabellen: elke test zet zijn eigen poll-situatie neer en de
// uitslag-test schrijft naar matches; de querycache wordt tussen tests
// geleegd (src/test/setup.ts). vi.hoisted, want de mock-factory hieronder
// wordt boven de imports gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables, rpc: ["m-x"] }),
  };
});

import { VandaagTab } from "./VandaagTab";
import { supabase } from "@/lib/supabase/client";
import {
  GROUPS,
  GROUP_MEMBERS,
  PROFILES,
  TEAMS,
  MATCH_DONE,
  MATCH_PLANNED,
} from "@/test/fixtures";

// ShareEvening bepaalt "vandaag" intern in UTC; dateer de fixtures en de
// today-prop dus allebei op de UTC-dag zodat de deelknop-asserties niet
// rond middernacht van de klok afhangen.
const today = new Date().toISOString().slice(0, 10);

const profileMap = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
) as Record<string, Profile>;
const teamMap = Object.fromEntries(TEAMS.map((t) => [t.id, t])) as Record<
  string,
  Team
>;

/** De fixture-matches, verplaatst naar vandaag. */
const DONE_TODAY: Match = {
  ...(MATCH_DONE as Match),
  played_at: `${today}T12:00:00.000Z`,
  created_at: `${today}T12:00:00.000Z`,
};
const PLANNED_TODAY: Match = {
  ...(MATCH_PLANNED as Match),
  created_at: `${today}T12:00:00.000Z`,
};

function renderTab(
  overrides: Partial<React.ComponentProps<typeof VandaagTab>> = {},
) {
  const onMatches = vi.fn();
  const onGuestCreated = vi.fn();
  const onShowStand = vi.fn();
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <VandaagTab
            groupId="g1"
            group={GROUPS[0] as unknown as Group}
            myId="p1"
            isOwner
            members={GROUP_MEMBERS as GroupMember[]}
            matches={[]}
            rounds={[]}
            openRound={null}
            dayDone={false}
            today={today}
            teams={teamMap}
            profiles={profileMap}
            histories={{}}
            upsets={new Map()}
            zwartePiet={null}
            busy={false}
            onMatches={onMatches}
            onGuestCreated={onGuestCreated}
            onShowStand={onShowStand}
            {...overrides}
          />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { onMatches, onGuestCreated, onShowStand };
}

/** Wacht tot MakeTeams zijn default-selectie heeft gezet (#292). */
async function waitForSelection() {
  await waitFor(() => {
    const toggles = screen.getAllByRole("button", { pressed: true });
    expect(toggles.length).toBeGreaterThanOrEqual(4);
  });
}

/** Een dag met rondes: twee rondes, één afgerond en één nog open. */
const DAG_ONDERWEG = {
  matches: [DONE_TODAY, PLANNED_TODAY],
  rounds: [
    { round: 2, list: [PLANNED_TODAY] },
    { round: 1, list: [DONE_TODAY] },
  ],
};

describe("<VandaagTab />", () => {
  beforeEach(() => {
    tables.play_polls = [];
    tables.play_poll_options = [];
    tables.play_poll_votes = [];
  });
  afterEach(() => vi.unstubAllGlobals());

  // ── Staat 1: er staat vandaag nog niets klaar ─────────────────────────
  // Vóór #674 kreeg je hier een lege "Wedstrijden"-kaart met een knop naar de
  // Teams-tab; nu is de teamgenerator zelf de inhoud.

  it("zet op een lege dag de teamgenerator centraal, met de losse partij als voetnoot", async () => {
    renderTab();

    const generator = await screen.findByRole("heading", {
      name: /maak teams/i,
    });
    // Geen doorverwijzing meer naar een andere tab, en geen lege
    // wedstrijdenkaart die erboven staat.
    expect(
      screen.queryByText(/nog niets gespeeld vandaag/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^wedstrijden$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /nog een ronde maken/i }),
    ).not.toBeInTheDocument();
    // Ook geen dagoverzicht of deelknop: één rustige tab met één actie.
    expect(
      screen.queryByRole("heading", { name: /^vandaag$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deel avond-samenvatting/i }),
    ).not.toBeInTheDocument();

    // De losse partij blijft een gedempte voetnoot ónder de generator.
    const footer = screen.getByRole("region", { name: /losse partij/i });
    expect(
      generator.compareDocumentPosition(footer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  // ── Staat 2: de dag loopt ─────────────────────────────────────────────

  it("toont de rondes met voortgang als gedempte tekst", () => {
    renderTab(DAG_ONDERWEG);

    expect(
      screen.getByRole("heading", { name: /^ronde 2$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^ronde 1$/i }),
    ).toBeInTheDocument();
    // De voortgang is tekst (geen badge meer); het ✓ bij "Afgerond" komt uit
    // CSS zodat de DOM-tekst exact blijft.
    expect(screen.getByText("0/1 uitslagen")).toBeInTheDocument();
    expect(screen.getByText(/^afgerond$/i)).toBeInTheDocument();
  });

  // #674 A2: één tab voor de hele speeldag. Zodra er wedstrijden staan
  // verhuist de generator naar een inklapper ónder de uitslagen, in plaats
  // van naar een eigen tab met een CTA-banner heen en weer.
  it("klapt de teamgenerator weg zodra er wedstrijden staan", async () => {
    renderTab(DAG_ONDERWEG);

    const wedstrijden = screen.getByRole("heading", { name: /^wedstrijden$/i });
    const toggle = screen.getByText(/nog een ronde maken/i);
    const details = toggle.closest("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    // De generator zit erin, en de inklapper staat ónder de wedstrijden.
    expect(
      within(details).getByRole("heading", { name: /maak teams/i }),
    ).toBeInTheDocument();
    expect(
      wedstrijden.compareDocumentPosition(details) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Geen banners meer die naar een andere tab wijzen (#674 B3).
    expect(screen.queryByText(/klaar om te spelen/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /naar vandaag/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);
    expect(details.open).toBe(true);
  });

  it("blokkeert Mexicano zolang een ronde open staat", async () => {
    renderTab({ ...DAG_ONDERWEG, openRound: { round: 2 } });

    await userEvent.click(screen.getByText(/nog een ronde maken/i));
    await waitForSelection();
    await userEvent.click(screen.getByRole("button", { name: /^mexicano$/i }));
    expect(
      screen.getByRole("button", { name: /genereer mexicano-ronde/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/vul eerst alle uitslagen van ronde 2 in/i),
    ).toBeInTheDocument();
  });

  it("zet de wedstrijden boven het dagoverzicht (uitslagen invullen primair)", () => {
    renderTab(DAG_ONDERWEG);

    const wedstrijden = screen.getByRole("heading", {
      name: /^wedstrijden$/i,
    });
    // Dagoverzicht (#342) is aanwezig, maar ondersteunend ónder de rondes.
    const dagoverzicht = screen.getByRole("heading", { name: /^vandaag$/i });
    expect(screen.getByText(/^gespeeld$/i)).toBeInTheDocument();
    expect(screen.getByText(/^gepland$/i)).toBeInTheDocument();
    expect(
      wedstrijden.compareDocumentPosition(dagoverzicht) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("toont de deelknop in de kaartkop zodra er een uitslag is", () => {
    renderTab(DAG_ONDERWEG);

    const share = screen.getByRole("button", {
      name: /deel avond-samenvatting/i,
    });
    // Nog niet alles binnen → de deelknop staat ondersteunend in de kaartkop,
    // niet in een afsluitkaart.
    expect(share.closest(".card__head")).not.toBeNull();
    expect(share.closest(".flow-next")).toBeNull();
  });

  it("slaat een uitslag optimistisch op vanuit de rondekaart", async () => {
    tables.matches = [{ ...PLANNED_TODAY }];
    const { onMatches } = renderTab({
      matches: [PLANNED_TODAY],
      rounds: [{ round: 2, list: [PLANNED_TODAY] }],
    });

    // findBy: de score-invoer verschijnt pas zodra de sessie geladen is en de
    // kijker aanmaker/deelnemer blijkt (#413).
    await userEvent.type(
      await screen.findByLabelText(/^score alice anders & bob boers$/i),
      "7",
    );
    await userEvent.type(
      screen.getByLabelText(/^score carol claes & dave de vos$/i),
      "5",
    );
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));

    // Optimistisch: de kaart toont direct de uitslag; de parent herlaadt.
    expect(await screen.findByText("7–5")).toBeInTheDocument();
    expect(await screen.findByText("opgeslagen ✓")).toBeInTheDocument();
    expect(onMatches).toHaveBeenCalled();
  });

  // ── Staat 3: alles ingevuld ───────────────────────────────────────────

  it("sluit de dag af met stand-CTA en deelknop in de afsluitkaart", async () => {
    const { onShowStand } = renderTab({
      matches: [DONE_TODAY],
      rounds: [{ round: 1, list: [DONE_TODAY] }],
      dayDone: true,
    });

    const card = screen
      .getByText(/alle uitslagen van vandaag staan erin/i)
      .closest(".flow-next") as HTMLElement;
    expect(card).not.toBeNull();
    expect(
      within(card).getByRole("button", { name: /deel avond-samenvatting/i }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(card).getByRole("button", { name: /bekijk de stand/i }),
    );
    expect(onShowStand).toHaveBeenCalled();
  });

  // #524: de vendetta-kaart hoort bij het spelen, niet bij de stand.
  it("toont de vendetta-kaart met een uitklapbare uitleg (#524)", async () => {
    renderTab();

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
});
