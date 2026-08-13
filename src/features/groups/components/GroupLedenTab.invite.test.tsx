import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
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

// Waar de tab na verlaten/verwijderen heen navigeert (#1298).
let huidigPad = "";
const pad = () => huidigPad;
function LocatiePeiler() {
  huidigPad = useLocation().pathname;
  return null;
}

function renderTab(zwartePiet: ZwartePietHolder | null = null) {
  return render(
    <MemoryRouter>
      <LocatiePeiler />
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
// niet focusbaar, dus met het toetsenbord én op touch onbereikbaar. #1298 haalt
// hem ook uit sr-only: een rode pil met alleen een joker erin zei zíend niets.
it("noemt de drager van de Zwarte Piet bij naam, ook zichtbaar", () => {
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

  const badge = screen.getByText("Zwarte Piet");
  expect(badge).toBeInTheDocument();
  expect(badge.closest(".badge")).not.toHaveClass("sr-only");
});

// #1298: één kaart droeg vier taken; de gast-aanmaak stond twee keer
// uitgeschreven (Enter én klik), de uitnodigingslink had geen kopieerknop, en
// verlaten/verwijderen navigeerde via /groepen — een omleiding naar /spelen.
describe("<GroupLedenTab /> — vier taken, vier kaarten (#1298)", () => {
  it("zet leden, uitnodigen en de gevarenzone in eigen kaarten", async () => {
    const { container } = renderTab();
    await screen.findByText(/vrienden toevoegen/i);

    const koppen = [...container.querySelectorAll("section.card > h2")].map(
      (h) => h.textContent,
    );
    expect(koppen).toEqual(["Leden", "Uitnodigen", "Gevarenzone"]);
    // De onomkeerbare actie staat in de gevarenzone, niet onder een naamveld.
    const zone = container.querySelector(".card--gevaren")!;
    expect(
      within(zone as HTMLElement).getByRole("button", { name: /groep verlaten/i }),
    ).toBeInTheDocument();
  });

  it("voegt een gast ook met Enter toe", async () => {
    renderTab();

    await userEvent.type(
      await screen.findByLabelText(/naam van de gast/i),
      "Dirk{Enter}",
    );

    expect(supabase.rpc).toHaveBeenCalledWith("create_guest_player", {
      p_name: "Dirk",
    });
  });

  it("geeft de uitnodigingslink een kopieerknop", async () => {
    const schrijf = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: schrijf } });
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /maak uitnodigingslink/i }),
    );
    await screen.findByLabelText(/^uitnodigingslink$/i);
    schrijf.mockClear();

    // Aanmaken kopieert al één keer; deze knop is de herhaalroute.
    await userEvent.click(screen.getByRole("button", { name: /^kopieer$/i }));
    expect(schrijf).toHaveBeenCalledWith(
      `${window.location.origin}/groepen/join/tok-776`,
    );
    expect(
      await screen.findByRole("button", { name: /^gekopieerd$/i }),
    ).toBeInTheDocument();
  });

  it("stuurt na verlaten naar de hub zelf, niet via de omleiding", async () => {
    renderTab();

    await userEvent.click(
      await screen.findByRole("button", { name: /groep verlaten/i }),
    );
    const dialoog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialoog).getByRole("button", { name: /^verlaten$/i }),
    );

    await waitFor(() => expect(pad()).toBe("/spelen"));
  });
});
