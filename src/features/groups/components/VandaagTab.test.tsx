import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import type { Match, Profile, Team } from "@/types";

// Muteerbare tabellen: de uitslag-test schrijft naar matches; de querycache
// wordt tussen tests geleegd (src/test/setup.ts). vi.hoisted, want de
// mock-factory hieronder wordt boven de imports gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables }),
  };
});

import { VandaagTab } from "./VandaagTab";
import { PROFILES, TEAMS, MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";

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
  const onShowSpelen = vi.fn();
  const onShowStand = vi.fn();
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <VandaagTab
            groupName="Vrijdagavond Padel"
            myId="p1"
            isOwner
            matches={[]}
            rounds={[]}
            dayDone={false}
            today={today}
            teams={teamMap}
            profiles={profileMap}
            histories={{}}
            upsets={new Map()}
            zwartePiet={null}
            intensiteit="gemeen"
            onMatches={onMatches}
            onShowSpelen={onShowSpelen}
            onShowStand={onShowStand}
            {...overrides}
          />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { onMatches, onShowSpelen, onShowStand };
}

describe("<VandaagTab />", () => {
  it("nodigt bij een lege dag uit om te gaan spelen", async () => {
    const { onShowSpelen } = renderTab();

    expect(
      screen.getByText(/nog niets gespeeld vandaag/i),
    ).toBeInTheDocument();
    // Zonder wedstrijden geen uitleg-subtitel, geen dagoverzicht en geen
    // deelknop — één rustige kaart met één duidelijke actie.
    expect(
      screen.queryByText(/vul de uitslagen in/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /^vandaag$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /deel avond-samenvatting/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /genereer teams of log een partij/i }),
    );
    expect(onShowSpelen).toHaveBeenCalled();
  });

  it("toont de rondes met voortgang als gedempte tekst", () => {
    renderTab({
      matches: [DONE_TODAY, PLANNED_TODAY],
      rounds: [
        { round: 2, list: [PLANNED_TODAY] },
        { round: 1, list: [DONE_TODAY] },
      ],
    });

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

  it("zet de wedstrijden boven het dagoverzicht (uitslagen invullen primair)", () => {
    renderTab({
      matches: [DONE_TODAY, PLANNED_TODAY],
      rounds: [
        { round: 2, list: [PLANNED_TODAY] },
        { round: 1, list: [DONE_TODAY] },
      ],
    });

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
    renderTab({
      matches: [DONE_TODAY, PLANNED_TODAY],
      rounds: [
        { round: 2, list: [PLANNED_TODAY] },
        { round: 1, list: [DONE_TODAY] },
      ],
    });

    const share = screen.getByRole("button", {
      name: /deel avond-samenvatting/i,
    });
    // Nog niet alles binnen → de deelknop staat ondersteunend in de kaartkop,
    // niet in een afsluitkaart.
    expect(share.closest(".card__head")).not.toBeNull();
    expect(share.closest(".flow-next")).toBeNull();
  });

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
});
