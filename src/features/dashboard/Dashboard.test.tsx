import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Dashboard from "./Dashboard";
import { supabase } from "../../lib/supabase";
import { makeQuery } from "../../test/supabaseMock";
import { invalidateAll } from "../../lib/queryCache";

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
    renderPage();
    expect(await screen.findByText(/hoi, alice anders/i)).toBeInTheDocument();
    // Statblokken: rating met stijgende delta van de laatste match.
    expect((await screen.findAllByText("1012")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/▲/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Rating")).toBeInTheDocument();
    // Tier-badge (#127) bij de rating: 1012 = Goud III, gedimd (1 match).
    const tiers = await screen.findAllByText("Goud III");
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[0]).toHaveClass("is-dim");
  });

  it("toont de eerstvolgende geplande match met score-invoer", async () => {
    renderPage();
    expect(await screen.findByText(/jouw volgende match/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /naar groep/i }),
    ).toBeInTheDocument();
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

  it("toont topspelers en recente uitslagen", async () => {
    renderPage();
    expect(await screen.findByText(/topspelers/i)).toBeInTheDocument();
    expect(await screen.findByText(/recente uitslagen/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/carol claes/i)).length).toBeGreaterThan(0);
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
