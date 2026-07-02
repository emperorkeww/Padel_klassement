import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
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
    const inputA = screen.getByLabelText(/score alice anders & bob boers/i);
    await userEvent.clear(inputA);
    await userEvent.type(inputA, "2");
    // Live voorbeeld: team B wint nu.
    expect(
      await screen.findByText(/carol claes & dave de vos wint/i),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^opslaan$/i }));
    expect(await screen.findByText(/score bijgewerkt/i)).toBeInTheDocument();
  });
});
