import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES, rpc: "m-new" }) };
});

import { NewMatchSheet } from "./NewMatchSheet";
import { PROFILES } from "@/test/fixtures";

function renderSheet(groupId?: string) {
  return render(
    <AuthProvider>
      <ToastProvider>
        <NewMatchSheet
          open
          players={PROFILES}
          groupId={groupId}
          onClose={() => {}}
          onCreated={() => {}}
        />
      </ToastProvider>
    </AuthProvider>,
  );
}

describe("<NewMatchSheet /> plannen — mobiel toetsenbord (#358)", () => {
  it("geeft het weken-veld een numeriek toetsenbord (inputmode)", async () => {
    render(
      <AuthProvider>
        <ToastProvider>
          <NewMatchSheet
            open
            mode="plan"
            players={PROFILES}
            groupId="g1"
            onClose={() => {}}
            onCreated={() => {}}
          />
        </ToastProvider>
      </AuthProvider>,
    );
    // Stap 1: vier spelers aantikken (2 per team), dan door naar plannen.
    const { fireEvent } = await import("@testing-library/react");
    for (const p of PROFILES) {
      fireEvent.click(await screen.findByRole("button", { name: new RegExp(p.full_name, "i") }));
    }
    fireEvent.click(screen.getByRole("button", { name: /naar plannen/i }));
    fireEvent.change(screen.getByLabelText(/wanneer/i), {
      target: { value: "2026-07-17T20:00" },
    });
    fireEvent.click(screen.getByLabelText(/herhaal wekelijks/i));
    expect(screen.getByLabelText(/aantal weken/i)).toHaveAttribute(
      "inputmode",
      "numeric",
    );
  });
});

describe("<NewMatchSheet /> speelvorm 1v1 (#279)", () => {
  it("logt een 1v1 met één speler per team en null als tweede speler", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const { supabase } = await import("@/lib/supabase/client");
    renderSheet("g1");

    // Speelvorm omzetten naar singles: twee spelers volstaan.
    await userEvent.click(
      await screen.findByRole("radio", { name: /1 tegen 1/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: /alice anders/i }));
    await userEvent.click(screen.getByRole("button", { name: /carol claes/i }));
    await userEvent.click(screen.getByRole("button", { name: /naar de score/i }));

    await userEvent.type(screen.getByLabelText("Score team A"), "6");
    await userEvent.type(screen.getByLabelText("Score team B"), "4");
    await userEvent.click(screen.getByRole("button", { name: /match opslaan/i }));

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_completed_match",
      expect.objectContaining({
        p_a1: "p1",
        p_a2: null,
        p_b1: "p3",
        p_b2: null,
        p_winner: "a",
      }),
    );
  });

  it("trimt bij het wisselen 2v2 → 1v1 naar de eerst gekozen speler per team", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    renderSheet("g1");
    await screen.findByText(/wie speelden er/i);

    // Vier spelers in 2v2: team A = Alice + Bob, team B = Carol + Dave.
    for (const naam of [/alice anders/i, /bob boers/i, /carol claes/i, /dave de vos/i]) {
      await userEvent.click(screen.getByRole("button", { name: naam }));
    }
    await userEvent.click(screen.getByRole("radio", { name: /1 tegen 1/i }));

    // De eerst gekozen speler per team blijft staan; de rest valt af.
    // (De wisselpijlen in de teamzones matchen ook op naam, dus filter op chip.)
    const chip = (naam: RegExp) =>
      screen
        .getAllByRole("button", { name: naam })
        .find((b) => b.classList.contains("pick-chip"))!;
    expect(chip(/alice anders/i)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/carol claes/i)).toHaveAttribute("aria-pressed", "true");
    expect(chip(/bob boers/i)).toHaveAttribute("aria-pressed", "false");
    expect(chip(/dave de vos/i)).toHaveAttribute("aria-pressed", "false");
    // 1+1 spelers is meteen compleet: door naar de score kan.
    expect(screen.getByRole("button", { name: /naar de score/i })).toBeEnabled();
  });
});

describe("<NewMatchSheet /> groep-keuze (#361)", () => {
  it("toont buiten groepscontext de optionele groep-keuze met losse match als default", async () => {
    renderSheet();
    const select = await screen.findByLabelText(/koppel aan groep/i);
    expect(select).toHaveValue("");
    expect(
      screen.getByRole("option", { name: /losse match/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /vrijdagavond padel/i }),
    ).toBeInTheDocument();
  });

  it("verbergt de groep-keuze bij een vaste groepscontext", async () => {
    renderSheet("g1");
    await screen.findByText(/wie speelden er/i);
    expect(
      screen.queryByLabelText(/koppel aan groep/i),
    ).not.toBeInTheDocument();
  });
});
