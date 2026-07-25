import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "@/test/supabaseMock";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Bob (p2) speelde Alice (p1) als "Gast Bram" in voordat zij een account had,
// en vraagt nu of zij die gast is. Twee afgeronde matches staan op het spel.
const claims: unknown[] = [];

vi.mock("@/lib/supabase/client", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      get guest_claims() {
        return claims;
      },
      friendships: [],
      profiles: [
        { id: "p1", username: "alice", full_name: "Alice Anders" },
        { id: "p2", username: "bob", full_name: "Bob Boers" },
        {
          id: "g1",
          username: "gast_bram",
          full_name: "Gast Bram",
          is_guest: true,
          owner_id: "p2",
        },
      ],
      teams: [{ id: "t1", player1_id: "g1", player2_id: "p2" }],
      matches: [
        { id: "m1", status: "completed", team_a_id: "t1", team_b_id: "t2" },
        { id: "m2", status: "completed", team_a_id: "t1", team_b_id: "t2" },
        { id: "m3", status: "scheduled", team_a_id: "t1", team_b_id: "t2" },
      ],
    },
    rpc: {
      get_friend_suggestions: [],
      claim_guest_player: { matches: 2, groepen: 1 },
      cancel_guest_claim: null,
    },
  }),
}));

import Friends from "./Friends";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Friends />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  claims.length = 0;
  claims.push({
    id: "gc1",
    guest_id: "g1",
    player_id: "p1",
    requested_by: "p2",
    status: "pending",
  });
  invalidateAll();
  vi.clearAllMocks();
});

describe("<Friends /> — koppelverzoek voor een gast (#681)", () => {
  it("toont wie het vraagt en hoeveel historie er op het spel staat", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /ben jij deze gast/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/gast bram/i)).toBeInTheDocument();
    // Alleen de afgeronde matches tellen mee (m3 is nog gepland).
    expect(await screen.findByText(/bob boers vraagt.*2 matches/i)).toBeInTheDocument();
  });

  it("neemt de historie over na bevestiging", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /ja, dat ben ik/i }),
    );
    // Onomkeerbaar, dus de bevestigingsdialoog benoemt dat expliciet.
    const dialoog = await screen.findByRole("dialog");
    expect(dialoog).toHaveTextContent(/niet ongedaan/i);
    await userEvent.click(
      await screen.findByRole("button", { name: /ja, koppel mijn account/i }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith("claim_guest_player", {
      p_guest_id: "g1",
      p_player_id: "p1",
    });
    expect(await screen.findByText(/2 matches staan nu op jouw naam/i)).toBeInTheDocument();
  });

  it("weigert het verzoek", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /^nee$/i }));
    expect(supabase.rpc).toHaveBeenCalledWith("cancel_guest_claim", {
      p_claim_id: "gc1",
    });
    expect(await screen.findByText(/verzoek geweigerd/i)).toBeInTheDocument();
  });
});
