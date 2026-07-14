import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Dashboard from "./Dashboard";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "../../test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";

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
  // Vierings-flags van de weekmissies hoeven hier niet opgeruimd: localStorage
  // heeft in deze testomgeving geen werkende methodes (zie test/setup.ts) en
  // readFlag/writeFlag vangen dat met try/catch af.
  beforeEach(stubPlaytomic);
  afterEach(() => vi.unstubAllGlobals());

  it("begroet de speler met stand en statistieken", async () => {
    renderPage();
    expect(await screen.findByText(/hoi, alice anders/i)).toBeInTheDocument();
    // Statblokken: rating met stijgende delta van de laatste match.
    expect((await screen.findAllByText("1012")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/▲/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Rating")).toBeInTheDocument();
    // Tier-badge (#127) bij de rating: 1012 = Wannabe III, gedimd (1 match).
    const tiers = await screen.findAllByText("Wannabe III");
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[0]).toHaveClass("is-dim");
  });

  it("toont de eerstvolgende geplande match compact met doorlink naar invullen", async () => {
    renderPage();
    expect(await screen.findByText(/jouw volgende match/i)).toBeInTheDocument();
    // Compact (#273): geen score-invoer op het overzicht, wél een link naar de
    // match-detail waar de uitslag ingevuld wordt.
    const invullen = await screen.findByRole("link", { name: /invullen/i });
    expect(invullen.getAttribute("href")).toMatch(/^\/matches\//);
    expect(screen.queryByRole("button", { name: /^opslaan$/i })).toBeNull();
    // Actiestrook: één openstaande uitslag.
    expect(await screen.findByText(/uitslag wacht op jou/i)).toBeInTheDocument();
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

  it("toont de lopende speeldag-poll prominent op het overzicht", async () => {
    renderPage();
    expect(
      await screen.findByText(/speeldag-poll loopt · vrijdagavond padel/i),
    ).toBeInTheDocument();
    // Alice stemde al (fixtures) → neutrale call-to-action.
    expect(
      screen.getByRole("link", { name: /bekijk de poll/i }),
    ).toBeInTheDocument();
  });

  it("bundelt de secundaire gamification achter één inklapper (#276)", async () => {
    renderPage();
    const titel = await screen.findByText(/jouw spel & stats/i);
    const details = titel.closest("details");
    expect(details).not.toBeNull();
    // Weekmissies zit binnen die inklapper, niet los op het overzicht.
    expect(details!.querySelector(".week-missions")).not.toBeNull();
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

  it("toont badge-uitleg bij tik op een hero-badge zonder te navigeren", async () => {
    renderPage();
    const badge = await screen.findByRole("button", {
      name: /Eerste overwinning/,
    });

    // De badge zit niet meer in een link; navigeren kan alleen via de pijl.
    expect(badge.closest("a")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Alle badges bekijken" }),
    ).toBeInTheDocument();

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
