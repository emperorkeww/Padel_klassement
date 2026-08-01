import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openPlannedCards } from "@/test/plannedCard";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION, MATCH_DONE, MATCH_PLANNED } =
    await import("@/test/fixtures");
  const { dateInZone } = await import("@/lib/utils/time");
  // Extra poll-optie voor vandaag waar alle vier de leden op "kan" staan,
  // zodat de "Vanavond"-kaart en de eerlijke-teams-generator iets te doen
  // hebben.
  const today = dateInZone("Europe/Brussels");
  // De Vandaag-tab toont enkel matches van vandaag (#342); dateer de
  // fixture-matches daarom op de clubdag zodat de rondekaart ze toont.
  const todayMatches = [
    {
      ...MATCH_DONE,
      played_at: `${today}T18:00:00.000Z`,
      created_at: `${today}T18:00:00.000Z`,
    },
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
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";

/** Vervangt tijdelijk de ledenlijst van de groep; geeft een herstelfunctie. */
function metLeden(ids: string[]) {
  invalidateAll();
  const rijen = ids.map((pid, i) => ({
    group_id: "g1",
    player_id: pid,
    role: i === 0 ? "owner" : "member",
    joined_at: "2026-07-01T10:00:00.000Z",
  }));
  const fromMock = supabase.from as unknown as {
    getMockImplementation: () => (table: string) => unknown;
    mockImplementation: (impl: (table: string) => unknown) => void;
  };
  const orig = fromMock.getMockImplementation();
  fromMock.mockImplementation((t) =>
    t === "group_members" ? makeQuery({ data: rijen, error: null }) : orig(t),
  );
  return () => {
    fromMock.mockImplementation(orig);
    invalidateAll();
  };
}

// De suggestiekaart haalt baanbeschikbaarheid via fetch (Playtomic-proxy);
// een leeg antwoord volstaat.
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
    // #674 B4: het ledental staat alleen nog als teller op de Leden-tab, de
    // kop houdt de eigenaar-badge.
    expect(await screen.findByText(/^eigenaar$/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("tab", { name: "Leden, 4" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /^ronde 2$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("0/1 uitslagen")).toBeInTheDocument();
    expect(await screen.findByText(/^afgerond$/i)).toBeInTheDocument();
  });

  it("houdt de teamgenerator op Vandaag en de suggesties op Plannen", async () => {
    renderPage();
    // De dag loopt (rondes van vandaag), dus de uitslagen staan bovenaan en de
    // teamgenerator zit achter "+ Volgende ronde" (#674 A2, #839). De
    // suggesties horen bij Plannen (#342) en horen hier niet te staan.
    expect(
      await screen.findByRole("heading", { name: /^vandaag ·/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /suggesties/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /maak teams/i }),
    ).not.toBeInTheDocument();

    // De sheet openen geeft de volle teamgenerator.
    await userEvent.click(
      screen.getByRole("button", { name: /volgende ronde/i }),
    );
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
    await userEvent.click(screen.getByRole("tab", { name: /^plannen$/i }));
    expect(
      await screen.findByRole("heading", { name: /suggesties/i }),
    ).toBeInTheDocument();
  });

  it("stelt eerlijke teams voor uit de deelnemers van het voorstel van vandaag", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /volgende ronde/i }),
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
    await userEvent.click(
      screen.getByRole("button", { name: /volgende ronde/i }),
    );
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
    await userEvent.click(
      screen.getByRole("button", { name: /volgende ronde/i }),
    );
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
    const call = (
      supabase.rpc as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls.find((c) => c[0] === "create_fair_round");
    const players = (call?.[1] as { p_players: string[] }).p_players;
    expect(players).toHaveLength(4);
    expect(new Set(players).size).toBe(4); // vier verschillende leden
  });

  it("toont de speeldag-poll op het plannen-tabblad met banen-balans", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^plannen$/i }));

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
    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));

    // Rating is de standaardweergave (fixtures: 1012/1012/988/988).
    expect(
      await screen.findByText(/gesorteerd op rating/i),
    ).toBeInTheDocument();
    expect((await screen.findAllByText("1012")).length).toBe(2);
    // Tier-badges (#127): 1012 = Wannabe III (podium), 988 = Blaaskaak I.
    expect((await screen.findAllByText("Wannabe III")).length).toBeGreaterThan(
      0,
    );
    expect((await screen.findAllByText("Blaaskaak I")).length).toBeGreaterThan(
      0,
    );

    // Toggle naar punten: de vertrouwde puntentabel met Ptn-kolom.
    await userEvent.click(screen.getByRole("button", { name: /^punten$/i }));
    expect(await screen.findByText("Ptn")).toBeInTheDocument();
    expect(screen.queryByText(/gesorteerd op rating/i)).not.toBeInTheDocument();
  });

  it("toont het voorspellersklassement onder Stand → Toto", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));
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
    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));
    expect(await screen.findByText(/groepsklassement/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /^leden/i }));
    expect(await screen.findByText(/vrienden toevoegen/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /verwijderen/i }).length,
    ).toBeGreaterThan(0);
  });

  // #674 B2: de tabbalk was een rij losse <button>'s met een is-active-class,
  // dus screenreader-gebruikers hoorden niet welke tab actief was en misten de
  // tellers (die stonden op aria-hidden).
  it("heeft echte tab-semantiek met pijltjesnavigatie (#674)", async () => {
    renderPage();
    const tablist = await screen.findByRole("tablist", {
      name: /groepsonderdelen/i,
    });
    expect(tablist).toBeInTheDocument();

    const vandaag = screen.getByRole("tab", { name: /^vandaag/i });
    expect(vandaag).toHaveAttribute("aria-selected", "true");
    // Het paneel hoort bij de actieve tab.
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      vandaag.id,
    );
    // Roving tabindex: alleen de actieve tab zit in de tabvolgorde.
    expect(vandaag).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /^stand$/i })).toHaveAttribute(
      "tabindex",
      "-1",
    );

    // Pijltje rechts: Vandaag → Historie (volgende in de balk).
    vandaag.focus();
    await userEvent.keyboard("{ArrowRight}");
    const historie = screen.getByRole("tab", { name: /^historie/i });
    expect(historie).toHaveAttribute("aria-selected", "true");
    expect(historie).toHaveFocus();
    expect(
      await screen.findByRole("heading", { name: /gespeelde matches/i }),
    ).toBeInTheDocument();

    // End springt naar de laatste tab; de teller zit in de naam.
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Leden, 4" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  // #673/#674: de URL-keys "spelen" (de oude Teams-tab), "rondes" en "matches"
  // staan hard in de edge functions en in pushberichten die al op telefoons
  // staan. Sinds Teams en Vandaag zijn samengevoegd wijzen "spelen" en
  // "rondes" allebei naar Vandaag; deze test borgt dat zo'n oude link landt.
  it("laat oude tab-keys op de juiste tab landen (#673, #674)", async () => {
    for (const key of ["spelen", "rondes"]) {
      const page = renderPage(`/groepen/g1?tab=${key}`);
      expect(
        await screen.findByRole("tab", { name: /^vandaag/i }),
      ).toHaveAttribute("aria-selected", "true");
      expect(
        screen.getByRole("heading", { name: /^wedstrijden$/i }),
      ).toBeInTheDocument();
      page.unmount();
    }

    renderPage("/groepen/g1?tab=matches");
    expect(
      await screen.findByRole("heading", { name: /gespeelde matches/i }),
    ).toBeInTheDocument();
  });

  it("slaat een uitslag optimistisch op vanuit de rondekaart", async () => {
    renderPage();
    // De invoer zit sinds #941 achter de uitklapknop van de kaart.
    await openPlannedCards();
    const inputA = await screen.findByLabelText(
      /^score alice anders & bob boers$/i,
    );
    const inputB = await screen.findByLabelText(
      /^score carol claes & dave de vos$/i,
    );
    await userEvent.type(inputA, "7");
    await userEvent.type(inputB, "5");
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));
    // Optimistisch: de kaart toont direct de uitslag.
    expect(await screen.findByText("7–5")).toBeInTheDocument();
    expect(await screen.findByText("opgeslagen ✓")).toBeInTheDocument();
  });

  it("toont de dagvoortgang bovenaan en de MVP eronder op Vandaag (#342, #839)", async () => {
    renderPage();
    // De telling zit sinds #839 in de dagkop, die de dag als geheel samenvat;
    // de hoogtepunten-kaart eronder houdt de MVP.
    expect(
      await screen.findByRole("heading", { name: /^vandaag ·/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 van 2 uitslagen binnen/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^hoogtepunten$/i }),
    ).toBeInTheDocument();
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

  // ── #917: de kop draagt de groep ────────────────────────────────────────

  it("toont in de kop de leden en de eerstvolgende speeldag", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { name: /vrijdagavond padel/i });

    const kop = container.querySelector(".group-head")!;
    // Ledenrij plus ledental — dezelfde bouwstenen als de kaart op de hub.
    expect(kop.querySelector(".group-head__leden")).not.toBeNull();
    expect(kop).toHaveTextContent(/4 leden/i);
    // De reisstatus komt uit journeyFor; die staat er zodra de polls er zijn.
    await waitFor(() =>
      expect(kop.querySelector(".group-head__journey")).not.toBeNull(),
    );
  });

  it("houdt de speeldag zichtbaar op een andere tab dan Plannen", async () => {
    // Bevinding 5: wie op Historie of Stand stond, zag niet meer wanneer er
    // weer gespeeld wordt.
    const { container } = renderPage();
    await screen.findByRole("heading", { name: /vrijdagavond padel/i });
    await waitFor(() =>
      expect(
        container.querySelector(".group-head__journey"),
      ).not.toBeNull(),
    );

    await userEvent.click(screen.getByRole("tab", { name: /^historie/i }));
    expect(container.querySelector(".group-head__journey")).not.toBeNull();
  });

  it("laat de tabbalk weten dat er meer tabs staan", async () => {
    // Zes tabs passen niet op telefoonbreedte; jsdom heeft geen layout, dus we
    // voeren de breedtes op waar useScrollSchaduw naar kijkt.
    const proto = HTMLElement.prototype;
    const origScroll = Object.getOwnPropertyDescriptor(proto, "scrollWidth");
    const origClient = Object.getOwnPropertyDescriptor(proto, "clientWidth");
    Object.defineProperty(proto, "scrollWidth", { configurable: true, value: 900 });
    Object.defineProperty(proto, "clientWidth", { configurable: true, value: 375 });
    try {
      renderPage();
      const balk = await screen.findByRole("tablist", {
        name: /groepsonderdelen/i,
      });
      await waitFor(() =>
        expect(balk).toHaveAttribute("data-schaduw", "rechts"),
      );
    } finally {
      if (origScroll) Object.defineProperty(proto, "scrollWidth", origScroll);
      if (origClient) Object.defineProperty(proto, "clientWidth", origClient);
    }
  });

  it("zet uitnodigen in de kop zolang de groep te klein is om te spelen", async () => {
    // Padel is 2v2: met twee leden kun je nog niet spelen, dus uitnodigen hoort
    // vanaf elke tab bereikbaar te zijn (#917) — niet weggestopt op Leden.
    const herstel = metLeden(["p1", "p2"]);
    try {
      const { container } = renderPage();
      await screen.findByRole("heading", { name: /vrijdagavond padel/i });
      const kop = container.querySelector(".group-head")!;
      const knop = await waitFor(() =>
        within(kop as HTMLElement).getByRole("button", {
          name: /leden uitnodigen/i,
        }),
      );

      await userEvent.click(knop);
      expect(
        screen.getByRole("tab", { name: /^leden/i }),
      ).toHaveAttribute("aria-selected", "true");
    } finally {
      herstel();
    }
  });

  it("laat de uitnodig-knop weg zodra de groep kan spelen", async () => {
    // De fixture-groep heeft vier leden.
    const { container } = renderPage();
    await screen.findByRole("heading", { name: /vrijdagavond padel/i });
    const kop = container.querySelector(".group-head")!;
    await waitFor(() =>
      expect(kop).toHaveTextContent(/4 leden/i),
    );
    expect(
      within(kop as HTMLElement).queryByRole("button", {
        name: /leden uitnodigen/i,
      }),
    ).toBeNull();
  });
});
