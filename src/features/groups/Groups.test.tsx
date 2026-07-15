import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Groups from "./Groups";
import { supabase } from "@/lib/supabase/client";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/groepen"]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/groepen" element={<Groups />} />
            <Route path="/groepen/:id" element={<div>detailpagina</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Groups />", () => {
  it("toont de groep als klikbare kaart met eigenaar-badge en ledenaantal", async () => {
    renderPage();
    const kaart = await screen.findByRole("link", { name: /vrijdagavond padel/i });
    // De href krijgt er asynchroon "?tab=plannen" bij zodra de open poll
    // (fixtures) geladen is — alleen het pad is hier van belang, anders
    // flaket de test op die race.
    expect(kaart.getAttribute("href")).toMatch(/^\/groepen\/g1(\?|$)/);
    expect(screen.getByText(/eigenaar/i)).toBeInTheDocument();
    expect(screen.getByText(/4 leden/i)).toBeInTheDocument();
  });

  it("maakt een groep aan en gaat door naar de ledentab", async () => {
    renderPage();
    await screen.findByRole("link", { name: /vrijdagavond padel/i });
    await userEvent.type(
      screen.getByPlaceholderText(/groepsnaam/i),
      "Zondagochtend",
    );
    await userEvent.click(screen.getByRole("button", { name: /aanmaken/i }));
    expect(supabase.from).toHaveBeenCalledWith("groups");
    expect(await screen.findByText(/groep aangemaakt/i)).toBeInTheDocument();
    // Na aanmaken navigeren we naar de detailpagina van de nieuwe groep.
    expect(await screen.findByText(/detailpagina/i)).toBeInTheDocument();
  });
});