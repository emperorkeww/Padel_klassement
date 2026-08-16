import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// p2 is hier geen echt account maar een gast van p1 (de aanmaker van de match),
// en p5 is een groepsgenoot die niet meespeelde — de invaller.
//
// Sinds #1327 heet dit niet meer "Gast vervangen": een gast omzetten naar de
// speler die er écht stond is de smalle variant van "Spelers wijzigen", en de
// match is hier afgerond, dus alleen de aanmaker en de groepseigenaar mogen.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, PROFILES, GROUP_MEMBERS, MATCH_DONE, SESSION } = await import(
    "@/test/fixtures"
  );
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: {
        ...TABLES,
        matches: [MATCH_DONE],
        profiles: [
          ...PROFILES.map((p) =>
            p.id === "p2"
              ? { ...p, full_name: "Gast Bob", is_guest: true, owner_id: "p1" }
              : p,
          ),
          {
            id: "p5",
            username: "eva",
            full_name: "Eva Evers",
            avatar_url: null,
            created_at: "2026-07-02T10:00:00.000Z",
          },
        ],
        group_members: [
          ...GROUP_MEMBERS,
          { group_id: "g1", player_id: "p5", role: "member", joined_at: "2026-07-02T10:00:00.000Z" },
        ],
      },
    }),
  };
});

import { openBeheer } from "@/test/matchBeheer";
import MatchDetail from "./MatchDetail";

function renderPage() {
  return render(
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
}

describe("<MatchDetail /> — spelers wijzigen (#681, #1327)", () => {
  it("zet de gast om naar de speler die er echt stond", async () => {
    renderPage();
    await openBeheer(/spelers wijzigen/i);
    // Het paneel verschijnt pas als de profielen geladen zijn. De standaard 1s
    // van findBy was daarvoor krap: met het lef-blok erbij (#804) laadt de
    // detailpagina één bron meer, en onder parallelle testbelasting viel dat er
    // regelmatig buiten. De assertie gaat over gedrag, niet over snelheid
    // (zie ook #753).
    expect(
      await screen.findByRole(
        "heading",
        { name: /spelers wijzigen/i },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();

    const knop = screen.getByRole("button", { name: /^bezetting wijzigen$/i });
    // Zolang er geen twee namen gekozen zijn valt er niets te wijzigen.
    expect(knop).toBeDisabled();

    await userEvent.selectOptions(
      screen.getByLabelText(/wie verandert van plek/i),
      "p2",
    );
    const naar = screen.getByLabelText(/wie komt op die plek/i);
    // Alleen wie niet meespeelde staat onder de invallers; de kandidaat-
    // profielen laden apart, dus wachten tot de optie er is.
    expect(
      await within(naar).findByRole("option", { name: /eva evers/i }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(naar, "p5");
    await userEvent.click(knop);

    // Onomkeerbaar: eerst bevestigen. Scopen op de bevestigingsdialoog, want
    // sinds #1144 staat de beheersheet er als tweede dialoog omheen.
    const dialoog = await screen.findByRole("dialog", {
      name: /bezetting wijzigen\?/i,
    });
    expect(dialoog).toHaveTextContent(/niet ongedaan/i);
    // De wedstrijd is gespeeld, dus de bevestiging zegt dat de ratings
    // opnieuw berekend worden.
    expect(dialoog).toHaveTextContent(/ratings worden opnieuw berekend/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /^wijzigen$/i }),
    );

    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase.rpc).toHaveBeenCalledWith("replace_match_player", {
      p_match_id: "m-done",
      p_from_player: "p2",
      p_to_player: "p5",
    });
    expect(
      await screen.findByText(/bezetting bijgewerkt/i),
    ).toBeInTheDocument();
  });

  it("laat twee spelers uit deze wedstrijd van team wisselen", async () => {
    renderPage();
    await openBeheer(/spelers wijzigen/i);
    await screen.findByRole(
      "heading",
      { name: /spelers wijzigen/i },
      { timeout: 3000 },
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/wie verandert van plek/i),
      "p2",
    );
    // p3 speelt in het andere team; dat is geen vervanging maar een ruil —
    // dezelfde wedstrijd aan beide kanten.
    const naar = screen.getByLabelText(/wie komt op die plek/i);
    await userEvent.selectOptions(
      naar,
      await within(naar).findByRole("option", { name: /carol claes/i }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^bezetting wijzigen$/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: /^wijzigen$/i }),
    );

    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase.rpc).toHaveBeenCalledWith("ruil_match_spelers", {
      p_match_a: "m-done",
      p_speler_a: "p2",
      p_match_b: "m-done",
      p_speler_b: "p3",
    });
  });
});
