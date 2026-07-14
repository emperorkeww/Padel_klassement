import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION }) };
});

import { ProtectedRoute } from "./ProtectedRoute";
import { supabase } from "@/lib/supabase/client";

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login-pagina</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>beveiligde inhoud</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<ProtectedRoute />", () => {
  it("toont de inhoud met een geldige sessie", async () => {
    renderRoutes();
    expect(await screen.findByText("beveiligde inhoud")).toBeInTheDocument();
  });

  it("stuurt door naar /login zonder sessie", async () => {
    (supabase.auth.getSession as Mock).mockResolvedValueOnce({
      data: { session: null },
    });
    renderRoutes();
    expect(await screen.findByText("login-pagina")).toBeInTheDocument();
  });
});
