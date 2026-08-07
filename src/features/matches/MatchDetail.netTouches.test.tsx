import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import { openBeheer } from "@/test/matchBeheer";
import MatchDetail from "./MatchDetail";

// De sessie is p1, die in team t-ab (m-done) speelde. p2 staat in de fixtures
// met twee netrollers.
function renderPage(id: string) {
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

describe("<MatchDetail /> — netrollers (#809)", () => {
  it("toont de getelde netrollers van de deelnemers", async () => {
    renderPage("m-done");
    // Netrollers zitten sinds #1144 in het ⋯-beheermenu.
    await openBeheer(/netrollers/i);
    expect(await screen.findByText("2×")).toBeInTheDocument();
  });

  it("biedt een deelnemer een teller aan om zijn eigen netrollers in te vullen", async () => {
    renderPage("m-done");
    await openBeheer(/netrollers/i);
    // ScoreStepper labelt ook zijn ±-knoppen ("Mijn netrollers: één meer"),
    // dus exact matchen op het invoerveld zelf.
    expect(await screen.findByLabelText("Mijn netrollers")).toBeInTheDocument();
  });

  it("toont niets op een nog niet afgeronde match", async () => {
    renderPage("m-planned");
    // Wacht tot de pagina geladen is voor we de afwezigheid vaststellen.
    await screen.findByText(/gepland/i);
    // Geen netrollers-actie in het menu: die bestaat pas na afloop.
    expect(screen.queryByRole("button", { name: /netrollers/i })).toBeNull();
  });
});
