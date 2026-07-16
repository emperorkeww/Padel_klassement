import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { ToastProvider } from "@/ui/ToastProvider";

vi.mock("@/lib/supabase/client", async () => {
  const { makeSupabaseMock } = await import("@/test/supabaseMock");
  const { TABLES, SESSION } = await import("@/test/fixtures");
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

  it("filtert de feed op soort via de chips", async () => {
    renderPage();
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    // Ongefilterd bevat de lijst de matchkaart (met Alice erin) …
    expect(list).toHaveTextContent(/alice/i);

    // … na "Sociaal" alleen nog vriendschapsregels (Alice heet daar "Jij").
    fireEvent.click(screen.getByRole("button", { name: "Sociaal" }));
    expect(screen.getAllByText(/zijn nu vrienden/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("list", { name: /recente gebeurtenissen/i }),
    ).not.toHaveTextContent(/alice/i);

    // Terug naar "Alles" toont de matchkaart weer.
    fireEvent.click(screen.getByRole("button", { name: "Alles" }));
    expect(
      screen.getByRole("list", { name: /recente gebeurtenissen/i }),
    ).toHaveTextContent(/alice/i);
  });

  it("houdt dag-kopjes decoratief en chip-labels als exacte knopnaam", async () => {
    renderPage();
    const list = await screen.findByRole("list", {
      name: /recente gebeurtenissen/i,
    });
    // Dag-scheiders zijn visueel (aria-hidden): de dag staat al op elk item.
    const dagen = list.querySelectorAll(".feed__day");
    expect(dagen.length).toBeGreaterThan(0);
    dagen.forEach((d) => expect(d).toHaveAttribute("aria-hidden", "true"));

    // Stip en telling op een chip zijn decoratie: de accessible name blijft
    // exact het filterlabel (regressiewacht voor de aria-hidden-decoratie).
    expect(screen.getByRole("button", { name: "Roast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matches" })).toBeInTheDocument();
  });

  it("linkt een vriendschap door naar het spelersprofiel", async () => {
    renderPage();
    const items = await screen.findAllByRole("link", {
      name: /zijn nu vrienden/i,
    });
    expect(items[0]).toHaveAttribute("href", expect.stringContaining("/spelers/"));
  });
});
