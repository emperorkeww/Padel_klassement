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
