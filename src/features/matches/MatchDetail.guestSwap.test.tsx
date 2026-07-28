import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// p2 is hier geen echt account maar een gast van p1 (de aanmaker van de match),
// en p5 is een groepsgenoot die niet meespeelde — de kandidaat om mee te
// vervangen.
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

describe("<MatchDetail /> — gast vervangen (#681)", () => {
  it("vervangt de gast door de speler die er echt stond", async () => {
    renderPage();
    // De sectie verschijnt pas als de profielen geladen zijn en er een gast
    // tussen blijkt te zitten. De standaard 1s van findBy was daarvoor krap:
    // met het lef-blok erbij (#804) laadt de detailpagina één bron meer, en
    // onder parallelle testbelasting viel dat er regelmatig buiten. De
    // assertie gaat over gedrag, niet over snelheid (zie ook #753).
    expect(
      await screen.findByRole(
        "heading",
        { name: /gast vervangen/i },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();

    const select = await screen.findByLabelText(/vervangen door/i);
    const knop = screen.getByRole("button", { name: /vervang deelnemer/i });
    // Zonder gekozen speler valt er niets te vervangen.
    expect(knop).toBeDisabled();

    // Alleen wie niet meespeelde staat in de lijst. De kandidaatprofielen
    // laden apart, dus wachten tot de optie er is.
    expect(
      await screen.findByRole("option", { name: /eva evers/i }),
    ).toBeInTheDocument();
    expect(select).not.toHaveTextContent(/carol claes/i);

    await userEvent.selectOptions(select, "p5");
    await userEvent.click(knop);

    // Onomkeerbaar: eerst bevestigen.
    const dialoog = await screen.findByRole("dialog");
    expect(dialoog).toHaveTextContent(/niet ongedaan/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /^vervangen$/i }),
    );

    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase.rpc).toHaveBeenCalledWith("replace_match_player", {
      p_match_id: "m-done",
      p_from_player: "p2",
      p_to_player: "p5",
    });
    expect(
      await screen.findByText(/deelnemer vervangen/i),
    ).toBeInTheDocument();
  });
});
