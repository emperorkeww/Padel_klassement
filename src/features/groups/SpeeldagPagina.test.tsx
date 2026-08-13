import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@/ui/ToastProvider";

const NOW = "2026-07-08T10:00:00.000Z";

// Muteerbare tabellen, zoals PlanTab.test: elke test zet zijn eigen situatie
// neer. vi.hoisted, want de mock-factory hieronder wordt boven de imports
// gehesen.
const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables }) };
});

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "p1" } }),
}));

import { supabase } from "@/lib/supabase/client";
import { SpeeldagPagina } from "./SpeeldagPagina";
import { GROUP_MEMBERS, GROUPS, PROFILES, TEAMS } from "@/test/fixtures";

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
  courts: null,
  access_code: null,
  ...baseClub,
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

const bookedPoll = {
  ...openPoll,
  id: "poll-booked",
  status: "booked",
  locked_option_id: "opt-booked",
  locked_at: NOW,
  booked_at: "2026-07-08T12:00:00.000Z",
  courts: "3 & 4",
  access_code: "1234",
};

const bookedOption = {
  ...openOption,
  id: "opt-booked",
  poll_id: "poll-booked",
  date: "2030-01-10",
  start_time: "19:00",
};

/** Een wedstrijd van de geboekte speeldag: 19:00 clubtijd op 10 jan 2030. */
const dagMatch = (overrides: Record<string, unknown> = {}) => ({
  id: "m-dag",
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "scheduled",
  winner_team_id: null,
  played_at: "2030-01-10T18:00:00.000Z",
  created_by: "p1",
  created_at: NOW,
  group_id: "g1",
  round_number: 1,
  score_a: null,
  score_b: null,
  format: "2v2",
  ...overrides,
});

const vote = (optionId: string, playerId: string, status = "yes") => ({
  option_id: optionId,
  group_id: "g1",
  player_id: playerId,
  status,
  updated_at: NOW,
});

/** De baanbeschikbaarheid loopt via de Playtomic-proxy; leeg volstaat hier. */
function stubPlaytomic() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/v1/tenants/")
        ? {
            resources: [],
            opening_hours: {},
            address: { timezone: "Europe/Brussels" },
          }
        : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

function renderPagina(pollId: string) {
  return render(
    <MemoryRouter initialEntries={[`/speeldag/${pollId}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/speeldag/:id" element={<SpeeldagPagina />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

// De supabase-mock filtert niet op `eq`: `maybeSingle` geeft simpelweg de
// eerste rij van de tabel. `tables.play_polls` bevat daarom per test precies de
// speeldag waar die test over gaat — en bij "niet gevonden" niets.
describe("<SpeeldagPagina />", () => {
  beforeEach(() => {
    stubPlaytomic();
    tables.profiles = PROFILES;
    tables.groups = GROUPS;
    tables.group_members = GROUP_MEMBERS;
    tables.matches = [];
    tables.play_polls = [openPoll];
    tables.play_poll_options = [openOption, bookedOption];
    tables.play_poll_votes = [
      // Vier ja's: de drempel waarop zowel de kaart als de cron een moment
      // vastleggen (#1271). Met minder stelt de kaart bewust niets meer voor.
      vote("opt-open", "p1"),
      vote("opt-open", "p2"),
      vote("opt-open", "p3"),
      vote("opt-open", "p4"),
      vote("opt-booked", "p1"),
      vote("opt-booked", "p2"),
      vote("opt-booked", "p3"),
      vote("opt-booked", "p4"),
    ];
  });
  afterEach(() => vi.unstubAllGlobals());

  // De kern van #1121: één poll-id in de URL is genoeg. De groep staat er niet
  // bij en wordt uit de poll zelf afgeleid — anders zou elke deel-link en elk
  // pushbericht de groep moeten meedragen.
  it("leidt de groep uit de poll af en toont de speeldag", async () => {
    renderPagina("poll-open");

    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    // De groepsnaam is de context die op de groepspagina vanzelf sprak: hij
    // staat in de kop én is de weg terug naar die groep.
    expect(
      screen.getByRole("link", { name: GROUPS[0].name }),
    ).toHaveAttribute("href", "/groepen/g1");
  });

  // Verhuisd uit GroupDetail.test toen de Plannen-tab verdween (#1121): dit is
  // dezelfde kaart, alleen niet meer achter een tab.
  it("klapt de banen-balans van een moment uit", async () => {
    renderPagina("poll-open");
    await screen.findByRole("heading", { name: /speeldag-poll/i });

    await userEvent.click(
      screen.getAllByRole("button", { name: /haalbaarheid/i })[0],
    );
    // Twee ja-stemmen → één baan nodig.
    expect(await screen.findByText(/1 baan nodig/i)).toBeInTheDocument();
  });

  it("laat de beheerder de kandidaat-dagen aanpassen", async () => {
    renderPagina("poll-open");
    await userEvent.click(
      await screen.findByRole("button", { name: /dagen aanpassen/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /dagen aanpassen/i }),
    ).toBeInTheDocument();
    // Het bestaande moment staat voorgeselecteerd in de wizard.
    expect(
      screen.getByRole("button", { name: /bewaar dagen \(1\)/i }),
    ).toBeInTheDocument();
  });

  // De reden dat deze pagina bestaat: de beheeracties zaten alleen op de
  // Plannen-tab en waren vanuit de agenda niet te bereiken.
  it("geeft de beheerder de acties van de Plannen-tab", async () => {
    renderPagina("poll-open");

    expect(
      await screen.findByRole("button", { name: /dagen aanpassen/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /herinner/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^↗ deel$/i })).toBeInTheDocument();
    // "Kies <dag> · <tijd>" legt het moment vast; zonder deze knop kwam je op
    // de agenda niet verder dan stemmen.
    expect(screen.getByRole("button", { name: /^kies /i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /annuleer poll/i }),
    ).toBeInTheDocument();
  });

  // Een geboekte speeldag komt binnen via WinnerCard: boekgegevens, poster en
  // het klaarzetten van de rondes.
  it("toont bij een geboekte speeldag de boekgegevens en het klaarzetten", async () => {
    tables.play_polls = [bookedPoll];
    renderPagina("poll-booked");

    expect(
      await screen.findByRole("heading", { name: /geboekte speeldag/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Baan 3 & 4")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /toegangscode 1234 kopiëren/i }),
    ).toBeInTheDocument();
    // Indelen is waarvoor je hier bent zolang er niets staat, dus het paneel
    // staat open op de pagina in plaats van achter een knop (#1146).
    expect(
      screen.getByRole("heading", { name: /wie speelt er mee/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /speelformaat/i }),
    ).toBeInTheDocument();
  });

  // #1213: Banen is volledig adresseerbaar (?datum=, ?club=), maar niets in de
  // plan-flow gebruikte dat — terwijl de dag hier al vastligt.
  it("wijst naar de vrije banen op de dag van deze speeldag", async () => {
    tables.play_polls = [bookedPoll];
    renderPagina("poll-booked");

    const link = await screen.findByRole("link", { name: /vrije banen/i });
    expect(link).toHaveAttribute(
      "href",
      `/banen?datum=2030-01-10&club=${encodeURIComponent(baseClub.club_id)}`,
    );
  });

  it("laat die link weg zolang er geen moment vastligt", async () => {
    tables.play_polls = [openPoll];
    renderPagina("poll-open");

    await screen.findByRole("heading", { name: /speeldag-poll/i });
    expect(
      screen.queryByRole("link", { name: /vrije banen/i }),
    ).not.toBeInTheDocument();
  });

  // De kern van #1133: de wedstrijden van die dag horen op de pagina waar je
  // ze klaarzet. Ze stonden alleen op de Spelen-tab, en die toont uitsluitend
  // vandaag — een speeldag volgende week was dus nergens te zien.
  it("toont de wedstrijden van deze speeldag", async () => {
    tables.play_polls = [bookedPoll];
    tables.teams = TEAMS;
    tables.matches = [
      dagMatch(),
      dagMatch({ id: "m-los", round_number: null }),
      // Een andere dag: hoort hier niet thuis, ook al zit hij in dezelfde groep.
      dagMatch({ id: "m-andere-dag", played_at: "2030-01-11T18:00:00.000Z" }),
    ];
    renderPagina("poll-booked");

    expect(
      await screen.findByRole("heading", { name: /^wedstrijden$/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ronde 1/i })).toBeInTheDocument();
    // Losse partijen van diezelfde avond horen erbij, net als in de Spelen-tab.
    expect(
      screen.getByRole("heading", { name: /losse matches/i }),
    ).toBeInTheDocument();
    // Twee rondeblokken (ronde 1 + los), niet drie: de match van de dag erna
    // valt buiten deze speeldag.
    expect(screen.getAllByText(/0\/1 uitslagen/i)).toHaveLength(2);
  });

  // De reden dat de generator een speeldag meekrijgt (#1133): hij zocht zelf
  // de poll van vandáág op. Een ronde die je hier toevoegt hoort op het uur van
  // déze speeldag te beginnen, niet op dat van vandaag.
  it("geeft een nieuwe ronde de starttijd van deze speeldag mee", async () => {
    tables.play_polls = [bookedPoll];
    tables.teams = TEAMS;
    tables.matches = [dagMatch()];
    renderPagina("poll-booked");

    await userEvent.click(
      await screen.findByRole("button", { name: /\+ volgende ronde/i }),
    );
    // De deelnemers komen uit de poll van deze speeldag, niet uit die van
    // vandaag of uit "alle leden".
    expect(
      await screen.findByText(/deelnemers uit de poll van deze speeldag/i),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /americano/i }));
    // Het aantal rondes volgt sinds #1271 de geboekte duur, dus de knop zegt
    // hoeveel er klaargezet worden in plaats van kaal "Start Americano".
    await userEvent.click(
      screen.getByRole("button", { name: /^start (\d+ )?americano/i }),
    );

    const call = vi
      .mocked(supabase.rpc)
      .mock.calls.find(([naam]) => naam === "create_fair_round");
    // Ronde 1 staat er al, dus de nieuwe begint tien minuten later: 19:00 +
    // 10 min clubtijd op 10 januari 2030.
    expect(call?.[1]).toMatchObject({
      p_group_id: "g1",
      p_played_at: "2030-01-10T18:10:00.000Z",
    });
  });

  // Eén knop tegelijk (#1141): zolang er niets staat is klaarzetten de actie
  // van de kaart; zodra de wedstrijden er zijn verhuist dezelfde knop naar
  // "+ Volgende ronde" onder die wedstrijden, waar je op dat moment kijkt.
  it("verhuist de klaarzet-knop naar de wedstrijden zodra die er zijn", async () => {
    tables.play_polls = [bookedPoll];
    tables.teams = TEAMS;
    tables.matches = [dagMatch()];
    renderPagina("poll-booked");

    expect(
      await screen.findByRole("button", { name: /\+ volgende ronde/i }),
    ).toBeInTheDocument();
    // Het paneel staat dan niet meer open bovenaan: de wedstrijden zijn waar je
    // naar kijkt, en de generator hoort daaronder.
    expect(
      screen.queryByRole("heading", { name: /speelformaat/i }),
    ).not.toBeInTheDocument();
  });

  // Een losse partij hoort bij de avond waar je op staat. Op een speeldag die
  // nog moet komen is plannen de voor de hand liggende actie, niet loggen.
  it("zet bij een toekomstige speeldag het plannen vooraan", async () => {
    tables.play_polls = [bookedPoll];
    renderPagina("poll-booked");

    const knoppen = await screen.findAllByRole("button", {
      name: /match plannen|\+ match loggen/i,
    });
    expect(knoppen.map((k) => k.textContent)).toEqual([
      "Match plannen",
      "+ Match loggen",
    ]);
  });

  // Een groep kan er twee op één datum hebben: een ochtendsessie en een
  // avondsessie. Tot #1146 rekende de pagina met de kalenderdag, dus toonde ze
  // elkaars wedstrijden — en begon de avondsessie zijn rondes na die van de
  // ochtend.
  it("houdt twee speeldagen op dezelfde datum uit elkaar", async () => {
    const ochtendPoll = {
      ...bookedPoll,
      id: "poll-ochtend",
      locked_option_id: "opt-ochtend",
    };
    const ochtendOptie = {
      ...bookedOption,
      id: "opt-ochtend",
      poll_id: "poll-ochtend",
      start_time: "10:00",
    };
    // De mock geeft voor `maybeSingle` de eerste rij terug, dus de poll waar
    // deze test over gaat staat vooraan.
    tables.play_polls = [bookedPoll, ochtendPoll];
    tables.play_poll_options = [openOption, bookedOption, ochtendOptie];
    tables.teams = TEAMS;
    tables.matches = [
      // 09:00 UTC = 11:00 clubtijd: bij de ochtendsessie van 10:00.
      dagMatch({ id: "m-ochtend", played_at: "2030-01-10T09:00:00.000Z" }),
      // 18:00 UTC = 19:00 clubtijd: de avondsessie zelf.
      dagMatch({ id: "m-avond", round_number: 2 }),
    ];
    renderPagina("poll-booked");

    await screen.findByRole("heading", { name: /^wedstrijden$/i });
    // Alleen de eigen ronde: één blok, en dat is ronde 2.
    expect(screen.getByRole("heading", { name: /ronde 2/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /ronde 1/i }),
    ).not.toBeInTheDocument();
  });

  // Zolang er geen moment vastligt is er geen dag, en dus ook geen dagfilter
  // die zinnig is. Dan hoort er geen wedstrijdenblok te staan.
  it("houdt het wedstrijdenblok weg zolang er niets vastligt", async () => {
    tables.teams = TEAMS;
    tables.matches = [dagMatch({ played_at: "2030-01-05T19:00:00.000Z" })];
    renderPagina("poll-open");

    await screen.findByRole("heading", { name: /speeldag-poll/i });
    expect(
      screen.queryByRole("heading", { name: /^wedstrijden$/i }),
    ).not.toBeInTheDocument();
  });

  // RLS maakt een poll uit een vreemde groep onvindbaar; dat is hetzelfde
  // antwoord als "bestaat niet" en hoort geen foutmelding-met-opnieuw te zijn.
  it("zegt het eerlijk als de speeldag niet te vinden is", async () => {
    tables.play_polls = [];
    renderPagina("poll-bestaat-niet");

    expect(
      await screen.findByText(/deze speeldag bestaat niet \(meer\)/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /naar de agenda/i })).toHaveAttribute(
      "href",
      "/agenda",
    );
    expect(
      screen.queryByRole("button", { name: /opnieuw proberen/i }),
    ).not.toBeInTheDocument();
  });
});
