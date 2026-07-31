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

  // #721: de tab ordent op hoe vast een speeldag staat. Vóór die splitsing
  // won de open poll de focus en verdween de al geboekte speeldag in de
  // ingeklapte restlijst "Andere speeldagen".
  it("zet de vastgelegde speeldag boven de poll waarop nog gestemd wordt", async () => {
    renderTab();

    const geboekt = await screen.findByRole("heading", {
      name: /geboekte speeldag/i,
    });
    const stemmen = screen.getByRole("heading", { name: /speeldag-poll/i });

    // Beide staan meteen volledig in beeld — geen van de twee zit nog achter
    // een uitklapper — en de vastgelegde speeldag staat bovenaan.
    expect(screen.getByText(/^vastgelegd$/i)).toBeInTheDocument();
    expect(screen.getByText(/^stemmen loopt$/i)).toBeInTheDocument();
    expect(
      geboekt.compareDocumentPosition(stemmen) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Fasebalk + next-action blijven op de belangrijkste speeldag slaan …
    expect(screen.getByText(/^stemmen$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/wacht op 2 leden — stuur gerust een herinnering/i),
    ).toBeInTheDocument();
    // … maar geven wel toe dat er meer dan één loopt.
    expect(screen.getByText(/2 speeldagen lopen/i)).toBeInTheDocument();
  });

  it("markeert per speeldag of jij nog moet stemmen", async () => {
    // Twee open polls: op de ene stemde ik, op de andere niet.
    const tweede = { ...openPoll, id: "poll-open-2" };
    const tweedeOptie = {
      ...openOption,
      id: "opt-open-2",
      poll_id: "poll-open-2",
      date: "2030-02-02",
    };
    tables.play_polls = [openPoll, tweede];
    tables.play_poll_options = [openOption, tweedeOptie];
    tables.play_poll_votes = [vote("opt-open", "p1")];
    renderTab();

    // Bij meerdere polls staan ze als rijen: datum en status zonder uitklappen.
    const rijen = await screen.findAllByRole("button", {
      name: /stemmen loopt/i,
    });
    expect(rijen).toHaveLength(2);
    expect(
      screen.getAllByText(/jij moet nog stemmen/i),
    ).toHaveLength(1);
    expect(
      within(rijen[1]).getByText(/jij moet nog stemmen/i),
    ).toBeInTheDocument();

    // Uitklappen geeft de volledige kaart.
    await userEvent.click(rijen[1]);
    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
  });

  it("toont de Klaar-fase zodra er rondes na het boeken bestaan", async () => {
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [bookedOption];
    tables.play_poll_votes = ["p1", "p2", "p3", "p4"].map((p) =>
      vote("opt-booked", p),
    );
    renderTab([ROUND_MATCH]);

    expect(
      await screen.findByRole("heading", { name: /geboekte speeldag/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/de wedstrijden staan klaar/i),
    ).toBeInTheDocument();
    // Reis-CTA in de action-regel (en in de winner-card). Mét ?tab=spelen
    // (#727): het kale pad is de route waar je al op staat, dus dat wisselt
    // geen tab en de knop leek stuk.
    const cta = screen.getAllByRole("link", { name: /bekijk de wedstrijden/i });
    expect(cta.length).toBeGreaterThan(0);
    for (const link of cta) {
      expect(link).toHaveAttribute("href", "/groepen/g1?tab=spelen");
    }
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

  // Gedeelde speeldag-link (#675): ?poll=<id> opent díé speeldag. Met twee
  // geboekte speeldagen in dezelfde sectie bepaalt de link welke openstaat.
  it("zet de gedeelde poll uit de URL open in zijn sectie", async () => {
    const vroeger = {
      ...bookedPoll,
      id: "poll-booked-2",
      locked_option_id: "opt-booked-2",
    };
    const vroegerOptie = {
      ...bookedOption,
      id: "opt-booked-2",
      poll_id: "poll-booked-2",
      date: "2030-01-08",
    };
    tables.play_polls = [bookedPoll, vroeger];
    tables.play_poll_options = [bookedOption, vroegerOptie];
    renderTab([], "?tab=plannen&poll=poll-booked");

    // Zonder link zou de vroegste speeldag openstaan; mét link hoort de
    // gedeelde speeldag uitgeklapt te zijn.
    expect(
      await screen.findByRole("heading", { name: /agenda & delen/i }),
    ).toBeInTheDocument();
    const rijen = screen.getAllByRole("button", { name: /geboekt/i });
    expect(rijen[0]).toHaveAttribute("aria-expanded", "false");
    expect(rijen[1]).toHaveAttribute("aria-expanded", "true");
  });

  // #886: tot nu toe kon je alleen een al vastgelegde speeldag delen. De
  // deelknop op een lopende poll stuurt de stemming zelf de groepschat in.
  it("deelt een lopende poll met de deep-link naar díe poll", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => {});
    Object.assign(navigator, { share });
    tables.play_polls = [openPoll];
    tables.play_poll_options = [openOption];
    renderTab();

    await userEvent.click(await screen.findByRole("button", { name: /↗ deel/i }));

    expect(share).toHaveBeenCalledTimes(1);
    const arg = share.mock.calls[0][0];
    expect(arg.url).toBe(
      `${window.location.origin}/groepen/g1?tab=plannen&poll=poll-open`,
    );
    expect(arg.text).toContain("🗳 Stem mee");
    expect(arg.text).toContain("Vrijdagavond padel");
    delete (navigator as { share?: unknown }).share;
  });

  it("toont geen deelknop op een al geboekte speeldag", async () => {
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [bookedOption];
    renderTab();

    // De geboekte kaart heeft zijn eigen deelknoppen (↗ Tekst / 🖼 Afbeelding);
    // de poll-deelknop hoort alleen bij een lopende stemming.
    await screen.findByRole("heading", { name: /agenda & delen/i });
    expect(
      screen.queryByRole("button", { name: /↗ deel$/i }),
    ).not.toBeInTheDocument();
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

  // #721: de suggestiekaart klapt dicht zodra er écht een poll loopt.
  it("klapt de suggesties dicht bij een lopende poll", async () => {
    renderTab();

    const kop = await screen.findByRole("heading", { name: /^suggesties$/i });
    expect(kop.closest("details")).not.toHaveProperty("open", true);
    expect(screen.getByText(/poll loopt/i)).toBeInTheDocument();
  });

  it("houdt de suggesties open als de enige poll allang gespeeld is", async () => {
    // Vóór #721 keek de kaart enkel naar status !== "cancelled": een
    // uitgespeelde poll hield de suggesties dicht en zette "poll loopt".
    tables.play_polls = [bookedPoll];
    tables.play_poll_options = [{ ...bookedOption, date: "2020-01-10" }];
    tables.play_poll_votes = [];
    renderTab();

    const kop = await screen.findByRole("heading", { name: /^suggesties$/i });
    expect(kop.closest("details")).toHaveProperty("open", true);
    expect(screen.queryByText(/poll loopt/i)).not.toBeInTheDocument();
  });
});
