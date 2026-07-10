import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import Feed from "./Feed";

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <Feed />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<Feed />", () => {
  it("toont matches en vriendschappen chronologisch met dag-kopjes", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: /^feed$/i }),
    ).toBeInTheDocument();

    // De afgeronde match uit de fixtures (alice+bob vs carol+dave) is een
    // klikbare matchkaart …
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    expect(list).toHaveTextContent(/alice/i);
    // … en alice' geaccepteerde vriendschappen staan er als items tussen.
    expect(
      (await screen.findAllByText(/zijn nu vrienden/i)).length,
    ).toBeGreaterThan(0);
  });

  it("linkt een vriendschap door naar het spelersprofiel", async () => {
    renderPage();
    const items = await screen.findAllByRole("link", {
      name: /zijn nu vrienden/i,
    });
    expect(items[0]).toHaveAttribute("href", expect.stringContaining("/spelers/"));
  });
});
