import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Mock } from "vitest";
import { AuthProvider } from "./AuthProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { SESSION } = await import("@/test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION }) };
});

import { ProtectedRoute } from "./ProtectedRoute";
import { supabase } from "@/lib/supabase/client";
import { makeQuery } from "@/test/supabaseMock";
import { SESSION } from "@/test/fixtures";
import { invalidateAll } from "@/lib/supabase/queryCache";

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

// Gedwongen wachtwoordwissel (#1036): wie een tijdelijk wachtwoord kreeg, komt
// niet verder dan /reset-wachtwoord.
describe("<ProtectedRoute /> en de verplichte wachtwoordwissel (#1036)", () => {
  function renderMetProfiel(profiel: Record<string, unknown>) {
    (supabase.from as Mock).mockImplementation(() =>
      makeQuery({ data: [profiel], error: null }),
    );
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>login-pagina</div>} />
            <Route path="/reset-wachtwoord" element={<div>reset-pagina</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div>beveiligde inhoud</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
  }

  beforeEach(() => {
    invalidateAll();
  });

  it("stuurt door naar /reset-wachtwoord zolang de vlag aan staat", async () => {
    renderMetProfiel({ id: SESSION.user.id, moet_wachtwoord_wijzigen: true });
    expect(await screen.findByText("reset-pagina")).toBeInTheDocument();
  });

  it("laat de route gewoon door als de vlag uit staat", async () => {
    renderMetProfiel({ id: SESSION.user.id, moet_wachtwoord_wijzigen: false });
    expect(await screen.findByText("beveiligde inhoud")).toBeInTheDocument();
  });

  it("blokkeert niet terwijl het profiel nog laadt", async () => {
    // Bewust fail-open: dit is een ergonomische poort, geen beveiligingsgrens.
    // Zou dit blokkeren, dan betaalt iedereen bij elke koude start voor een
    // geval dat vrijwel nooit voorkomt. Hier: een profielquery die nooit
    // antwoordt — de route moet gewoon renderen.
    (supabase.from as Mock).mockImplementation(() => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = () => new Promise(() => {});
      q.single = q.maybeSingle;
      q.then = () => new Promise(() => {});
      return q;
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/reset-wachtwoord" element={<div>reset-pagina</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div>beveiligde inhoud</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("beveiligde inhoud")).toBeInTheDocument();
  });

  it("laat de route door als de profielquery faalt (fail-open)", async () => {
    (supabase.from as Mock).mockImplementation(() =>
      makeQuery({ data: null, error: { message: "boem" } }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/reset-wachtwoord" element={<div>reset-pagina</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div>beveiligde inhoud</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText("beveiligde inhoud")).toBeInTheDocument();
  });
});
