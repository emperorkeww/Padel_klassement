import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { makeSupabaseMock } from "../../test/supabaseMock";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", () => ({
  supabase: makeSupabaseMock({
    session: { user: { id: "p1", email: "alice@example.com" } },
    tables: {
      friendships: [
        { id: "f1", requester_id: "p2", addressee_id: "p1", status: "pending" },
        { id: "f2", requester_id: "p1", addressee_id: "p3", status: "accepted" },
        { id: "f3", requester_id: "p1", addressee_id: "p5", status: "pending" },
      ],
      profiles: [
        { id: "p1", username: "alice", full_name: "Alice Anders" },
        { id: "p2", username: "bob", full_name: "Bob Boers" },
        { id: "p3", username: "carol", full_name: "Carol Claes" },
        { id: "p4", username: "dave", full_name: "Dave De Vos" },
        { id: "p5", username: "eva", full_name: "Eva Evers" },
        { id: "p6", username: "frank", full_name: "Frank Feyen" },
      ],
    },
    // get_friend_suggestions: dave heeft 2 gemeenschappelijke vrienden (carol + frank).
    rpc: [{ id: "p4", mutual_count: 2, mutual_ids: ["p3", "p6"] }],
  }),
}));

import Friends from "./Friends";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "../../test/supabaseMock";
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

describe("<Friends />", () => {
  it("toont inkomend verzoek en bestaande vriend", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^vrienden$/i }),
    ).toBeInTheDocument();
    // Bob stuurde een verzoek (inkomend), Carol is een geaccepteerde vriend.
    expect(await screen.findByText(/bob boers/i)).toBeInTheDocument();
    expect(await screen.findByText(/carol claes/i)).toBeInTheDocument();
  });

  it("accepteert een inkomend verzoek", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /accepteer/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("friendships");
    expect(await screen.findByText(/geaccepteerd/i)).toBeInTheDocument();
  });

  it("zoekt spelers en stuurt een verzoek naar een nieuwe speler", async () => {
    renderPage();
    await userEvent.type(
      await screen.findByPlaceholderText(/zoek op gebruikersnaam/i),
      "dave",
    );
    await userEvent.click(screen.getByRole("button", { name: /^zoek$/i }));
    // Dave heeft nog geen relatie: verzoek-knop is actief; Bob wel: "Al gekoppeld".
    const sturen = await screen.findAllByRole("button", {
      name: /verzoek sturen/i,
    });
    expect(sturen.length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /al gekoppeld/i }).length,
    ).toBeGreaterThan(0);
    await userEvent.click(sturen[0]);
    expect(await screen.findByText(/verzoek verstuurd/i)).toBeInTheDocument();
  });

  it("opent de gemeenschappelijke vrienden in een popup", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /misschien ken je/i }),
    ).toBeInTheDocument();
    // Dave (p4) is voorgesteld met een klikbare teller; de namen zijn verborgen.
    expect(await screen.findByText(/dave de vos/i)).toBeInTheDocument();
    const toggle = await screen.findByRole("button", {
      name: /2 gemeenschappelijke vrienden/i,
    });
    expect(screen.queryByText(/frank feyen/i)).toBeNull();
    // Na klikken opent een dialoog met de gemeenschappelijke vrienden.
    await userEvent.click(toggle);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText(/frank feyen/i)).toBeInTheDocument();
  });

  it("trekt een verzonden verzoek in", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /intrekken/i }),
    );
    expect(supabase.from).toHaveBeenCalledWith("friendships");
    expect(await screen.findByText(/verzoek ingetrokken/i)).toBeInTheDocument();
  });

  it("toont een foutstaat i.p.v. lege lijsten als vrienden laden faalt", async () => {
    // Verse cache, en de friendships-query laten falen (issue #67).
    invalidateAll();
    const fromMock = supabase.from as unknown as {
      getMockImplementation: () => (table: string) => unknown;
      mockImplementation: (impl: (table: string) => unknown) => void;
    };
    const orig = fromMock.getMockImplementation();
    fromMock.mockImplementation((table) =>
      table === "friendships"
        ? makeQuery({ data: null, error: new Error("boem") })
        : orig(table),
    );
    try {
      renderPage();
      expect(
        await screen.findByText(/je vrienden laden mislukte/i),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /opnieuw proberen/i }),
      ).toBeInTheDocument();
      // Geen misleidende lege staten.
      expect(screen.queryByText(/geen openstaande verzoeken/i)).toBeNull();
      expect(screen.queryByText(/nog geen vrienden/i)).toBeNull();
    } finally {
      fromMock.mockImplementation(orig);
      invalidateAll();
    }
  });

  it("verwijdert een vriend", async () => {
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /verwijderen/i }),
    );
    expect(await screen.findByText(/^verwijderd\.$/i)).toBeInTheDocument();
  });
});
