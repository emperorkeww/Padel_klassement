import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import { dateInZone } from "@/lib/utils/time";
import type { PlayPoll, PollOption } from "@/features/groups/pollsApi";
import type { Group, GroupMember, Match, Profile, Team } from "@/types";

const NOW = "2026-07-08T10:00:00.000Z";
const TIMEZONE = "Europe/Brussels";

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

// Vandaag in clubtijdzone (#783): ShareEvening/DayStats rekenen intern
// consistent in TIMEZONE, dus de fixtures en de today-prop volgen dezelfde
// clubdag i.p.v. de kale UTC-dag.
const today = dateInZone(TIMEZONE);

const profileMap = Object.fromEntries(PROFILES.map((p) => [p.id, p])) as Record<
  string,
  Profile
>;
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
            polls={[]}
            pollOptions={[]}
            today={today}
            timezone={TIMEZONE}
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

/** Geboekte speeldag van vandaag: het vertrekpunt voor de automaat-status in
 *  de dagkop (#839). De cron zet `rounds_generated_at` zodra hij indeelde. */
const AUTO_OPTION = {
  id: "opt-vandaag",
  poll_id: "poll-vandaag",
  group_id: "g1",
  date: today,
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: `${today}T06:00:00.000Z`,
} as unknown as PollOption;

const autoPoll = (overrides: Partial<PlayPoll> = {}): PlayPoll =>
  ({
    id: "poll-vandaag",
    group_id: "g1",
    created_by: "p1",
    status: "booked",
    locked_option_id: AUTO_OPTION.id,
    created_at: `${today}T06:00:00.000Z`,
    locked_at: `${today}T06:00:00.000Z`,
    booked_at: `${today}T06:30:00.000Z`,
    club_id: "c1",
    club_name: "LAGO CLUB Padel Beveren",
    club_city: "Beveren",
    club_timezone: TIMEZONE,
    access_code: null,
    courts: null,
    rounds_generated_at: `${today}T06:04:00.000Z`,
    ...overrides,
  }) as PlayPoll;

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

  it("zet op een lege dag de teamgenerator centraal, met de losse partij erboven", async () => {
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

    // De losse partij staat sinds #722 bovenaan, dus vóór de generator.
    const losse = screen.getByRole("region", { name: /losse partij/i });
    expect(
      generator.compareDocumentPosition(losse) &
        Node.DOCUMENT_POSITION_PRECEDING,
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
      screen.getByRole("button", { name: /\+ match loggen/i }),
    );
    expect(
      await screen.findByRole("dialog", { name: /match loggen/i }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /match plannen/i }),
    );
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

    // De losse partij verhuist niet mee de inklapper in (#722): ook met
    // rondes op het scherm staat hij los, bovenaan, boven de wedstrijden.
    const losse = screen.getByRole("region", { name: /losse partij/i });
    expect(details.contains(losse)).toBe(false);
    expect(
      wedstrijden.compareDocumentPosition(losse) &
        Node.DOCUMENT_POSITION_PRECEDING,
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

  it("zet de wedstrijden boven de hoogtepunten (uitslagen invullen primair)", () => {
    renderTab(DAG_ONDERWEG);

    const wedstrijden = screen.getByRole("heading", {
      name: /^wedstrijden$/i,
    });
    // De hoogtepunten (#342) blijven ondersteunend ónder de rondes; de telling
    // die hier stond is sinds #839 de dagkop bovenaan.
    const hoogtepunten = screen.getByRole("heading", {
      name: /^hoogtepunten$/i,
    });
    expect(
      wedstrijden.compareDocumentPosition(hoogtepunten) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ── Dagkop (#839) ─────────────────────────────────────────────────────
  // Voortgang, deelknop en herkomst van de indeling stonden verspreid over de
  // tab (of nergens); ze horen in één blok dat over de hele dag gaat.

  it("telt de voortgang van de hele dag in de dagkop", () => {
    renderTab(DAG_ONDERWEG);

    const kop = screen
      .getByRole("heading", { name: /^vandaag ·/i })
      .closest(".dagkop") as HTMLElement;
    expect(kop).not.toBeNull();
    // Eén afgeronde en één openstaande match, in twee rondes.
    expect(
      within(kop).getByText(/1 van 2 uitslagen binnen/i),
    ).toBeInTheDocument();
    expect(
      within(kop).getByLabelText(/1 van 2 uitslagen ingevuld/i),
    ).toBeInTheDocument();
  });

  it("houdt de deelknop onderweg in de dagkop, niet in de kop van Wedstrijden", () => {
    renderTab(DAG_ONDERWEG);

    const share = screen.getByRole("button", {
      name: /deel avond-samenvatting/i,
    });
    expect(share.closest(".dagkop")).not.toBeNull();
  });

  it("sluit de dag af in diezelfde dagkop, met de stand-CTA erbij", async () => {
    const { onShowStand } = renderTab({
      matches: [DONE_TODAY],
      rounds: [{ round: 1, list: [DONE_TODAY] }],
      dayDone: true,
    });

    // Dezelfde plek als onderweg: de deelknop verhuist niet meer naar een
    // aparte afsluitkaart zodra de laatste uitslag binnen is.
    const kop = screen
      .getByRole("button", { name: /deel avond-samenvatting/i })
      .closest(".dagkop") as HTMLElement;
    expect(kop).not.toBeNull();
    expect(
      within(kop).getByText(/alle 1 uitslagen staan erin/i),
    ).toBeInTheDocument();

    await userEvent.click(
      within(kop).getByRole("button", { name: /bekijk de stand/i }),
    );
    expect(onShowStand).toHaveBeenCalled();
  });

  it("vertelt in de dagkop dat de automaat de rondes klaarzette (#827)", () => {
    renderTab({
      ...DAG_ONDERWEG,
      polls: [autoPoll()],
      pollOptions: [AUTO_OPTION],
    });

    expect(screen.getByText(/automatisch klaargezet om/i)).toBeInTheDocument();
  });

  it("vertelt op een lege dag dat de automaat nog moet komen", () => {
    // Vóór het ochtenduur (08:00 clubtijd) waarop de cron indeelt — anders
    // zou de kop terecht melden dat hij niets ingedeeld heeft.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${today}T04:00:00.000Z`));
    try {
      renderTab({
        polls: [autoPoll({ rounds_generated_at: null })],
        pollOptions: [AUTO_OPTION],
      });
      expect(
        screen.getByText(/de automaat deelt om 08:00/i),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("vertelt dat de automaat uit staat", () => {
    renderTab({
      group: { ...(GROUPS[0] as unknown as Group), auto_rondes: false },
      polls: [autoPoll({ rounds_generated_at: null })],
      pollOptions: [AUTO_OPTION],
    });

    expect(screen.getByText(/de automaat staat uit/i)).toBeInTheDocument();
  });

  it("meldt dat de automaat wacht zolang de baan niet geboekt is", () => {
    renderTab({
      polls: [autoPoll({ status: "locked", rounds_generated_at: null })],
      pollOptions: [AUTO_OPTION],
    });

    expect(
      screen.getByText(/de automaat wacht op de baanboeking/i),
    ).toBeInTheDocument();
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
