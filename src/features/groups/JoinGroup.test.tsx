import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Wat de preview-RPC teruggeeft, per test in te stellen.
const preview = vi.hoisted(() => ({
  huidig: {} as Record<string, unknown>,
}));

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION, PROFILES } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: { profiles: PROFILES },
      rpc: {
        group_invite_preview: () => preview.huidig,
        redeem_group_invite: "g1",
      },
    }),
  };
});

import JoinGroup from "./JoinGroup";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { invalidateAll } from "@/lib/supabase/queryCache";

const OK = {
  status: "ok",
  group_id: "g1",
  group_name: "Vrijdagavond padel",
  member_count: 6,
  member_ids: ["p1", "p2", "p3", "p4"],
  inviter_id: "p2",
  expires_at: null,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/groepen/join/tok-923"]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/groepen/join/:token" element={<JoinGroup />} />
            <Route path="/groepen/:id" element={<div>detailpagina</div>} />
            <Route path="/spelen" element={<div>de hub</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const redeemAanroepen = () =>
  vi.mocked(supabase.rpc).mock.calls.filter(
    ([naam]) => naam === "redeem_group_invite",
  );

// De rpc-mock is generiek getypeerd (elke functie uit database.types); voor
// één afwijkend antwoord volstaat een structurele greep op de mock.
const rpcMock = supabase.rpc as unknown as {
  mockReturnValueOnce: (v: unknown) => void;
};
const eenmaligFout = (error: { message: string; details?: string }) =>
  rpcMock.mockReturnValueOnce(makeQuery({ data: null, error }));

describe("<JoinGroup />", () => {
  beforeEach(() => {
    invalidateAll();
    vi.clearAllMocks();
    preview.huidig = { ...OK };
  });

  // De kern van #923: je werd lid vóór je wist waarvan.
  it("toont eerst de groep en wisselt pas in na een expliciete bevestiging", async () => {
    renderPage();

    expect(screen.getByText(/we halen de uitnodiging op/i)).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: "Vrijdagavond padel" }),
    ).toBeInTheDocument();
    // De naam van de uitnodiger komt uit de profielen, die apart binnenkomen.
    expect(
      await screen.findByText(/bob boers nodigt je uit/i),
    ).toBeInTheDocument();
    expect(screen.getByText("6 leden")).toBeInTheDocument();
    // Uitnodigingen zijn niet accountgebonden; met welk account je meedoet
    // staat er vóór de klik.
    expect(screen.getByText(/je doet mee als/i)).toHaveTextContent(
      "Alice Anders",
    );
    expect(redeemAanroepen()).toHaveLength(0);

    await userEvent.click(
      screen.getByRole("button", { name: /word lid van vrijdagavond padel/i }),
    );

    expect(await screen.findByText("detailpagina")).toBeInTheDocument();
    expect(redeemAanroepen()[0][1]).toEqual({ p_token: "tok-923" });
  });

  // "Al lid" was een foutmelding; het is gewoon de groep waar je in zit.
  it("stuurt je door naar de groep als je al lid bent", async () => {
    preview.huidig = { ...OK, status: "member" };
    renderPage();

    expect(await screen.findByText("detailpagina")).toBeInTheDocument();
    expect(redeemAanroepen()).toHaveLength(0);
  });

  it("legt een verlopen link uit in plaats van de ruwe foutmelding", async () => {
    preview.huidig = { ...OK, status: "expired" };
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /verlopen/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/vraag iemand uit de groep om een nieuwe link/i))
      .toBeInTheDocument();
    // Naar de hub, niet via de /groepen-redirect.
    expect(
      screen.getByRole("link", { name: /naar mijn groepen/i }),
    ).toHaveAttribute("href", "/spelen?hub=1");
    expect(redeemAanroepen()).toHaveLength(0);
  });

  it("herkent een ingetrokken of verkeerd overgenomen link", async () => {
    preview.huidig = { status: "unknown", group_id: null, group_name: null };
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /bestaat niet meer/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ingetrokken/i)).toBeInTheDocument();
  });

  // De link kan tussen het bekijken en het klikken ingetrokken zijn.
  it("toont de passende foutstaat als het inwisselen alsnog afketst", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Vrijdagavond padel" });

    eenmaligFout({
      message: "Deze uitnodiging is verlopen",
      details: "uitnodiging_verlopen",
    });

    await userEvent.click(
      screen.getByRole("button", { name: /word lid van vrijdagavond padel/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /verlopen/i }),
    ).toBeInTheDocument();
  });

  // Een netwerkfout is geen doodlopend pad: opnieuw proberen hoort erbij.
  it("biedt opnieuw proberen aan als de preview zelf mislukt", async () => {
    eenmaligFout({ message: "Failed to fetch" });
    renderPage();

    const knop = await screen.findByRole("button", {
      name: /opnieuw proberen/i,
    });
    await userEvent.click(knop);

    expect(
      await screen.findByRole("heading", { name: "Vrijdagavond padel" }),
    ).toBeInTheDocument();
  });
});
