import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return {
    supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: ["m-x"] }),
  };
});

import GroupDetail from "./GroupDetail";
import { supabase } from "../../lib/supabase";

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

  it("laat je aanmelden voor de speeldag", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /wie speelt er\?/i }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /ik speel mee/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("attendance");
    expect(screen.getByLabelText(/speeldag/i)).toBeInTheDocument();
  });

  it("stelt eerlijke teams voor uit de aanwezigen van de speeldag", async () => {
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
