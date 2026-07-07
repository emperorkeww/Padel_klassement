import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Dashboard from "./Dashboard";

// De baanbeschikbaarheid komt via fetch (Playtomic-proxy); leeg antwoord volstaat.
function stubPlaytomic() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).includes("/v1/tenants/")
        ? { resources: [], opening_hours: {}, address: { timezone: "Europe/Brussels" } }
        : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    }),
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Dashboard />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Dashboard />", () => {
  beforeEach(stubPlaytomic);
  afterEach(() => vi.unstubAllGlobals());

  it("begroet de speler met stand en statistieken", async () => {
    renderPage();
    expect(await screen.findByText(/hoi, alice anders/i)).toBeInTheDocument();
    // Statblokken: rating met stijgende delta van de laatste match.
    expect((await screen.findAllByText("1012")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/▲/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Rating")).toBeInTheDocument();
  });

  it("toont de eerstvolgende geplande match met score-invoer", async () => {
    renderPage();
    expect(await screen.findByText(/jouw volgende match/i)).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /naar groep/i }),
    ).toBeInTheDocument();
    // Actiestrook: één openstaande uitslag.
    expect(await screen.findByText(/uitslag wacht op jou/i)).toBeInTheDocument();
  });

  it("toont topspelers en recente uitslagen", async () => {
    renderPage();
    expect(await screen.findByText(/topspelers/i)).toBeInTheDocument();
    expect(await screen.findByText(/recente uitslagen/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/carol claes/i)).length).toBeGreaterThan(0);
  });
});
