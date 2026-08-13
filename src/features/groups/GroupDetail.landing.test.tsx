import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";
import { invalidateAll } from "@/lib/supabase/queryCache";
import { dateInZone } from "@/lib/utils/time";

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
            {/* Waar een oude ?poll=-link sinds #1121 op uitkomt. */}
            <Route path="/speeldag/:id" element={<p>speeldagpagina</p>} />
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
    // …en een koude querycache. De globale setup leegt hem in afterEach, maar
    // een nog lopende keten uit de vorige test kan daarná nog een entry
    // wegschrijven; die zou de C2-test een query laten missen die hij juist
    // verwacht.
    invalidateAll();
    stubPlaytomic();
    // De fixture-matches liggen in het verleden → vandaag staat er niets.
    for (const [k, v] of Object.entries(TABLES)) tables[k] = [...v];
  });
  afterEach(() => vi.unstubAllGlobals());

  // Tot #1121 koos de reis-status tussen Plannen en Vandaag, en wachtte de
  // pagina met renderen tot de polls binnen waren. Met alleen Vandaag over valt
  // er niets te kiezen: het plannen woont nu op de agenda.
  it("landt op Vandaag, ook met een lopende poll", async () => {
    renderPage();
    expect(
      await screen.findByRole("tab", { name: /^vandaag/i }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByRole("tab", { name: /^plannen$/i }),
    ).not.toBeInTheDocument();
  });

  it("respecteert een expliciete ?tab boven de reis-status", async () => {
    renderPage("/groepen/g1?tab=stand");
    expect(await screen.findByRole("tab", { name: /^stand$/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: /^vandaag/i }),
    ).toHaveAttribute("aria-selected", "false");
  });

  // De weg omhoog stond hier als eigen link (#761, #946: pijl decoratief boven
  // de groepskop). Sinds #1299 draagt de shell hem — topbalk op mobiel, boven
  // de inhoud op desktop, dezelfde vorm als op elke andere diepe pagina — en
  // zet deze pagina er dus geen eigen naast.
  it("zet geen eigen terugweg meer boven de kop (#1299)", async () => {
    renderPage();
    // Vandaag heeft zelf ook een tabbalk, dus gericht op die van de groep.
    await screen.findByRole("tablist", { name: "Groepsonderdelen" });
    expect(screen.queryByRole("link", { name: /^alle groepen$/i })).toBeNull();
    expect(document.querySelector(".terug-link")).toBeNull();
  });

  // #674 C2: de pagina deed dertien queries bij mount, ook als je alleen een
  // uitslag kwam invullen. Wat alleen de Stand-tab voedt wacht nu tot je die
  // tab opent.
  it("haalt de klassement-data pas op als je de Stand opent", async () => {
    renderPage();
    // Vandaag heeft zelf ook een tabbalk, dus gericht op die van de groep.
    await screen.findByRole("tablist", { name: "Groepsonderdelen" });
    const tabellen = () =>
      (supabase.from as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
        (c) => c[0],
      );
    // De rating-historie blijft wél eager: die voedt de upsets en het
    // dagoverzicht op Vandaag/Historie. Eerst hierop wachten, dan pas de
    // negatieve asserties: die query hangt aan de match-lijst
    // (getRatingHistoriesForMatches) en valt dus ná de tabbalk — hoe lang
    // erná hangt af van hoe de mock-promises interleaven. Zonder wachten
    // slaagde de test alleen bij een gunstige volgorde, en dan zeggen de
    // "nog niet opgehaald"-asserties eronder ook niets.
    await waitFor(() => expect(tabellen()).toContain("rating_history"));
    for (const t of [
      "group_player_standings",
      "player_ratings",
      "match_predictions",
      "group_prediction_standings",
    ]) {
      expect(tabellen()).not.toContain(t);
    }

    await userEvent.click(screen.getByRole("tab", { name: /^stand$/i }));
    await screen.findByRole("heading", { name: /groepsklassement/i });
    expect(tabellen()).toContain("group_player_standings");
    expect(tabellen()).toContain("player_ratings");
  });

  it("landt op Vandaag zodra er vandaag wedstrijden staan", async () => {
    // Clubtijdzone (Europe/Brussels, zie stubPlaytomic), niet de kale
    // UTC-dag — anders faalt de test rond lokale middernacht net zoals de
    // gefixte bug in GroupDetail zelf (#783).
    const today = dateInZone("Europe/Brussels");
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

  // #886 gaf een gedeelde speeldag ?poll=<id> op de groepspagina; sinds #1121
  // is dat een eigen pagina. Die links staan in pushberichten die al de deur
  // uit zijn, dus de omleiding blijft staan — met én zonder ?tab.
  it("stuurt een oude ?poll=-link door naar de speeldagpagina", async () => {
    renderPage("/groepen/g1?poll=poll-1");
    expect(await screen.findByText("speeldagpagina")).toBeInTheDocument();

    cleanup();
    renderPage("/groepen/g1?tab=plannen&poll=poll-1");
    expect(await screen.findByText("speeldagpagina")).toBeInTheDocument();
  });

  // Zonder poll-id valt hij terug op de groepspagina zelf: "plannen" is daar
  // gewoon een sleutel die naar Vandaag wijst, zoals "spelen" en "rondes".
  it("laat ?tab=plannen zonder poll op Vandaag landen", async () => {
    renderPage("/groepen/g1?tab=plannen");
    expect(
      await screen.findByRole("tab", { name: /^vandaag/i }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
