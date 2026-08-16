import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// De keerzijde van MatchDetail.bezettingAccess.test.tsx: dezelfde kijker (p3 —
// deelnemer en groepslid, maar niet de aanmaker en niet de eigenaar), nu op een
// wedstrijd die nog gespeeld moet worden. Daar verplaatst hij een afspraak in
// plaats van geschiedenis, en dus mag hij wél (#1327).
//
// Eigen bestand en niet één test erbij in de andere: de supabase-mock filtert
// niet op id — `maybeSingle()` geeft simpelweg de eerste rij — dus twee
// wedstrijden in één tabel zouden allebei dezelfde pagina opleveren.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, PROFILES, MATCH_PLANNED } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: { user: { id: "p3", email: "carol@example.com" } },
      tables: { ...TABLES, matches: [MATCH_PLANNED], profiles: PROFILES },
    }),
  };
});

import userEvent from "@testing-library/user-event";
import MatchDetail from "./MatchDetail";

describe("<MatchDetail /> — bezetting van een geplande wedstrijd (#1327)", () => {
  it("laat een deelnemer die de match niet aanmaakte de opstelling rechtzetten", async () => {
    render(
      <MemoryRouter initialEntries={["/matches/m-plan"]}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/matches/:id" element={<MatchDetail />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /meer acties/i }),
    );
    await userEvent.click(
      await screen.findByRole(
        "button",
        { name: /spelers wijzigen/i },
        { timeout: 3000 },
      ),
    );

    // Ruilen met een andere baan hoort hier níet bij: de detailpagina kent de
    // rest van de ronde niet, dus die groep blijft leeg. Vervangen en van team
    // wisselen blijven over.
    await userEvent.selectOptions(
      await screen.findByLabelText(/wie verandert van plek/i),
      "p3",
    );
    const naar = screen.getByLabelText(/wie komt op die plek/i);
    await userEvent.selectOptions(
      naar,
      await within(naar).findByRole("option", { name: /alice anders/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^bezetting wijzigen$/i }),
    );
    // Nog niet gespeeld, dus geen waarschuwing over herberekende ratings.
    const dialoog = await screen.findByRole("dialog", {
      name: /bezetting wijzigen\?/i,
    });
    expect(dialoog).not.toHaveTextContent(/ratings worden opnieuw berekend/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /^wijzigen$/i }),
    );

    const { supabase } = await import("@/lib/supabase/client");
    // p1 speelt in team A, p3 in team B: dat is van team wisselen, niet
    // vervangen.
    expect(supabase.rpc).toHaveBeenCalledWith("ruil_match_spelers", {
      p_match_a: "m-plan",
      p_speler_a: "p3",
      p_match_b: "m-plan",
      p_speler_b: "p1",
    });
  });
});
