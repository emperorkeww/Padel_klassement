import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";
import type { GroupMember, Match, Profile } from "@/types";

const NOW = "2026-07-08T10:00:00.000Z";

// Muteerbare tabellen: elke test zet zijn eigen poll-situatie neer; de
// querycache wordt tussen tests geleegd (src/test/setup.ts). vi.hoisted,
// want de mock-factory hieronder wordt boven de imports gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

import { PlanTab } from "./PlanTab";
import { useAsync } from "@/lib/hooks/useAsync";
import { getGroupPolls, getGroupPollOptions } from "@/features/groups/pollsApi";
import { GROUP_MEMBERS, PROFILES } from "@/test/fixtures";

const baseClub = {
  club_id: "91d8d419-3736-498e-90be-362de786d588",
  club_name: "LAGO CLUB Padel Beveren",
  club_city: "Beveren",
  club_timezone: "Europe/Brussels",
};

const openPoll = {
  id: "poll-open",
  group_id: "g1",
  created_by: "p1",
  status: "open",
  locked_option_id: null,
  created_at: NOW,
  locked_at: null,
  booked_at: null,
  ...baseClub,
};
const bookedPoll = {
  ...openPoll,
  id: "poll-booked",
  status: "booked",
  locked_option_id: "opt-booked",
  locked_at: NOW,
  booked_at: "2026-07-08T12:00:00.000Z",
};
const openOption = {
  id: "opt-open",
  poll_id: "poll-open",
  group_id: "g1",
  date: "2030-01-05",
  start_time: "20:00",
  duration: 90,
  courts_free: 2,
  created_at: NOW,
};
const bookedOption = {
  ...openOption,
  id: "opt-booked",
  poll_id: "poll-booked",
  date: "2030-01-10",
  start_time: "19:00",
};
const vote = (optionId: string, playerId: string, status = "yes") => ({
  option_id: optionId,
  group_id: "g1",
  player_id: playerId,
  status,
  updated_at: NOW,
});

/** Ronde die ná het boeken is klaargezet: het Klaar-signaal (#349). */
const ROUND_MATCH: Match = {
  id: "m-round",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "scheduled",
  winner_team_id: null,
  played_at: null,
  created_by: "p1",
  created_at: "2026-07-08T13:00:00.000Z",
  group_id: "g1",
  round_number: 1,
  score_a: null,
  score_b: null,
  format: "2v2",
};

const profileMap = Object.fromEntries(
  PROFILES.map((p) => [p.id, p]),
) as Record<string, Profile>;

// Polls en opties komen sinds #674 uit GroupDetail (de landingstab heeft de
// reis-status nodig vóór deze tab mount). Dit harnas doet wat de parent doet,
// zodat de tests hun poll-situatie gewoon in `tables` kunnen blijven zetten.
function PlanTabHarness({ matches }: { matches: Match[] }) {
  const polls = useAsync(() => getGroupPolls("g1"), []);
  const options = useAsync(() => getGroupPollOptions("g1"), []);
  return (
    <PlanTab
      groupId="g1"
      groupName="Vrijdagavond padel"
      members={GROUP_MEMBERS as GroupMember[]}
      profiles={profileMap}
      myId="p1"
      isOwner
      matches={matches}
      polls={polls}
      options={options}
    />
  );
}

function renderTab(matches: Match[] = [], zoekstring = "") {
  return render(
    <MemoryRouter initialEntries={[`/groepen/g1${zoekstring}`]}>
      <ToastProvider>
        <PlanTabHarness matches={matches} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

// De suggestiekaart en de wizard halen baanbeschikbaarheid via fetch
// (Playtomic-proxy); een leeg antwoord volstaat.
function stubPlaytomic() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/v1/tenants/")
        ? { resources: [], opening_hours: {}, address: { timezone: "Europe/Brussels" } }
        : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

describe("<PlanTab />", () => {
  beforeEach(() => {
    stubPlaytomic();
    tables.play_polls = [openPoll, bookedPoll];
    tables.play_poll_options = [openOption, bookedOption];
    tables.play_poll_votes = [
      vote("opt-open", "p1"),
      vote("opt-open", "p2"),
      vote("opt-booked", "p1"),
      vote("opt-booked", "p2"),
      vote("opt-booked", "p3"),
      vote("opt-booked", "p4"),
    ];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it("zet de open poll in focus en klapt andere speeldagen compact in", async () => {
    renderTab();

    // De open poll (actie nodig) wint de focus van de al geboekte speeldag.
    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    // Fasebalk op tab-niveau: Stemmen is de actieve stap.
    expect(screen.getByText(/^stemmen$/i)).toBeInTheDocument();
    // Next-action: ik stemde al, twee leden nog niet.
    expect(
      screen.getByText(/wacht op 2 leden — stuur gerust een herinnering/i),
    ).toBeInTheDocument();

    // De geboekte poll staat compact onder "Andere speeldagen (1)" …
    expect(screen.getByText(/andere speeldagen \(1\)/i)).toBeInTheDocument();
    const row = screen.getByRole("button", { name: /geboekt/i });
    // … en klapt bij het aantikken uit tot de volledige poll-kaart.
    await userEvent.click(row);
    expect(
      await screen.findAllByRole("heading", { name: /speeldag-poll/i }),
    ).toHaveLength(2);
  });

  it("toont de Klaar-fase zodra er rondes na het boeken bestaan", async () => {
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [bookedOption];
    tables.play_poll_votes = ["p1", "p2", "p3", "p4"].map((p) =>
      vote("opt-booked", p),
    );
    renderTab([ROUND_MATCH]);

    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/de wedstrijden staan klaar/i),
    ).toBeInTheDocument();
    // Reis-CTA in de action-regel (en in de winner-card).
    expect(
      screen.getAllByRole("link", { name: /bekijk de wedstrijden/i }).length,
    ).toBeGreaterThan(0);
  });

  it("opent de plan-wizard als sheet en ruimt bij sluiten de opslag op", async () => {
    tables.play_polls = [];
    tables.play_poll_options = [];
    tables.play_poll_votes = [];
    renderTab();

    // Lege staat: de action-regel nodigt uit om te plannen.
    expect(
      await screen.findByText(/nog geen speeldag gepland/i),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /\+ plan een speeldag/i }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /nieuwe speeldag/i }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("poll-wizard:g1")).toBeNull();
  });

  // Gedeelde speeldag-link (#675): ?poll=<id> opent díé speeldag.
  it("zet de gedeelde poll uit de URL in focus", async () => {
    // Zonder link wint de open poll (er is nog actie nodig); mét link hoort
    // de geboekte speeldag groot in beeld te staan.
    renderTab([], "?tab=plannen&poll=poll-booked");

    expect(
      await screen.findByRole("heading", { name: /agenda & delen/i }),
    ).toBeInTheDocument();
    // De open poll is nu juist de ingeklapte "andere speeldag".
    expect(screen.getByText(/andere speeldagen \(1\)/i)).toBeInTheDocument();
  });

  it("valt stil terug op de gewone keuze bij een onbekende poll-id", async () => {
    renderTab([], "?tab=plannen&poll=bestaat-niet");

    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/wacht op 2 leden — stuur gerust een herinnering/i),
    ).toBeInTheDocument();
  });
});
