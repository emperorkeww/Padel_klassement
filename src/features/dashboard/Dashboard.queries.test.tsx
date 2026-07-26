import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Meetlat voor het aantal queries dat het overzicht bij mount afvuurt (#736).
// Het dashboard is het scherm dat direct na inloggen laadt; elke query die er
// ongemerkt bijkomt, betaalt iedereen bij elk bezoek. De Supabase-mock is een
// vi.fn, dus we kunnen dat gewoon tellen — geen netwerkpaneel nodig.
//
// Faalt deze test na een wijziging, kijk dan éérst of de nieuwe query echt bij
// de eerste paint hoort. Zo niet: laad hem lui (useAsync `enabled`) of bundel
// hem met een bestaande.

// De tabellen zijn per test aanpasbaar (bv. meer groepen), dus de mock leest ze
// bij elke from() opnieuw uit dit object.
const state = vi.hoisted(() => ({ tables: {} as Record<string, unknown[]> }));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables: state.tables }),
  };
});

import Dashboard from "./Dashboard";
import { supabase } from "@/lib/supabase/client";
import { GROUPS, TABLES } from "@/test/fixtures";

type Mocked = { mock: { calls: unknown[][] } };

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

/** Rendert het dashboard en telt de tabel-queries zodra alles rond is. */
async function tellQueries(): Promise<Record<string, number>> {
  render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  await screen.findByText(/hoi,/i);
  // Doorlopen tot het aantal aanroepen een paar ticks stabiel blijft. De late
  // golven (polls wachten op de groepenlijst, mijn wedstrijden op mijn teams)
  // mogen niet onder de meting uit, en één stabiele tick is daarvoor te vroeg.
  const totaal = () =>
    (supabase.from as unknown as Mocked).mock.calls.length +
    (supabase.rpc as unknown as Mocked).mock.calls.length;
  let vorig = -1;
  let stabiel = 0;
  for (let i = 0; i < 60 && stabiel < 4; i++) {
    const nu = totaal();
    stabiel = nu === vorig ? stabiel + 1 : 0;
    vorig = nu;
    await new Promise((r) => setTimeout(r, 25));
  }

  const per: Record<string, number> = {};
  for (const [tabel] of (supabase.from as unknown as Mocked).mock.calls) {
    per[String(tabel)] = (per[String(tabel)] ?? 0) + 1;
  }
  for (const [fn] of (supabase.rpc as unknown as Mocked).mock.calls) {
    per[`rpc:${String(fn)}`] = (per[`rpc:${String(fn)}`] ?? 0) + 1;
  }
  return per;
}

const som = (per: Record<string, number>) =>
  Object.values(per).reduce((a, b) => a + b, 0);

describe("Dashboard: queries bij mount (#736)", () => {
  beforeEach(() => {
    // In-place bijwerken: de mock heeft dit object bij het laden vastgepakt,
    // dus vervangen zou hem op de oude (lege) referentie laten kijken.
    for (const key of Object.keys(state.tables)) delete state.tables[key];
    Object.assign(state.tables, TABLES);
    stubPlaytomic();
    vi.clearAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("vuurt precies de verwachte set queries af", async () => {
    const per = await tellQueries();

    expect(per).toEqual({
      // Klassement, rating en de eigen historie.
      player_standings: 1,
      player_ratings: 1,
      rating_history: 1, // mijn eigen grafiek
      // NB: de gedeelde historie (rpc recent_rating_history) staat hier
      // bewust níét — die hoort bij de speelavond-kaart en wordt alleen op een
      // speeldag opgehaald (#736). Zie de test hieronder.
      // Matches: de recente uitslagen en mijn eigen wedstrijden (die eerst
      // mijn teams opzoekt — vandaar twee keer teams).
      matches: 2,
      teams: 2,
      // Namen, vrienden en groepen.
      profiles: 1,
      friendships: 1,
      groups: 1,
      // Schande- en eerbetoon-bronnen voor de hero-crest.
      zwarte_piet: 1,
      pias_of_week: 1,
      dictator_termijnen: 1,
      // Speeldag-polls van mijn groepen: drie queries in totaal, ongeacht het
      // aantal groepen (#736).
      play_polls: 1,
      play_poll_options: 1,
      play_poll_votes: 1,
      // Baanbeschikbaarheid van vandaag uit de cron-snapshot.
      court_availability_snapshots: 1,
    });
    expect(som(per)).toBe(17);
  });

  it("haalt de gedeelde rating-historie er alleen bij op een speeldag", async () => {
    // De fixture-match is gespeeld op 2026-07-02; met de klok op die dag toont
    // het overzicht de speelavond-terugblik, en pas dán is de historie nodig.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-07-02T18:00:00.000Z") });
    try {
      const per = await tellQueries();
      expect(per["rpc:recent_rating_history"]).toBe(1);
      expect(som(per)).toBe(18);
    } finally {
      vi.useRealTimers();
    }
  });

  it("schaalt niet mee met het aantal groepen", async () => {
    state.tables.groups = [
      ...GROUPS,
      { ...GROUPS[0], id: "g2", name: "Zondagochtend" },
      { ...GROUPS[0], id: "g3", name: "Woensdag laat" },
    ];

    const per = await tellQueries();

    // Vóór #736 was dit drie queries pér groep: negen in plaats van drie.
    expect(per.play_polls).toBe(1);
    expect(per.play_poll_options).toBe(1);
    expect(per.play_poll_votes).toBe(1);
    expect(som(per)).toBe(17);
  });
});
