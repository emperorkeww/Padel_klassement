import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openScoreSheets } from "@/test/plannedCard";
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
import { MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";
import { dateInZone } from "@/lib/utils/time";

/** Dezelfde matchrijen als de mock hierboven: de fixture-matches op de clubdag
 *  van vandaag, zodat de Vandaag-tab ze toont. */
function matchRijen() {
  const today = dateInZone("Europe/Brussels");
  return [
    {
      ...MATCH_DONE,
      played_at: `${today}T18:00:00.000Z`,
      created_at: `${today}T18:00:00.000Z`,
    },
    { ...MATCH_PLANNED, created_at: `${today}T18:00:00.000Z` },
  ];
}

/** Vervangt tijdelijk wat de matches-tabel teruggeeft; geeft een herstelfunctie. */
function metMatches(rijen: unknown[]) {
  invalidateAll();
  const fromMock = supabase.from as unknown as {
    getMockImplementation: () => (table: string) => unknown;
    mockImplementation: (impl: (table: string) => unknown) => void;
  };
  const orig = fromMock.getMockImplementation();
  fromMock.mockImplementation((t) =>
    t === "matches" ? makeQuery({ data: rijen, error: null }) : orig(t),
  );
  return () => {
    fromMock.mockImplementation(orig);
    invalidateAll();
  };
}

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

  it("houdt de teamgenerator op Vandaag, zonder de suggesties", async () => {
    renderPage();
    // De dag loopt (rondes van vandaag), dus de uitslagen staan bovenaan en de
    // teamgenerator zit achter "+ Volgende ronde" (#674 A2, #839). De
    // suggesties horen bij het plannen (#342) en dat is sinds #1121 de agenda,
    // dus die staan hier sowieso niet meer.
    expect(
      await screen.findByRole("heading", { name: /^vandaag ·/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /suggesties/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /speelformaat/i }),
    ).not.toBeInTheDocument();

    // De sheet openen geeft de volle teamgenerator.
    await userEvent.click(
      screen.getByRole("button", { name: /volgende ronde/i }),
    );
    expect(
      await screen.findByRole("heading", { name: /speelformaat/i }),
    ).toBeInTheDocument();
    // De standaard-selectie (alle deelnemers aangetikt) wordt één tick ná het
    // verschijnen van de "Speelformaat"-kop gezet; wacht dus tot aria-checked
    // settelt i.p.v. het synchroon te lezen (voorheen flaky, #292).
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: /alice anders \(jij\)/i }),
      ).toBeChecked(),
    );
    for (const f of [/^eerlijk$/i, /^americano$/i, /^mexicano$/i]) {
      expect(screen.getByRole("tab", { name: f })).toBeInTheDocument();
    }
  });

  it("stelt eerlijke teams voor uit de deelnemers van het voorstel van vandaag", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /volgende ronde/i }),
    );
    // Het aantal rondes volgt sinds #1271 de geboekte duur, dus het label kan
    // ook "Stel 8 eerlijke rondes voor" zijn.
    await userEvent.click(
      await screen.findByRole("button", {
        name: /stel (\d+ eerlijke rondes|eerlijke teams) voor/i,
      }),
    );
    expect(await screen.findByText(/^baan 1$/i)).toBeInTheDocument();
    // Ratings uit de fixtures (1012/1012/988/988): sterk speelt met zwak,
    // dus Alice & Carol tegen Bob & Dave met een 50/50-verwachting.
    expect(screen.getByText(/alice anders & carol claes/i)).toBeInTheDocument();
    expect(screen.getByText(/bob boers & dave de vos/i)).toBeInTheDocument();
    expect(screen.getAllByText("(50%)")).toHaveLength(2);

    // "Andere verdeling" toont de op één na eerlijkste verdeling. Die knop heette
    // "Opnieuw" met de uitleg in een title-tooltip; het label draagt hem nu zelf
    // (#924).
    await userEvent.click(
      screen.getByRole("button", { name: /andere verdeling/i }),
    );
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
      await screen.findByRole("tab", { name: /^mexicano$/i }),
    );
    expect(
      screen.getByRole("button", { name: /start mexicano/i }),
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
      await screen.findByRole("tab", { name: /^americano$/i }),
    );
    // Het aantal rondes volgt sinds #1271 de geboekte duur, dus het label kan
    // ook "Start 8 Americano-rondes" zijn.
    await userEvent.click(
      screen.getByRole("button", { name: /start (\d+ )?americano/i }),
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
    await userEvent.click(screen.getByRole("tab", { name: /^punten$/i }));
    expect(await screen.findByText("Ptn")).toBeInTheDocument();
    expect(screen.queryByText(/gesorteerd op rating/i)).not.toBeInTheDocument();
  });

  it("toont het voorspellersklassement onder Stand → Toto", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));
    await userEvent.click(screen.getByRole("tab", { name: /^toto$/i }));

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

  // ── #1216: de eregalerij ís de stand, alleen die van vroeger ──────────

  it("heeft geen Eregalerij-tab meer", async () => {
    renderPage();
    await screen.findByRole("tab", { name: /^stand$/i });
    expect(
      screen.queryByRole("tab", { name: /eregalerij/i }),
    ).not.toBeInTheDocument();
    // Vier tabs over: Vandaag · Historie · Stand · Leden.
    expect(
      screen.getAllByRole("tab", { name: /vandaag|historie|stand|leden/i }),
    ).toHaveLength(4);
  });

  it("zet de eregalerij onder de stand van een afgesloten seizoen", async () => {
    renderPage("/groepen/g1?tab=stand&seizoen=2026-q1");
    // Q1 2026 is voorbij, dus de galerij hoort erbij te staan — ook al is er in
    // dat kwartaal (fixtures) niet gespeeld.
    expect(
      await screen.findByRole("heading", { name: /eregalerij/i }),
    ).toBeInTheDocument();
  });

  it("laat het lopende seizoen de gewone stand houden", async () => {
    renderPage("/groepen/g1?tab=stand");
    await screen.findByRole("tab", { name: /^stand$/i });
    expect(
      screen.queryByRole("heading", { name: /eregalerij/i }),
    ).not.toBeInTheDocument();
  });

  it("laat een oude ?tab=eregalerij-link op de stand landen", async () => {
    renderPage("/groepen/g1?tab=eregalerij");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^stand$/i })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
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
    // De invoer zit sinds #1144 in een sheet achter de primaire knop.
    await openScoreSheets();
    const inputA = await screen.findByRole("spinbutton", {
      name: /^score alice anders & bob boers$/i,
    });
    const inputB = await screen.findByRole("spinbutton", {
      name: /^score carol claes & dave de vos$/i,
    });
    await userEvent.type(inputA, "7");
    await userEvent.type(inputB, "5");
    await userEvent.click(
      screen.getByRole("button", { name: /uitslag opslaan/i }),
    );
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

  // ── #1212: één matchlijst per groep ─────────────────────────────────────
  // De tab monteerde MatchHistory rechtstreeks: geen periodefilter, geen "Te
  // spelen" — een armere kopie van /spelen?groep=<id>.

  it("geeft de Historie-tab dezelfde sectie als de Spelen-hub", async () => {
    renderPage("/groepen/g1?tab=matches");
    await screen.findByRole("heading", { name: /gespeelde matches/i });

    // Het periodefilter komt mee…
    expect(screen.getByRole("combobox", { name: /periode/i })).toBeInTheDocument();
    // …de groepskeuze niet: je zit al in een groep.
    expect(
      screen.queryByRole("combobox", { name: /^groep$/i }),
    ).not.toBeInTheDocument();
    // …en "Te spelen" zet je eigen openstaande match bovenaan.
    expect(
      await screen.findByRole("heading", { name: /^te spelen$/i }),
    ).toBeInTheDocument();
  });

  // #1298: die sectie leidde "Te spelen" af uit de volledige lijst, zonder het
  // groepsfilter dat de historie eronder wél kreeg. Op de Historie-tab van deze
  // groep stonden dus ook de geplande matches van andere groepen, mét de knop
  // "Uitslag invullen" — je vulde vanuit groep A de uitslag van groep B in.
  it("houdt Te spelen bij de matches van déze groep", async () => {
    const herstel = metMatches([
      ...matchRijen(),
      { ...MATCH_PLANNED, id: "plan-elders", group_id: "g2" },
    ]);
    try {
      renderPage("/groepen/g1?tab=matches");
      await screen.findByRole("heading", { name: /gespeelde matches/i });
      await screen.findByRole("heading", { name: /^te spelen$/i });

      // Eén openstaande match van deze groep, dus één invul-knop.
      await waitFor(() =>
        expect(
          screen.getAllByRole("button", { name: /^uitslag invullen$/i }),
        ).toHaveLength(1),
      );
    } finally {
      herstel();
    }
  });

  it("houdt de zwevende +Match-knop van die sectie buiten de groepspagina", async () => {
    renderPage("/groepen/g1?tab=matches");
    await screen.findByRole("heading", { name: /gespeelde matches/i });
    // Loggen is binnen de groep de taak van de Vandaag-tab; twee zwevende
    // ingangen naast elkaar zouden concurreren.
    expect(
      screen.queryByRole("button", { name: /^\+ ?match$/i }),
    ).not.toBeInTheDocument();
  });

  // #1298: `actief` keek naar de gekozen groep, en op deze pagina is dat het
  // route-id — altijd gevuld. De knop stond er dus permanent en wiste niets:
  // de groep zit in het pad, niet in de querystring.
  it("toont Wis filters pas als er iets te wissen valt", async () => {
    renderPage("/groepen/g1?tab=matches");
    await screen.findByRole("heading", { name: /gespeelde matches/i });
    expect(
      screen.queryByRole("button", { name: /wis filters/i }),
    ).not.toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /periode/i }),
      "30d",
    );
    const wis = screen.getByRole("button", { name: /wis filters/i });
    await userEvent.click(wis);

    expect(screen.getByRole("combobox", { name: /periode/i })).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: /wis filters/i }),
    ).not.toBeInTheDocument();
  });

  it("houdt de tab staan terwijl het periodefilter de URL bijwerkt", async () => {
    renderPage("/groepen/g1?tab=matches");
    await screen.findByRole("heading", { name: /gespeelde matches/i });

    const periode = screen.getByRole("combobox", { name: /periode/i });
    await userEvent.selectOptions(periode, "30d");

    // Eén schrijver op de querystring (speelParams.ts): het filter patcht
    // `?periode=` bovenop `?tab=matches` in plaats van de hele string te
    // vervangen — anders klapte de pagina terug naar Vandaag.
    expect(periode).toHaveValue("30d");
    expect(
      screen.getByRole("tab", { name: /^historie/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: /gespeelde matches/i }),
    ).toBeInTheDocument();
  });

  // ── #917: de kop draagt de groep ────────────────────────────────────────

  it("toont in de kop de leden en de eerstvolgende speeldag", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { name: /vrijdagavond padel/i });

    const kop = container.querySelector(".group-head")!;
    // Ledenrij plus ledental — dezelfde bouwstenen als de kaart op de hub.
    expect(kop.querySelector(".member-stack")).not.toBeNull();
    expect(kop).toHaveTextContent(/4 leden/i);
    // De reisstatus komt uit journeyFor; die staat er zodra de polls er zijn.
    await waitFor(() =>
      expect(kop.querySelector(".group-head__journey")).not.toBeNull(),
    );
  });

  // #1298: de pil beloofde met "Plan een speeldag →" een bestemming en was een
  // gewone <span> — terwijl de groepspagina sinds #1121 geen enkele route naar
  // plannen meer had. `journey.tab` zei al waar hij heen moest; niemand las het.
  it("laat de reis-pil naar de agenda wijzen", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { name: /vrijdagavond padel/i });

    await waitFor(() =>
      expect(container.querySelector(".group-head__journey")).not.toBeNull(),
    );
    const pil = container.querySelector(".group-head__journey")!;
    expect(pil.tagName).toBe("A");
    expect(pil).toHaveAttribute("href", "/agenda");
  });

  it("houdt de speeldag zichtbaar op elke tab van de groep", async () => {
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
    // Vijf tabs passen niet op telefoonbreedte; jsdom heeft geen layout, dus we
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
