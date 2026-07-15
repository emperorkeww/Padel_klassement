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
