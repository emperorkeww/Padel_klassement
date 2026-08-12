import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Dashboard from "./Dashboard";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { MATCH_PLANNED, PROFILES, TABLES } from "@/test/fixtures";
import { isoParts } from "@/features/standings/pias";

// De baanbeschikbaarheid komt via fetch (Playtomic-proxy); leeg antwoord volstaat.
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

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Dashboard />", () => {
  beforeEach(stubPlaytomic);
  afterEach(() => vi.unstubAllGlobals());

  it("begroet de speler met stand en statistieken", async () => {
    // Vast "nu" op de fixture-speeldag: de ▲/▼-badge toont de dag-cumulatieve
    // delta (#352), dus de klok moet op de dag van de laatste match staan.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-02T10:00:00.000Z") });
    try {
      renderPage();
      expect(await screen.findByText(/hoi, alice anders/i)).toBeInTheDocument();
      // Statblokken: rating met de opgetelde delta van vandaag (alleen m-done, +7).
      expect((await screen.findAllByText("1012")).length).toBeGreaterThan(0);
      expect((await screen.findAllByText(/▲7/)).length).toBeGreaterThan(0);
      expect(screen.getByText("Rating")).toBeInTheDocument();
      // Tier-badge (#127) bij de rating: 1012 = Wannabe III, gedimd (1 match).
      const tiers = await screen.findAllByText("Wannabe III");
      expect(tiers.length).toBeGreaterThan(0);
      expect(tiers[0]).toHaveClass("is-dim");
    } finally {
      vi.useRealTimers();
    }
  });

  // De profielweergave was alleen bereikbaar via de Rating-kaart, ver onder de
  // vouw (#706). De hero-avatar is nu de primaire ingang, mét zichtbaar label —
  // een klikbare avatar alleen is niet vindbaar.
  it("linkt vanuit de hero-avatar naar de eigen profielweergave", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: /naar mijn profiel/i });
    expect(link).toHaveAttribute("href", "/spelers/p1");
    expect(link).toHaveTextContent(/mijn profiel/i);
    // De ingang staat in de hero, niet pas in de Rating-kaart onderaan.
    expect(link.closest(".hero")).not.toBeNull();
  });

  it("toont de eerstvolgende geplande match compact, met de weg naar het detail", async () => {
    renderPage();
    expect(await screen.findByText(/jouw volgende match/i)).toBeInTheDocument();
    // Compact (#273): de kaart zelf blijft klein — corrigeren, verzetten en
    // verwijderen wonen op het matchdetail, en die weg blijft open.
    const detail = await screen.findByRole("link", { name: /bekijk de match/i });
    expect(detail.getAttribute("href")).toMatch(/^\/matches\//);
    // Eén openstaande uitslag: die pakt de kaart, dus de chip blijft weg (#1210).
    expect(screen.queryByText(/wacht op jou/i)).toBeNull();
  });

  // #1210: van "er wacht een uitslag op mij" naar "de uitslag staat er" waren
  // drie tot vier tikken plus zoekwerk. De sheet hoort hier open te gaan.
  it("vult een uitslag in zonder het overzicht te verlaten", async () => {
    renderPage();
    await screen.findByText(/jouw volgende match/i);

    await userEvent.click(
      await screen.findByRole("button", { name: /uitslag invullen/i }),
    );
    const sheet = await screen.findByRole("dialog", { name: /uitslag/i });

    await userEvent.type(
      within(sheet).getByRole("spinbutton", {
        name: /^score alice anders & bob boers$/i,
      }),
      "6",
    );
    await userEvent.type(
      within(sheet).getByRole("spinbutton", {
        name: /^score carol claes & dave de vos$/i,
      }),
      "4",
    );
    await userEvent.click(
      within(sheet).getByRole("button", { name: /uitslag opslaan/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // De schrijfactie ging langs de gewone weg (matches.update), niet langs een
    // eigen dashboard-route.
    expect(supabase.from).toHaveBeenCalledWith("matches");
  });

  it("toont een foutstaat i.p.v. onboarding als een kernquery faalt", async () => {
    // Verse cache, en de klassement-query laten falen (issue #67).
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) =>
      table === "player_standings"
        ? makeQuery({ data: null, error: new Error("boem") })
        : orig(table),
    );
    try {
      renderPage();
      expect(
        await screen.findByText(/het dashboard kon niet laden/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /opnieuw proberen/i }),
      ).toBeInTheDocument();
      // Geen misleidende onboarding-tekst of lege stats.
      expect(screen.queryByText(/speel je eerste match/i)).toBeNull();
      expect(screen.queryByText(/topspelers/i)).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  it("dupliceert geen andere schermen meer op het overzicht (#273)", async () => {
    // Feed, matcharchief, klassement en het volledige banenrooster wonen op hun
    // eigen tab; het overzicht spiegelt ze niet langer inline.
    renderPage();
    expect(await screen.findByText(/jouw volgende match/i)).toBeInTheDocument();
    expect(screen.queryByText(/recente activiteit/i)).toBeNull();
    expect(screen.queryByText(/recente uitslagen/i)).toBeNull();
    expect(screen.queryByText(/topspelers/i)).toBeNull();
    // Banen blijft als compacte teaser (geen volledig rooster).
    expect(screen.getByText(/vrije banen vandaag/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /alle dagen/i }),
    ).toHaveAttribute("href", "/banen");
  });

  it("houdt in de hero één primaire actie over (#1242)", async () => {
    renderPage();
    const loggen = await screen.findByRole("link", { name: /match loggen/i });
    expect(loggen).toHaveAttribute("href", "/spelen?log=1");
    expect(loggen).toHaveClass("btn--primary");
    // De genereer-CTA (#73) en de banen-knop zijn weg: de Spelen-tab draagt
    // beide ingangen en de baanteaser-kaart wijst al naar /banen. Drie knoppen
    // maakten van de belangrijkste er geen.
    expect(
      screen.queryByRole("link", { name: /wedstrijden genereren/i }),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /maak een groep/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^vrije banen$/i })).toBeNull();
  });

  it("laat je op het overzicht zelf op de lopende speeldag stemmen (#1196)", async () => {
    const { container } = renderPage();
    // Alice stemde al op het enige moment (fixtures) → rustige kop, maar de
    // knoppen blijven staan om je keuze te kunnen herzien.
    expect(
      await screen.findByText(/je stem staat genoteerd · vrijdagavond padel/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ik kan — zaterdag 5 januari 20:00/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("link", { name: /bekijk de speeldag/i }),
    ).toBeInTheDocument();

    // En de zone blijft staan terwijl je stemt. Een stem herlaadt de polls (en
    // realtime doet het nog eens); useAsync zet dan `loading` terwijl de vorige
    // data gewoon blijft staan. Op de kale vlag wisselde de hele zone daardoor
    // naar het skelet en terug, precies onder de vinger waarmee je net tikte.
    const skeletten: number[] = [];
    const obs = new MutationObserver(() => {
      if (container.querySelector(".dash-vandaag__skeleton")) skeletten.push(1);
    });
    obs.observe(container, { childList: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: /^misschien —/i }));
    // Het hele herlaadrondje uitlopen: de stem, de reload en zijn antwoord.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    obs.disconnect();

    expect(skeletten).toHaveLength(0);
    expect(container.querySelector(".stemkaart")).not.toBeNull();
  });

  // #276 vouwde de gamification-extra's op; #911 trok statsrij en rating erbij,
  // zodat het hele "hoe sta ik ervoor"-blok in dezelfde inklapper zit in plaats
  // van als losse kaarten met de rest te concurreren.
  it("bundelt het hele cijfer-blok achter één inklapper (#276/#911)", async () => {
    const { container } = renderPage();
    const titel = await screen.findByText(/jouw cijfers/i);
    const details = titel.closest("details");
    expect(details).not.toBeNull();
    // Wachten, niet meteen kijken: de kop staat er zodra de inklapper rendert,
    // maar missies, statsrij en rating hangen elk aan hun eigen bron. Zonder
    // deze waitFor is de test een race die alleen wint zolang die bronnen
    // toevallig vóór de kop binnen zijn.
    for (const sel of [".week-missions", ".stats", ".rating-card"]) {
      await waitFor(() => expect(details!.querySelector(sel)).not.toBeNull());
    }
    // En er is er maar één; geen inklapper-in-een-inklapper.
    expect(container.querySelectorAll("details.dash-cijfers")).toHaveLength(1);
  });

  it("houdt het pias-alarm búiten de inklapper (#276)", async () => {
    // Tijdgevoelige waarschuwing: die mag je niet kunnen wegvouwen.
    const { container } = renderPage();
    await screen.findByText(/jouw cijfers/i);
    const alarm = container.querySelector(".pias-card");
    if (alarm) expect(alarm.closest("details.dash-cijfers")).toBeNull();
  });

  it("zet geen pillenstrook meer onder de hero (#1232)", async () => {
    // Precies de situatie waarin de strook vóór #1232 verscheen: twee
    // openstaande uitslagen (de kaart pakt er één, de chip wees naar de rest)
    // én een binnengekomen vriendschapsverzoek. Beide signalen staan nu
    // elders — de matchkaart hieronder, de attentiestip op Spelen (#1227) en
    // de meldingen-inbox (#1090) — dus hier hoort niets meer te staan.
    const extra = { ...MATCH_PLANNED, id: "m-plan-strip", round_number: 3 };
    const verzoek = {
      id: "f-pending",
      requester_id: "p5",
      addressee_id: "p1",
      status: "pending",
      created_at: TABLES.friendships[0].created_at,
      updated_at: TABLES.friendships[0].updated_at,
    };
    const matches = TABLES.matches;
    const friendships = TABLES.friendships;
    TABLES.matches = [...matches, extra];
    TABLES.friendships = [...friendships, verzoek];
    invalidateAll();
    try {
      const { container } = renderPage();
      await screen.findByText(/vul de uitslag in|jouw volgende match/i);
      expect(container.querySelector(".todo-strip")).toBeNull();
      expect(container.querySelector("[class*='todo-chip']")).toBeNull();
      expect(screen.queryByText(/vriendschapsverzoek/i)).toBeNull();
      expect(screen.queryByText(/wacht(en)? op jou/i)).toBeNull();
      // De hero sluit direct aan op het eerstvolgende blok van de pagina.
      const hero = container.querySelector(".dashboard > .hero");
      expect(hero).not.toBeNull();
      expect(hero!.nextElementSibling).not.toBeNull();
      expect(hero!.nextElementSibling!.className).not.toMatch(/todo-/);
      // En het openstaande signaal is verplaatst, niet verdwenen: de matchkaart
      // biedt de uitslag zelf aan.
      expect(container.querySelector(".dash-zone")).not.toBeNull();
    } finally {
      TABLES.matches = matches;
      TABLES.friendships = friendships;
      invalidateAll();
    }
  });

  it("reserveert de ruimte van de vandaag-zone tijdens het laden (#911)", async () => {
    // Poll, volgende match en avondkaart kwamen elk apart binnen en duwden de
    // rest omlaag terwijl je al las. Nu staat er eerst één placeholder.
    const { container } = renderPage();
    expect(container.querySelector(".dash-vandaag__skeleton")).not.toBeNull();
    expect(screen.queryByText(/jouw volgende match/i)).toBeNull();

    // En zodra alle drie de bronnen er zijn, wisselt de zone in één keer.
    await screen.findByText(/jouw volgende match/i);
    expect(container.querySelector(".dash-vandaag__skeleton")).toBeNull();
  });

  it("toont een nieuwe speler één lege staat i.p.v. een rij nullen (#911)", async () => {
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    // Geen klassementsrij = nog niet gespeeld.
    fromMock.mockImplementation((table) =>
      table === "player_standings"
        ? makeQuery({ data: [], error: null })
        : orig(table),
    );
    try {
      const { container } = renderPage();
      expect(
        await screen.findByText(/je cijfers beginnen bij je eerste match/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /uitslag invullen/i }),
      ).toHaveAttribute("href", "/spelen?log=1");
      // Geen inklapper met lege kaarten eronder.
      expect(container.querySelector("details.dash-cijfers")).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  it("toont de weekmissies-kaart met drie voortgangsbalken", async () => {
    const { container } = renderPage();
    expect(await screen.findByText("Weekmissies")).toBeInTheDocument();
    const kaart = container.querySelector(".week-missions");
    expect(kaart).not.toBeNull();
    // Precies drie missies (welke is seed-afhankelijk — alleen structuur checken).
    const balken = kaart!.querySelectorAll('[role="progressbar"]');
    expect(balken).toHaveLength(3);
    for (const balk of balken) {
      expect(balk).toHaveAttribute("aria-valuemin", "0");
      expect(Number(balk.getAttribute("aria-valuemax"))).toBeGreaterThan(0);
    }
  });

  it("toont de Wrapped-banner alleen in het eindejaarsvenster", async () => {
    // Vast "nu" op 20 december: bannervenster open, beschikbaar jaar 2026
    // (de fixture-match van juli 2026 telt mee). Alleen Date faken.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 11, 20, 12) });
    try {
      renderPage();
      expect(
        await screen.findByText(/jouw jaar in padel is klaar/i),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Bekijk" }));
      expect(
        await screen.findByRole("dialog", { name: /wrapped 2026/i }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("verbergt de Wrapped-banner buiten het venster", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 6, 11, 12) });
    try {
      renderPage();
      expect(await screen.findByText(/hoi, alice anders/i)).toBeInTheDocument();
      expect(screen.queryByText(/jouw jaar in padel is klaar/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("kleurt de hero roze voor de Big Daddy bij een vacante troon (#613)", async () => {
    invalidateAll();
    const { container } = renderPage();
    // Alice staat #1 (rating-tie-break) en dictator_termijnen is leeg (vacante
    // troon) → de kaart zelf draagt het Big Daddy-thema, mét de kroon-chip
    // ernaast zodat kleur nooit de enige indicator is.
    expect(
      await screen.findByRole("button", { name: /big daddy/i }),
    ).toBeInTheDocument();
    expect(container.querySelector(".hero")).toHaveClass("hero--bigdaddy");
    expect(container.querySelector(".hero--dictator")).toBeNull();
  });

  it("kleurt de hero keizerlijk voor de zittende dictator, met propaganda (#613)", async () => {
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) =>
      table === "dictator_termijnen"
        ? makeQuery({
            data: [
              { profile_id: "p1", begon_op: "2026-07-01T10:00:00Z", claim_rating: 1620 },
            ],
            error: null,
          })
        : orig(table),
    );
    try {
      const { container } = renderPage();
      // Propaganda-copy (dictatorPropaganda) i.p.v. de Big Daddy-roast.
      expect(
        await screen.findByRole("button", {
          name: /el padelissimo: zittende dictator — /i,
        }),
      ).toBeInTheDocument();
      expect(container.querySelector(".hero")).toHaveClass("hero--dictator");
      // Wederzijds uitsluitend, net als op het klassement: geen kroon erbij.
      expect(
        screen.queryByRole("button", { name: /big daddy/i }),
      ).toBeNull();
      expect(container.querySelector(".hero--bigdaddy")).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  it("dooft de Big Daddy-styling zodra een ánder de troon bezet (#613)", async () => {
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) =>
      table === "dictator_termijnen"
        ? makeQuery({
            data: [
              { profile_id: "p2", begon_op: "2026-07-01T10:00:00Z", claim_rating: 1610 },
            ],
            error: null,
          })
        : orig(table),
    );
    try {
      const { container } = renderPage();
      // Wachten tot de afgeleide hero-data er staat (badges uit myMatches),
      // zodat de troon-query zeker verwerkt is vóór de asserts.
      await screen.findByRole("button", { name: /Eerste overwinning/ });
      // Alice is #1, maar Bob zit op De Troon: neutraal — geen kroon, geen
      // thema, exact zoals het klassement (Podium dooft de kroon ook).
      expect(
        screen.queryByRole("button", { name: /big daddy/i }),
      ).toBeNull();
      expect(container.querySelector(".hero")).toHaveClass("hero");
      expect(container.querySelector(".hero--bigdaddy")).toBeNull();
      expect(container.querySelector(".hero--dictator")).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  // Hero-thema's per status (#644, uitgebreid in #760): de Pias van de week en
  // de Zwarte Piet kleuren de hero net zo goed als de eer dat doet, en sinds
  // #760 doen de kampioen, de speler van de week en een lopende reeks dat ook.
  // De crest-chips blijven in álle gevallen staan — kleur is nooit de enige
  // indicator.
  describe("hero-thema's per status (#644/#760)", () => {
    const fromMock = () =>
      supabase.from as unknown as {
        getMockImplementation: () => (table: string) => unknown;
        mockImplementation: (impl: (table: string) => unknown) => void;
      };
    const rpcMock = () =>
      supabase.rpc as unknown as {
        getMockImplementation: () => (naam: string, args?: unknown) => unknown;
        mockImplementation: (
          impl: (naam: string, args?: unknown) => unknown,
        ) => void;
      };

    /** Eén punt in de gedeelde rating-historie (recent_rating_history). */
    const histRij = (delta: number, playedAt: string, playerId = "p1") => ({
      player_id: playerId,
      match_id: `m-${playedAt}`,
      rating_before: 1000,
      rating_after: 1000 + delta,
      delta,
      played_at: playedAt,
    });

    /** Rendert met extra/vervangen tabelrijen. `troonBezet` zet Bob op De Troon,
     *  waardoor Alice haar Big Daddy-status kwijt is (#528) — nodig om een
     *  lager thema kaal te kunnen zien.
     *
     *  De gedeelde historie is standaard leeg en wordt per test gevuld met
     *  `historie`. Sinds #760 hangen de In-Form- en On-Fire-status daaraan, en
     *  met de fixture-historie is Alice in de vaste week gewoon In-Form (+12) —
     *  dat thema verdringt de schande, waardoor de pias-tests hieronder over
     *  iets anders zouden gaan dan hun naam belooft. Elke test die een
     *  eer-status wíl, zegt hier dus zelf welke matches dat rechtvaardigen.
     *  `kampioen` doet hetzelfde voor de seizoensstand. */
    function renderMet(
      rijen: Record<string, unknown[]>,
      opts: {
        troonBezet?: boolean;
        historie?: unknown[];
        kampioen?: unknown[];
      } = {},
    ) {
      invalidateAll();
      const mock = fromMock();
      const orig = mock.getMockImplementation();
      mock.mockImplementation((table) => {
        if (table in rijen)
          return makeQuery({ data: rijen[table], error: null });
        if (opts.troonBezet && table === "dictator_termijnen")
          return makeQuery({
            data: [
              { profile_id: "p2", begon_op: "2026-07-01T10:00:00Z", claim_rating: 1610 },
            ],
            error: null,
          });
        return orig(table);
      });
      const rmock = rpcMock();
      const origRpc = rmock.getMockImplementation();
      rmock.mockImplementation((naam, args) => {
        if (naam === "recent_rating_history")
          return makeQuery({ data: opts.historie ?? [], error: null });
        if (naam === "season_player_standings")
          return makeQuery({ data: opts.kampioen ?? [], error: null });
        return origRpc(naam, args);
      });
      return {
        ...renderPage(),
        herstel: () => {
          mock.mockImplementation(orig);
          rmock.mockImplementation(origRpc);
          invalidateAll();
        },
      };
    }

    const piasRij = (weekStart: string) => ({
      group_id: "g1",
      iso_year: Number(weekStart.slice(0, 4)),
      iso_week: 27,
      player_id: "p1",
      match_id: "m-done",
      reden: "afdroging",
      ernst: 3,
      waarde: 12,
      win_chance: null,
      week_start: weekStart,
    });

    const pietRij = {
      group_id: "g1",
      holder_id: "p1",
      from_id: "p2",
      reden: "afdroging",
      ernst: 3,
      detail: "6-0 6-1",
      match_id: "m-done",
      since: "2026-07-01",
    };

    /** De pias hangt aan de lópende ISO-week, dus de klok moet vaststaan. */
    async function metVasteWeek(fn: (weekStart: string) => Promise<void>) {
      const now = new Date("2026-07-08T10:00:00.000Z");
      vi.useFakeTimers({ toFake: ["Date"], now });
      try {
        await fn(isoParts(now).weekStart);
      } finally {
        vi.useRealTimers();
      }
    }

    it("kleurt de hero platina-lauwer voor de kampioen (#760)", async () => {
      // Bob op De Troon, dus Alice mist de kroon: het kampioen-thema staat er
      // kaal. De seizoensstand is de bron van de 🏆-editie op de FUT-kaart.
      const { container, herstel } = renderMet(
        {},
        { troonBezet: true, kampioen: [{ player_id: "p1" }] },
      );
      try {
        expect(
          await screen.findByRole("button", { name: /kampioen/i }),
        ).toBeInTheDocument();
        expect(container.querySelector(".hero")).toHaveClass("hero--kampioen");
      } finally {
        herstel();
      }
    });

    it("legt de In-Form-overlay over de kaart voor de speler van de week (#760/#771)", async () => {
      await metVasteWeek(async () => {
        // Twee winsten binnen het weekvenster, samen +48 — meer dan Bob's +10.
        // De crest-tekst komt uit editieLabel, dus staat er hetzelfde als op de
        // kaart in het klassement.
        const { container, herstel } = renderMet(
          {},
          {
            troonBezet: true,
            historie: [
              histRij(20, "2026-07-06T10:00:00.000Z"),
              histRij(28, "2026-07-07T10:00:00.000Z"),
              histRij(5, "2026-07-06T10:00:00.000Z", "p2"),
              histRij(5, "2026-07-07T10:00:00.000Z", "p2"),
            ],
          },
        );
        try {
          expect(
            await screen.findByRole("button", { name: /in-form · \+48/i }),
          ).toBeInTheDocument();
          // Sinds #771 een overlay: de kaart houdt zijn eigen basis (hier geen
          // permanent thema) en krijgt de glans erover, met een tint-laag die de
          // kaart eronder laat doorschemeren.
          const hero = container.querySelector(".hero");
          expect(hero).toHaveClass("hero--overlay-inform");
          expect(hero).not.toHaveClass("hero--inform");
          expect(container.querySelector(".hero__sheen--inform")).toBeInTheDocument();
        } finally {
          herstel();
        }
      });
    });

    it("legt de On Fire-overlay over de kaart voor een lopende reeks (#760/#771)", async () => {
      await metVasteWeek(async () => {
        // Vijf winsten op rij (ONFIRE_DREMPEL), maar allemaal ouder dan het
        // In-Form-venster van zeven dagen: zo staat het On-Fire-thema er kaal,
        // zonder dat de weeklens het verdringt.
        const { container, herstel } = renderMet(
          {},
          {
            troonBezet: true,
            historie: [10, 11, 12, 13, 14].map((dag) =>
              histRij(6, `2026-06-${dag}T10:00:00.000Z`),
            ),
          },
        );
        try {
          expect(
            await screen.findByRole("button", { name: /on fire · 5 op rij/i }),
          ).toBeInTheDocument();
          expect(container.querySelector(".hero")).toHaveClass(
            "hero--overlay-onfire",
          );
          expect(screen.queryByRole("button", { name: /in-form/i })).toBeNull();
        } finally {
          herstel();
        }
      });
    });

    it("laat de kampioenstitel de schande verdringen, met beide crests (#760)", async () => {
      await metVasteWeek(async (week) => {
        const { container, herstel } = renderMet(
          { pias_of_week: [piasRij(week)] },
          { troonBezet: true, kampioen: [{ player_id: "p1" }] },
        );
        try {
          expect(
            await screen.findByRole("button", { name: /kampioen/i }),
          ).toBeInTheDocument();
          // Het vlak kiest partij, de chips blijven allebei staan.
          expect(
            screen.getByRole("button", { name: /pias van de week/i }),
          ).toBeInTheDocument();
          expect(container.querySelector(".hero")).toHaveClass("hero--kampioen");
          expect(container.querySelector(".hero--pias")).toBeNull();
        } finally {
          herstel();
        }
      });
    });

    it("kleurt de hero als kraftkarton voor de Pias van de week", async () => {
      await metVasteWeek(async (week) => {
        const { container, herstel } = renderMet(
          { pias_of_week: [piasRij(week)] },
          { troonBezet: true },
        );
        try {
          expect(
            await screen.findByRole("button", { name: /pias van de week/i }),
          ).toBeInTheDocument();
          expect(container.querySelector(".hero")).toHaveClass("hero--pias");
          expect(container.querySelector(".hero--piet")).toBeNull();
        } finally {
          herstel();
        }
      });
    });

    it("laat de In-Form-overlay de piaskaart niet vervangen (#771)", async () => {
      await metVasteWeek(async (week) => {
        // De kern van #771: Alice is deze week de pias van haar groep én de
        // speler van de week van de club. Vóór #771 nam In-Form de hele kaart
        // over en verdween de schande; nu blijft het kraftkarton staan met de
        // glans erover, en is de tijdelijke status de badge vooraan.
        const { container, herstel } = renderMet(
          { pias_of_week: [piasRij(week)] },
          {
            troonBezet: true,
            historie: [
              histRij(20, "2026-07-06T10:00:00.000Z"),
              histRij(28, "2026-07-07T10:00:00.000Z"),
              histRij(5, "2026-07-06T10:00:00.000Z", "p2"),
              histRij(5, "2026-07-07T10:00:00.000Z", "p2"),
            ],
          },
        );
        try {
          const inform = await screen.findByRole("button", {
            name: /in-form · \+48/i,
          });
          const hero = container.querySelector(".hero");
          expect(hero).toHaveClass("hero--pias");
          expect(hero).toHaveClass("hero--overlay-inform");
          // Beide titels blijven leesbaar; de overlay is de badge, de pias een chip.
          expect(inform).toHaveClass("hero-crest--badge");
          expect(
            screen.getByRole("button", { name: /pias van de week/i }),
          ).not.toHaveClass("hero-crest--badge");
        } finally {
          herstel();
        }
      });
    });

    it("kleurt de hero als speelkaart voor de Zwarte Piet", async () => {
      const { container, herstel } = renderMet(
        { zwarte_piet: [pietRij] },
        { troonBezet: true },
      );
      try {
        expect(
          await screen.findByRole("button", { name: /zwarte piet/i }),
        ).toBeInTheDocument();
        expect(container.querySelector(".hero")).toHaveClass("hero--piet");
        expect(container.querySelector(".hero--pias")).toBeNull();
      } finally {
        herstel();
      }
    });

    it("laat de pias van deze week winnen van het rondgaande token", async () => {
      await metVasteWeek(async (week) => {
        const { container, herstel } = renderMet(
          { pias_of_week: [piasRij(week)], zwarte_piet: [pietRij] },
          { troonBezet: true },
        );
        try {
          // Beide chips blijven staan; alleen het vlak kiest partij.
          expect(
            await screen.findByRole("button", { name: /pias van de week/i }),
          ).toBeInTheDocument();
          expect(
            screen.getByRole("button", { name: /zwarte piet/i }),
          ).toBeInTheDocument();
          expect(container.querySelector(".hero")).toHaveClass("hero--pias");
          expect(container.querySelector(".hero--piet")).toBeNull();
        } finally {
          herstel();
        }
      });
    });

    it("laat de Big Daddy-kroon de schande verdringen", async () => {
      // Vacante troon: Alice is #1 én draagt het schande-token. Verdienste
      // wint van schande, zoals in EDITIE_PRIORITEIT op de FUT-kaart.
      const { container, herstel } = renderMet({ zwarte_piet: [pietRij] });
      try {
        expect(
          await screen.findByRole("button", { name: /big daddy/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /zwarte piet/i }),
        ).toBeInTheDocument();
        expect(container.querySelector(".hero")).toHaveClass("hero--bigdaddy");
        expect(container.querySelector(".hero--piet")).toBeNull();
      } finally {
        herstel();
      }
    });

    it("dooft het thema bij een roast-schild, maar houdt de crest", async () => {
      const { container, herstel } = renderMet(
        {
          zwarte_piet: [pietRij],
          profiles: PROFILES.map((p) =>
            p.id === "p1" ? { ...p, roast_schild: true } : p,
          ),
        },
        { troonBezet: true },
      );
      try {
        // Het feit blijft (neutrale 📊-variant), de spot verdwijnt.
        expect(
          await screen.findByRole("button", { name: /schande-token/i }),
        ).toBeInTheDocument();
        expect(container.querySelector(".hero--piet")).toBeNull();
        expect(container.querySelector(".hero--pias")).toBeNull();
        expect(container.querySelector(".hero")).toHaveClass("hero");
      } finally {
        herstel();
      }
    });
  });

  it("toont badge-uitleg bij tik op een hero-badge zonder te navigeren", async () => {
    renderPage();
    const badge = await screen.findByRole("button", {
      name: /Eerste overwinning/,
    });

    // De badge zit niet in een link; en zolang de hele kast in de rij past is
    // er ook geen overloop-link (#1242) — de profiel-ingang is de avatar.
    expect(badge.closest("a")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Alle badges bekijken" }),
    ).toBeNull();

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      /Eerste overwinning/,
    );

    // Nogmaals tikken sluit de uitleg weer.
    fireEvent.click(badge);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
