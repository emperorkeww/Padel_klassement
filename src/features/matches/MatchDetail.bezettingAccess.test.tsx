import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Een gespéélde wedstrijd, bekeken door p3: groepslid én deelnemer, maar niet
// de aanmaker en niet de eigenaar. Precies de kijker waar de asymmetrie van
// #1327 over gaat — op een geplande wedstrijd mag hij de bezetting wijzigen
// (MatchDetail.bezettingGepland.test.tsx), hier niet: dan herschrijft hij de
// Elo-geschiedenis van vier mensen.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, PROFILES, MATCH_DONE } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: { user: { id: "p3", email: "carol@example.com" } },
      tables: {
        ...TABLES,
        matches: [MATCH_DONE],
        profiles: PROFILES.map((p) =>
          p.id === "p2"
            ? { ...p, full_name: "Gast Bob", is_guest: true, owner_id: "p1" }
            : p,
        ),
      },
    }),
  };
});

import userEvent from "@testing-library/user-event";
import MatchDetail from "./MatchDetail";

describe("<MatchDetail /> — bezetting van een gespeelde wedstrijd (#1327)", () => {
  it("verbergt de actie voor een deelnemer die de match niet aanmaakte", async () => {
    render(
      <MemoryRouter initialEntries={["/matches/m-done"]}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/afgerond/i)).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole("button", { name: /meer acties/i }),
    );
    // "Netrollers" hangt aan dezelfde bron als de bezetting — beide rechten
    // komen uit de teams, en die laden ná de match zelf. Eerst daarop wachten,
    // want anders stelt de assertie eronder alleen vast dat de pagina nog
    // bezig was.
    expect(
      await screen.findByRole(
        "button",
        { name: /netrollers/i },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /spelers wijzigen/i }),
    ).toBeNull();
  });
});
