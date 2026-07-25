import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Zelfde match als MatchDetail.guestSwap.test.tsx, maar bekeken door p3: wél
// groepslid en zelfs deelnemer, maar niet de aanmaker en niet de eigenaar. De
// RPC zou dit weigeren, dus de UI hoort de sectie niet te tonen.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, PROFILES, MATCH_DONE } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: { user: { id: "p3", email: "carol@example.com" } },
      tables: {
        ...TABLES,
        matches: [MATCH_DONE],
        profiles: PROFILES.map((p) =>
          p.id === "p2"
            ? { ...p, full_name: "Gast Bob", is_guest: true, owner_id: "p1" }
            : p,
        ),
      },
    }),
  };
});

import MatchDetail from "./MatchDetail";

describe("<MatchDetail /> — gast vervangen is niet voor iedereen (#681)", () => {
  it("verbergt de sectie voor een deelnemer die de match niet aanmaakte", async () => {
    render(
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
    // Wacht tot de pagina echt geladen is voor we de afwezigheid vaststellen.
    expect(await screen.findByText(/afgerond/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /gast vervangen/i }),
    ).not.toBeInTheDocument();
  });
});
