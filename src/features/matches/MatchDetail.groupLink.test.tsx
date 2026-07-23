import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

// Eigen mock naast MatchDetail.test.tsx: de tabelmock filtert niet op id
// (getMatch pakt altijd de eerste rij), dus de groepsloze match moet hier de
// enige match zijn.
vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, MATCH_DONE, SESSION } = await import("@/test/fixtures");
  return {
    supabase: makeSupabaseMock({
      session: SESSION,
      tables: { ...TABLES, matches: [{ ...MATCH_DONE, group_id: null }] },
    }),
  };
});

import MatchDetail from "./MatchDetail";

function renderPage() {
  return render(
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
}

describe("<MatchDetail /> — losse match aan een groep koppelen (#648)", () => {
  it("koppelt een losse match aan een eigen groep", async () => {
    renderPage();
    expect(await screen.findByText(/telt nergens mee/i)).toBeInTheDocument();
    const select = await screen.findByLabelText(/koppel aan groep/i);
    const opslaan = screen.getByRole("button", { name: /groep opslaan/i });
    expect(opslaan).toBeDisabled();
    await userEvent.selectOptions(select, "g1");
    await userEvent.click(opslaan);
    expect(
      await screen.findByText(/match aan groep gekoppeld/i),
    ).toBeInTheDocument();
    const { supabase } = await import("@/lib/supabase/client");
    expect(supabase.rpc).toHaveBeenCalledWith("set_match_group", {
      p_match_id: "m-done",
      p_group_id: "g1",
    });
  });
});
