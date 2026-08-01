import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "@/test/supabaseMock";

vi.mock("@/lib/supabase/client", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p2" } },
    rpc: {
      create_group_invite: "tok-776",
      create_guest_player: "g9",
    },
  }),
}));

import { GroupLedenTab } from "./GroupLedenTab";
import { ToastProvider } from "@/ui/ToastProvider";
import { supabase } from "@/lib/supabase/client";
import { invalidateAll } from "@/lib/supabase/queryCache";
import type { Group, GroupMember, Profile } from "@/types";
import type { ZwartePietHolder } from "../zwartePietApi";

const profiel = (id: string, naam: string) =>
  ({
    id,
    username: id,
    full_name: naam,
    created_at: "2026-01-01T00:00:00Z",
  }) as Profile;

// p1 = de eigenaar, p2 = ik (gewoon lid), p3 = een vriend van mij die nog
// geen lid is.
const profiles: Record<string, Profile> = {
  p1: profiel("p1", "Alice Anders"),
  p2: profiel("p2", "Bob Boers"),
  p3: profiel("p3", "Cis Claes"),
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

function renderTab(zwartePiet: ZwartePietHolder | null = null) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <GroupLedenTab
          groupId="gr1"
          myId="p2"
          isOwner={false}
          busy={false}
          act={async (fn) => {
            await fn();
          }}
          memberList={[lid("p1", "owner"), lid("p2", "member")]}
          profiles={profiles}
          zwartePiet={zwartePiet}
          group={group}
          reloadGroup={() => {}}
          addableFriendIds={["p3"]}
        />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  invalidateAll();
  vi.clearAllMocks();
});

describe("<GroupLedenTab /> — leden nodigen zelf uit (#776)", () => {
  it("toont een gewoon lid alle toevoeg-acties, maar geen beheer", async () => {
    renderTab();

    expect(await screen.findByText(/vrienden toevoegen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /voeg toe/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ gast/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /maak uitnodigingslink/i }),
    ).toBeInTheDocument();

    // Beheer blijft owner-only: geen lid eruit zetten, geen groep verwijderen.
    expect(
      screen.queryByRole("button", { name: /^verwijderen$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /groep verwijderen/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /groep verlaten/i }),
    ).toBeInTheDocument();
  });

  it("laat een lid een vriend toevoegen", async () => {
    renderTab();

    await userEvent.click(await screen.findByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /voeg toe/i }));

    expect(supabase.from).toHaveBeenCalledWith("group_members");
  });

  it("laat een lid een gast toevoegen", async () => {
    renderTab();

    await userEvent.type(
      await screen.findByLabelText(/naam van de gast/i),
      "Dirk",
    );
    await userEvent.click(screen.getByRole("button", { name: /\+ gast/i }));

    expect(supabase.rpc).toHaveBeenCalledWith("create_guest_player", {
      p_name: "Dirk",
    });
    expect(supabase.from).toHaveBeenCalledWith("group_members");
  });

  it("laat een lid een uitnodigingslink maken", async () => {
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /maak uitnodigingslink/i }),
    );

    expect(supabase.rpc).toHaveBeenCalledWith("create_group_invite", {
      p_group_id: "gr1",
    });
    expect(await screen.findByLabelText(/^uitnodigingslink$/i)).toHaveValue(
      `${window.location.origin}/groepen/join/tok-776`,
    );
  });
});

// #924: de 🃏-badge droeg zijn betekenis alleen in een `title` op een <span> —
// niet focusbaar, dus met het toetsenbord én op touch onbereikbaar.
it("noemt de drager van de Zwarte Piet bij naam voor een screenreader", () => {
  renderTab({
    groupId: "gr1",
    holderId: "p1",
    fromId: null,
    reden: "afdroging",
    ernst: 3,
    detail: "werd afgedroogd",
    matchId: "m1",
    since: "2026-01-01T00:00:00Z",
  });

  expect(screen.getByText("Draagt de Zwarte Piet")).toBeInTheDocument();
});
