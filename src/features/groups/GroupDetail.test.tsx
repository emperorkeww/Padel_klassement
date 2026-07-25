import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION, MATCH_DONE, MATCH_PLANNED } = await import(
    "@/test/fixtures"
  );
  const { dateInZone } = await import("@/lib/utils/time");
  // Extra poll-optie voor vandaag waar alle vier de leden op "kan" staan,
  // zodat de "Vanavond"-kaart en de eerlijke-teams-generator iets te doen
  // hebben.
  const today = dateInZone("Europe/Brussels");
  // De Vandaag-tab toont enkel matches van vandaag (#342); dateer de
  // fixture-matches daarom op de clubdag zodat de rondekaart ze toont.
  const todayMatches = [
    { ...MATCH_DONE, played_at: `${today}T18:00:00.000Z`, created_at: `${today}T18:00:00.000Z` },
    { ...MATCH_PLANNED, created_at: `${today}T18:00:00.000Z` },
  ];
  const tonightOption = {
    id: "opt-today",
    poll_id: "poll-1",
    group_id: "g1",
    date: today,
    start_time: "20:00",
    duration: 90,
    courts_free: 2,
    created_at: "2026-07-08T10:00:00.000Z",
  };
  const tonightVotes = ["p1", "p2", "p3", "p4"].map((pid) => ({
    option_id: "opt-today",
    group_id: "g1",
    player_id: pid,
    status: "yes",
    updated_at: "2026-07-08T10:00:00.000Z",
  }));
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: {
        ...TABLES,
        matches: todayMatches,
        play_poll_options: [...TABLES.play_poll_options, tonightOption],
        play_poll_votes: [...TABLES.play_poll_votes, ...tonightVotes],
      },
      rpc: ["m-x"],
    }),
  };
});

import GroupDetail from "./GroupDetail";
import { supabase } from "@/lib/supabase/client";

// De suggestiekaart haalt baanbeschikbaarheid via fetch (Playtomic-proxy);
// een leeg antwoord volstaat.
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

function renderPage(entry = "/groepen/g1") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/groepen/:id" element={<GroupDetail />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<GroupDetail />", () => {
  beforeEach(stubPlaytomic);
  afterEach(() => vi.unstubAllGlobals());

  it("toont de rondes met voortgang; ronde 2 heeft open uitslagen", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /vrijdagavond padel/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/jij bent eigenaar/i)).toBeInTheDocument();
    // Het ledenaantal staat alleen nog als teller op de Leden-tab (#674), en
    // zit in de toegankelijke naam zodat screenreaders het ook horen.
    expect(
      await screen.findByRole("tab", { name: "Leden, 4" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /^ronde 2$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("0/1 uitslagen")).toBeInTheDocument();
    expect(await screen.findByText(/^afgerond$/i)).toBeInTheDocument();
  });

  it("toont de teamgenerator op Teams en de suggesties op Plannen", async () => {
    renderPage();
    // Op de standaard Vandaag-tab staan sinds #342 noch de suggesties noch de
    // teamgenerator: die zijn naar Plannen resp. Teams verhuisd.
    expect(
      await screen.findByRole("heading", { name: /^vandaag$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /suggesties/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /maak teams/i }),
    ).not.toBeInTheDocument();

    // Teamgenerator staat op de Teams-tab.
    await userEvent.click(screen.getByRole("tab", { name: /^teams/i }));
    expect(
      await screen.findByRole("heading", { name: /maak teams/i }),
    ).toBeInTheDocument();
    // De standaard-selectie (alle deelnemers aangetikt) wordt één tick ná het
    // verschijnen van de "Maak teams"-kop gezet; wacht dus tot aria-pressed
    // settelt i.p.v. het synchroon te lezen (voorheen flaky, #292).
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /alice anders \(jij\)/i }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    for (const f of [/^eerlijk$/i, /^americano$/i, /^mexicano$/i]) {
      expect(screen.getByRole("button", { name: f })).toBeInTheDocument();
    }

    // Op de Plannen-tab staan de suggesties nu bovenaan, boven de poll.
    await userEvent.click(screen.getByRole("tab", { name: /^plannen/i }));
    expect(
      await screen.findByRole("heading", { name: /suggesties/i }),
    ).toBeInTheDocument();
  });

  it("stelt eerlijke teams voor uit de deelnemers van het voorstel van vandaag", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("tab", { name: /^teams/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /stel eerlijke teams voor/i }),
    );
    expect(await screen.findByText(/^baan 1$/i)).toBeInTheDocument();
    // Ratings uit de fixtures (1012/1012/988/988): sterk speelt met zwak,
    // dus Alice & Carol tegen Bob & Dave met een 50/50-verwachting.
    expect(screen.getByText(/alice anders & carol claes/i)).toBeInTheDocument();
    expect(screen.getByText(/bob boers & dave de vos/i)).toBeInTheDocument();
    expect(screen.getAllByText("(50%)")).toHaveLength(2);

    // "Opnieuw" toont de op één na eerlijkste verdeling.
    await userEvent.click(screen.getByRole("button", { name: /^opnieuw$/i }));
    expect(
      await screen.findByText(/alice anders & dave de vos/i),
    ).toBeInTheDocument();
  });

  it("blokkeert Mexicano zolang een ronde open staat", async () => {
    renderPage();
    // Wacht tot de matches geladen zijn (Ronde 2 op Vandaag), ga dan naar Teams.
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^teams/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^mexicano$/i }),
    );
    expect(
      screen.getByRole("button", { name: /genereer mexicano-ronde/i }),
    ).toBeDisabled();
    expect(
      screen.getByText(/vul eerst alle uitslagen van ronde 2 in/i),
    ).toBeInTheDocument();
  });

  it("genereert een Americano-ronde en schrijft de gekozen teams weg", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^teams/i }));
    // Formaat kiezen in de ene teamgenerator, dan genereren.
    await userEvent.click(
      await screen.findByRole("button", { name: /^americano$/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /genereer americano-ronde/i }),
    );
    // De ronde wordt client-side ingedeeld (geschiedenis-bewust) en via
    // create_fair_round weggeschreven: g1 heeft 4 leden → één baan van vier.
    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_fair_round",
      expect.objectContaining({ p_group_id: "g1" }),
    );
    const call = (supabase.rpc as unknown as { mock: { calls: unknown[][] } })
      .mock.calls.find((c) => c[0] === "create_fair_round");
    const players = (call?.[1] as { p_players: string[] }).p_players;
    expect(players).toHaveLength(4);
    expect(new Set(players).size).toBe(4); // vier verschillende leden
  });

  it("toont de speeldag-poll op het plannen-tabblad met banen-balans", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^plannen/i }));

    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
    // Fase-verloop en de optie-rij uit de fixtures.
    expect(screen.getByText(/^stemmen$/i)).toBeInTheDocument();
    // De fasebalk + next-action-regel staan op tab-niveau (#349); in de
    // fixtures stemde iedereen al, dus de maker mag het moment kiezen.
    expect(
      screen.getByRole("list", { name: /fase van de speeldag/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/alle stemmen zijn binnen — kies het moment/i),
    ).toBeInTheDocument();
    // De optie-rij én de "Kies …"-knop van de maker noemen het moment.
    expect((await screen.findAllByText(/za 5 jan/i)).length).toBeGreaterThan(0);
    // Stemmen via het ✓ ? ✗-segment.
    expect(
      screen.getAllByRole("button", { name: /^ik kan$/i }).length,
    ).toBeGreaterThan(0);

    // De haalbaarheids-knop klapt de banen-balans uit (2 kan → 1 baan nodig).
    await userEvent.click(
      screen.getAllByRole("button", { name: /haalbaarheid/i })[1],
    );
    expect(await screen.findByText(/1 baan nodig/i)).toBeInTheDocument();

    // Alice is de maker: zij ziet de "Kies …"-knop voor de beste optie.
    expect(
      screen.getAllByRole("button", { name: /^kies /i }).length,
    ).toBeGreaterThan(0);

    // ... en kan de kandidaat-dagen aanpassen (#128): de wizard heropent
    // met de bestaande momenten voorgeselecteerd.
    await userEvent.click(
      screen.getByRole("button", { name: /dagen aanpassen/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /dagen aanpassen/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /bewaar dagen \(2\)/i }),
    ).toBeInTheDocument();
    // De bestaande momenten staan als verwijderbare chips in de balk.
    expect(
      screen.getByRole("button", { name: /za 5 jan.*×/i }),
    ).toBeInTheDocument();
  });

  it("toont het groepsklassement standaard op rating, met punten-toggle", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^stand/i }));

    // Rating is de standaardweergave (fixtures: 1012/1012/988/988).
    expect(await screen.findByText(/gesorteerd op rating/i)).toBeInTheDocument();
    expect((await screen.findAllByText("1012")).length).toBe(2);
    // Tier-badges (#127): 1012 = Wannabe III (podium), 988 = Blaaskaak I.
    expect((await screen.findAllByText("Wannabe III")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Blaaskaak I")).length).toBeGreaterThan(0);

    // Toggle naar punten: de vertrouwde puntentabel met Ptn-kolom.
    await userEvent.click(screen.getByRole("button", { name: /^punten$/i }));
    expect(await screen.findByText("Ptn")).toBeInTheDocument();
    expect(screen.queryByText(/gesorteerd op rating/i)).not.toBeInTheDocument();
  });

  it("toont het voorspellersklassement onder Stand → Toto", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^stand/i }));
    await userEvent.click(screen.getByRole("button", { name: /^toto$/i }));

    expect(
      await screen.findByText(/wie tipt de meeste winnaars/i),
    ).toBeInTheDocument();
    // Fixtures: Carol leidt met 5 punten (2/3 juist), Alice volgt (1/2 juist).
    expect(await screen.findByText("2/3 juist")).toBeInTheDocument();
    expect(screen.getByText("1/2 juist")).toBeInTheDocument();
    // Het seizoensfilter is er ook in de toto-weergave.
    expect(screen.getByLabelText(/seizoen/i)).toBeInTheDocument();
  });

  it("toont Stand en Leden in eigen tabbladen", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^stand/i }));
    expect(await screen.findByText(/groepsklassement/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^leden/i }));
    expect(await screen.findByText(/vrienden toevoegen/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /verwijderen/i }).length,
    ).toBeGreaterThan(0);
  });

  // #674: echte tab-semantiek. De balk is één tabstop en je wisselt met de
  // pijltjes; aria-selected vertelt screenreaders waar je staat.
  it("wisselt van tab met de pijltjestoetsen (#674)", async () => {
    renderPage();
    const vandaag = await screen.findByRole("tab", { name: /^vandaag/i });
    expect(vandaag).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^teams/i })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    vandaag.focus();
    await userEvent.keyboard("{ArrowRight}");
    const teams = screen.getByRole("tab", { name: /^teams/i });
    expect(teams).toHaveAttribute("aria-selected", "true");
    expect(teams).toHaveFocus();
    expect(
      await screen.findByRole("heading", { name: /maak teams/i }),
    ).toBeInTheDocument();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: /^vandaag/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // Home/End springen naar de eerste en laatste tab.
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /^leden/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /^plannen/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  // #673: de tabs heten "Teams" en "Historie", maar de URL-keys bleven
  // "spelen" en "matches" — die staan hard in de edge functions en in
  // pushberichten die al op telefoons staan. Deze test borgt dat zo'n oude
  // link op de juiste tab landt.
  it("opent ?tab=spelen op Teams en ?tab=matches op Historie (#673)", async () => {
    const teams = renderPage("/groepen/g1?tab=spelen");
    expect(
      await screen.findByRole("heading", { name: /maak teams/i }),
    ).toBeInTheDocument();

    teams.unmount();
    renderPage("/groepen/g1?tab=matches");
    expect(
      await screen.findByRole("heading", { name: /gespeelde matches/i }),
    ).toBeInTheDocument();
  });

  it("slaat een uitslag optimistisch op vanuit de rondekaart", async () => {
    renderPage();
    const inputA = await screen.findByLabelText(/^score alice anders & bob boers$/i);
    const inputB = await screen.findByLabelText(/^score carol claes & dave de vos$/i);
    await userEvent.type(inputA, "7");
    await userEvent.type(inputB, "5");
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));
    // Optimistisch: de kaart toont direct de uitslag.
    expect(await screen.findByText("7–5")).toBeInTheDocument();
    expect(await screen.findByText("opgeslagen ✓")).toBeInTheDocument();
  });

  it("toont het dagoverzicht met telling en MVP op Vandaag (#342)", async () => {
    renderPage();
    // De dag-stats-kaart heeft een eigen "Vandaag"-kop met tellers.
    expect(
      await screen.findByRole("heading", { name: /^vandaag$/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^gespeeld$/i)).toBeInTheDocument();
    expect(screen.getByText(/^gepland$/i)).toBeInTheDocument();
    expect(screen.getByText(/MVP ·/i)).toBeInTheDocument();
  });

  it("toont de gespeelde matches op de Historie-tab met filters (#342)", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^historie/i }));
    expect(
      await screen.findByRole("heading", { name: /gespeelde matches/i }),
    ).toBeInTheDocument();
    // De afgeronde match staat in de lijst met de eindscore.
    expect(await screen.findByText("6–3")).toBeInTheDocument();
    // Filter op Verloren: de gewonnen match (voor Alice) verdwijnt.
    await userEvent.click(screen.getByRole("button", { name: /^verloren/i }));
    expect(screen.queryByText("6–3")).not.toBeInTheDocument();
  });
});
