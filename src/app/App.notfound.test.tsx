import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

// De shell hangt aan een reeks aankondigings-hooks; die hebben hier niets te
// melden en zouden alleen ruis geven bij het toetsen van de 404.
vi.mock("@/features/standings/ratingsApi", () => ({
  getRatingHistory: vi.fn().mockResolvedValue([]),
  getPlayerRatings: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/features/matches/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/matches/api")>()),
  getPlayerMatches: vi.fn().mockResolvedValue([]),
  getTeamsMap: vi.fn().mockResolvedValue({}),
}));

import App from "./App";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

function renderPad(pad: string) {
  return render(
    <MemoryRouter initialEntries={[pad]}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

// #910: een onbekend pad ging via `<Navigate to="/" replace />` stil naar het
// overzicht — een typefout of dode link landde dan zonder uitleg op een pagina
// die je niet vroeg.
describe("<App /> onbekend pad (#910)", () => {
  it("toont een 404 met een weg terug in plaats van stil te redirecten", async () => {
    renderPad("/bestaat-niet");

    expect(
      await screen.findByRole("heading", { name: /pagina niet gevonden/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("/bestaat-niet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Naar het overzicht" }),
    ).toBeInTheDocument();
    // De weg naar wáár je vandaan kwam draagt de shell sinds #1299 — in de
    // topbalk op mobiel en boven de inhoud op desktop, allebei uit dezelfde
    // component. Dit scherm zette daar zijn eigen knop naast.
    expect(
      screen.getAllByRole("button", { name: /^terug$/i }).length,
    ).toBeGreaterThan(0);
  });

  it("houdt de navigatie van de shell eromheen staan", async () => {
    renderPad("/bestaat-niet");
    await screen.findByRole("heading", { name: /pagina niet gevonden/i });
    expect(
      screen.getAllByRole("link", { name: /^klassement$/i }).length,
    ).toBeGreaterThan(0);
  });
});
