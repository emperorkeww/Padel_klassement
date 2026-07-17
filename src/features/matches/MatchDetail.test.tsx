import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import MatchDetail from "./MatchDetail";

function renderPage(id = "m-done") {
  return render(
    <MemoryRouter initialEntries={[`/matches/${id}`]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/matches/:id" element={<MatchDetail />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<MatchDetail />", () => {
  it("toont de uitslag met winnaar, teams en badges", async () => {
    renderPage();
    expect(await screen.findByText(/eindstand/i)).toBeInTheDocument();
    expect(await screen.findByText(/winnaar/i)).toBeInTheDocument();
    expect(await screen.findByText(/afgerond/i)).toBeInTheDocument();
    expect(await screen.findByText(/ronde 1/i)).toBeInTheDocument();
    // Groepsbadge met de groepsnaam.
    expect(await screen.findByText(/vrijdagavond padel/i)).toBeInTheDocument();
    // Delen-knop (ShareMatch) is aanwezig bij een afgeronde match.
    expect(await screen.findByText(/delen/i)).toBeInTheDocument();
  });

  it("laat de aanmaker de score corrigeren", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /score aanpassen/i }),
    );
    const inputA = screen.getByLabelText(/^score alice anders & bob boers$/i);
    await userEvent.clear(inputA);
    await userEvent.type(inputA, "2");
    // Live voorbeeld: team B wint nu.
    expect(
      await screen.findByText(/carol claes & dave de vos wint/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));
    expect(await screen.findByText(/score bijgewerkt/i)).toBeInTheDocument();
  });

  it("toont de opstelling met chemie-badges", async () => {
    renderPage();
    expect(await screen.findByText(/^opstelling$/i)).toBeInTheDocument();
    // Standaard-fixtures: elk duo heeft maar één gezamenlijke match (m-done),
    // dus beide helften melden "te weinig samen" in plaats van een oordeel.
    // (Op de badge-prefix "Chemie:" matchen — de uitleg noemt de zin ook.)
    await waitFor(() =>
      expect(
        screen.getAllByText(/chemie: nog te weinig samen/i),
      ).toHaveLength(2),
    );
  });

  it("toont Elo delta's, divisies en eventuele divisiewissels per speler", async () => {
    renderPage();
    // Check that p1's ELO and delta are shown
    expect(await screen.findByText(/1012 ELO/i)).toBeInTheDocument();
    expect(await screen.findByText(/▲7/i)).toBeInTheDocument();
    // Check that the TierBadge is rendered
    expect(await screen.findByText(/Wannabe III/i)).toBeInTheDocument();
  });
});
