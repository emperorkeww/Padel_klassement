import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// #674 A3 — de landingstab. Zonder ?tab kwam je altijd op Vandaag, ook op een
// dag zonder plan: een lege staat die je meteen weer doorstuurde. journeyFor()
// wist al waar de groep in de reis zit; nu bepaalt diezelfde logica ook waar
// je landt. Eigen bestand omdat de mock hier bewust géén matches van vandaag
// heeft (de hoofdsuite dateert ze juist wél op vandaag).

const tables = vi.hoisted(() => ({}) as Record<string, unknown[]>);

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables, rpc: [] }) };
});

import GroupDetail from "./GroupDetail";
import { supabase } from "@/lib/supabase/client";
import { TABLES } from "@/test/fixtures";

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

describe("<GroupDetail /> landingstab (#674)", () => {
  beforeEach(() => {
    // Schone call-historie: de C2-test kijkt naar welke tabellen zijn bevraagd.
    vi.clearAllMocks();
    stubPlaytomic();
    // De fixture-matches liggen in het verleden → vandaag staat er niets.
    for (const [k, v] of Object.entries(TABLES)) tables[k] = [...v];
  });
  afterEach(() => vi.unstubAllGlobals());

  it("landt op Plannen als er een poll loopt en vandaag niets klaarstaat", async () => {
    renderPage();
    // De fixture-poll staat open → de reis vraagt om een stem.
    expect(
      await screen.findByRole("tab", { name: /^plannen$/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      await screen.findByRole("heading", { name: /speeldag-poll/i }),
    ).toBeInTheDocument();
  });

  it("respecteert een expliciete ?tab boven de reis-status", async () => {
    renderPage("/groepen/g1?tab=stand");
    expect(await screen.findByRole("tab", { name: /^stand$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: /^plannen$/i }),
    ).toHaveAttribute("aria-selected", "false");
  });

  // #674 A4: met precies één groep stuurt /spelen je meteen naar de
  // groepspagina, dus "← Spelen" wees naar een hub die deze gebruiker nooit
  // heeft gezien — met daarop één kaart die weer hierheen leidt.
  it("verbergt de terugknop bij één groep en toont hem bij meerdere", async () => {
    renderPage();
    await screen.findByRole("tablist");
    expect(
      screen.queryByRole("link", { name: /← spelen/i }),
    ).not.toBeInTheDocument();
  });

  it("toont de terugknop wel bij meerdere groepen", async () => {
    tables.groups = [
      ...(TABLES.groups as unknown[]),
      { ...(TABLES.groups as { id: string }[])[0], id: "g2", name: "Zondag" },
    ];
    renderPage();
    expect(
      await screen.findByRole("link", { name: /← spelen/i }),
    ).toBeInTheDocument();
  });

  // #674 C2: de pagina deed dertien queries bij mount, ook als je alleen een
  // uitslag kwam invullen. Wat alleen de Stand-tab voedt wacht nu tot je die
  // tab opent.
  it("haalt de klassement-data pas op als je de Stand opent", async () => {
    renderPage();
    await screen.findByRole("tablist");
    const tabellen = () =>
      (supabase.from as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
        (c) => c[0],
      );
    for (const t of [
      "group_player_standings",
      "player_ratings",
      "match_predictions",
      "group_prediction_standings",
    ]) {
      expect(tabellen()).not.toContain(t);
    }
    // De rating-historie blijft wél eager: die voedt de upsets en het
    // dagoverzicht op Vandaag/Historie.
    expect(tabellen()).toContain("rating_history");

    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));
    await screen.findByRole("heading", { name: /groepsklassement/i });
    expect(tabellen()).toContain("group_player_standings");
    expect(tabellen()).toContain("player_ratings");
  });

  it("landt op Vandaag zodra er vandaag wedstrijden staan", async () => {
    const today = new Date().toISOString().slice(0, 10);
    tables.matches = (TABLES.matches as { id: string }[]).map((m) => ({
      ...m,
      played_at: `${today}T12:00:00.000Z`,
      created_at: `${today}T12:00:00.000Z`,
    }));
    renderPage();
    // Ad-hoc spelen kent geen poll; de wedstrijden van vandaag wegen zwaarder
    // dan een openstaande poll voor volgende maand.
    expect(
      await screen.findByRole("tab", { name: /^vandaag/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: /^wedstrijden$/i }),
    ).toBeInTheDocument();
  });
});
