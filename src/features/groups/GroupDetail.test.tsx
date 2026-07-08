import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  const { dateInZone } = await import("../../lib/time");
  // Eén voorstel voor vandaag waar alle vier de leden op "mee" staan, zodat
  // de "Vanavond"-kaart en de eerlijke-teams-generator iets te doen hebben.
  const today = dateInZone("Europe/Brussels");
  const tonight = {
    id: "prop-today",
    group_id: "g1",
    created_by: "p1",
    date: today,
    start_time: "20:00",
    courts: 1,
    club_name: null,
    created_at: "2026-07-08T10:00:00.000Z",
  };
  const tonightVotes = ["p1", "p2", "p3", "p4"].map((pid) => ({
    proposal_id: "prop-today",
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
        play_proposals: [...TABLES.play_proposals, tonight],
        play_proposal_votes: [...TABLES.play_proposal_votes, ...tonightVotes],
      },
      rpc: ["m-x"],
    }),
  };
});

import GroupDetail from "./GroupDetail";
import { supabase } from "../../lib/supabase";

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/groepen/g1"]}>
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
    expect(await screen.findByText(/4 leden · jij bent eigenaar/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /^ronde 2$/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("0/1 uitslagen")).toBeInTheDocument();
    expect(await screen.findByText(/^afgerond$/i)).toBeInTheDocument();
  });

  it("toont suggesties en 'Vanavond' in plaats van de aanwezigheids-RSVP", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /suggesties/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /wie speelt er\?/i }),
    ).not.toBeInTheDocument();
    // Lege Playtomic-stub → geen vrije momenten, nette lege staat.
    expect(
      await screen.findByText(/geen vrije momenten gevonden/i),
    ).toBeInTheDocument();
    // Het voorstel van vandaag voedt de "Vanavond"-kaart met alle deelnemers.
    expect(
      await screen.findByRole("heading", { name: /vanavond · 20:00/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /alice anders \(jij\)/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("stelt eerlijke teams voor uit de deelnemers van het voorstel van vandaag", async () => {
    renderPage();
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
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("button", { name: /^mexicano$/i }));
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

  it("toont speelvoorstellen op het plannen-tabblad; het raster zit achter 'geavanceerd'", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("button", { name: /^plannen$/i }));

    expect(
      await screen.findByRole("heading", { name: /speelvoorstellen/i }),
    ).toBeInTheDocument();
    // Het voorstel uit de fixtures: 2 doen mee, nog 2 nodig, 1 misschien.
    expect(
      await screen.findByText(/zaterdag 5 januari · 20:00/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 mee · nog 2 nodig/i)).toBeInTheDocument();
    expect(screen.getByText(/1 misschien/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /ik doe mee/i }).length,
    ).toBeGreaterThan(0);

    // Het slot-raster blijft bestaan, maar ingeklapt als geavanceerde weergave.
    expect(
      screen.getByText(/geavanceerd: beschikbaarheid per tijdslot/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /plan samen/i }),
    ).not.toBeInTheDocument();
  });

  it("toont Stand en Leden in eigen tabbladen", async () => {
    renderPage();
    await screen.findByRole("heading", { name: /^ronde 2$/i });
    await userEvent.click(screen.getByRole("button", { name: /^stand$/i }));
    expect(await screen.findByText(/groepsklassement/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^leden$/i }));
    expect(await screen.findByText(/vrienden toevoegen/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /verwijderen/i }).length,
    ).toBeGreaterThan(0);
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
});
