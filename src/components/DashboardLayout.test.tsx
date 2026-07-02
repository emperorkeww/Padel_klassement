import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";

vi.mock("../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../test/supabaseMock");
  const { TABLES, SESSION } = await import("../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import DashboardLayout from "./DashboardLayout";
import { supabase } from "../lib/supabase";

function renderShell() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<div>pagina-inhoud</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<DashboardLayout />", () => {
  it("toont de gegroepeerde zijbalk, onderbalk en de pagina-inhoud", async () => {
    renderShell();
    expect(await screen.findByText("pagina-inhoud")).toBeInTheDocument();
    for (const groep of ["Spelen", "Competitie", "Account"]) {
      expect(screen.getByText(groep)).toBeInTheDocument();
    }
    // Zijbalk + mobiele onderbalk samen: links naar de hoofdonderdelen.
    expect(screen.getAllByRole("link", { name: /klassement/i }).length).toBe(2);
    expect(
      screen.getAllByRole("link", { name: /naar overzicht/i }).length,
    ).toBeGreaterThan(0);
    // Gebruikersblok in de zijbalkvoet.
    expect(await screen.findByText(/alice anders/i)).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("logt uit via de zijbalk", async () => {
    renderShell();
    await userEvent.click(
      await screen.findByRole("button", { name: /uitloggen/i }),
    );
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
