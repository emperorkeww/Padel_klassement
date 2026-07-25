import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "@/test/supabaseMock";

// Eén openstaand koppelverzoek staat klaar; de tests die dat niet willen
// leegmaken de tabel via setClaims().
const claims: unknown[] = [];

vi.mock("@/lib/supabase/client", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1" } },
    tables: {
      get guest_claims() {
        return claims;
      },
    },
    rpc: { request_guest_claim: "gc-new", cancel_guest_claim: null },
  }),
}));

import { GroupLedenTab } from "./GroupLedenTab";
import { ToastProvider } from "@/ui/ToastProvider";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";
import type { Group, GroupMember, Profile } from "@/types";

const profiel = (id: string, naam: string, extra: Partial<Profile> = {}) =>
  ({
    id,
    username: id,
    full_name: naam,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  }) as Profile;

// p1 = ik (eigenaar van de groep), p2 = een echt medelid,
// g1 = mijn gast, g2 = de gast van iemand anders.
const profiles: Record<string, Profile> = {
  p1: profiel("p1", "Alice Anders"),
  p2: profiel("p2", "Bob Boers"),
  g1: profiel("g1", "Gast Bram", { is_guest: true, owner_id: "p1" }),
  g2: profiel("g2", "Gast Cis", { is_guest: true, owner_id: "p2" }),
};

const lid = (player_id: string, role: "owner" | "member"): GroupMember => ({
  group_id: "gr1",
  player_id,
  role,
  joined_at: "2026-01-01T00:00:00Z",
});

const group: Group = {
  id: "gr1",
  name: "Groep één",
  created_by: "p1",
  created_at: "2026-01-01T00:00:00Z",
};

function renderTab() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <GroupLedenTab
          groupId="gr1"
          myId="p1"
          isOwner
          busy={false}
          act={async (fn) => {
            await fn();
          }}
          memberList={[lid("p1", "owner"), lid("p2", "member"), lid("g1", "member"), lid("g2", "member")]}
          profiles={profiles}
          zwartePiet={null}
          group={group}
          reloadGroup={() => {}}
          addableFriendIds={["p3"]}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  claims.length = 0;
  invalidateAll();
  vi.clearAllMocks();
});

describe("<GroupLedenTab /> — gast koppelen (#681)", () => {
  it("biedt 'Koppel aan speler' alleen aan bij een eigen gast", async () => {
    renderTab();
    // Precies één knop: bij g1 (mijn gast). Niet bij het echte account p2 en
    // niet bij g2, want die is van iemand anders.
    expect(
      await screen.findAllByRole("button", { name: /koppel aan speler/i }),
    ).toHaveLength(1);
  });

  it("stuurt een koppelverzoek na bevestiging", async () => {
    renderTab();
    await userEvent.click(
      await screen.findByRole("button", { name: /koppel aan speler/i }),
    );
    // De spelerkiezer toont het echte medelid, niet de gasten en niet mezelf.
    const kiezer = await screen.findByRole("dialog");
    expect(kiezer).toHaveTextContent(/bob boers/i);
    expect(kiezer).not.toHaveTextContent(/gast cis/i);
    expect(kiezer).not.toHaveTextContent(/alice anders/i);

    await userEvent.click(
      within(kiezer).getByRole("button", { name: /koppel aan bob boers/i }),
    );
    // Onomkeerbaar, dus eerst bevestigen.
    await userEvent.click(
      await screen.findByRole("button", { name: /verzoek sturen/i }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith("request_guest_claim", {
      p_guest_id: "g1",
      p_player_id: "p2",
    });
  });

  it("toont een lopend verzoek met de mogelijkheid het in te trekken", async () => {
    claims.push({
      id: "gc1",
      guest_id: "g1",
      player_id: "p2",
      requested_by: "p1",
      status: "pending",
    });
    renderTab();

    expect(await screen.findByText(/wacht op bob boers/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /koppel aan speler/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /intrekken/i }));
    expect(supabase.rpc).toHaveBeenCalledWith("cancel_guest_claim", {
      p_claim_id: "gc1",
    });
  });
});

