import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../../components/ToastProvider";

vi.mock("../../lib/supabase", async () => {
  const { makeSupabaseMock } = await import("../../test/supabaseMock");
  const { TABLES, SESSION } = await import("../../test/fixtures");
  return { supabase: makeSupabaseMock({ session: SESSION, tables: TABLES }) };
});

import PlayerProfile from "./PlayerProfile";

function renderProfile(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/spelers/${id}`]}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/spelers/:id" element={<PlayerProfile />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("<PlayerProfile /> badges", () => {
  it("toont de badge-sectie: behaald vol kleur, niet-behaald gedempt met voortgang", async () => {
    // Fixtures: p1 won haar enige afgewerkte match (geen reus als tegenstander).
    renderProfile("p1");

    expect(await screen.findByRole("heading", { name: "Badges" })).toBeInTheDocument();

    const eerste = (await screen.findByText(/Eerste overwinning/)).closest(".badge");
    expect(eerste).toHaveClass("badge--accent");

    const vasteKlant = screen.getByText(/Vaste klant/).closest(".badge");
    expect(vasteKlant).not.toHaveClass("badge--accent");
    expect(vasteKlant).toHaveClass("badges__pill--dim");
    expect(vasteKlant).toHaveTextContent("1/10");

    // Reuzendoder: ratings liggen te dicht bij elkaar → gedempt, zonder teller.
    const reus = screen.getByText(/Reuzendoder/).closest(".badge");
    expect(reus).toHaveClass("badges__pill--dim");
    expect(reus).not.toHaveTextContent("/");
  });

  it("toont de beschrijving na een tik op een badge", async () => {
    renderProfile("p1");

    const knop = (await screen.findByText(/Eerste overwinning/)).closest("button")!;
    // Nog geen uitleg zichtbaar.
    expect(screen.queryByText(/allereerste match/i)).not.toBeInTheDocument();

    fireEvent.click(knop);
    expect(screen.getByText(/Win je allereerste match/i)).toBeInTheDocument();

    // Opnieuw tikken verbergt de uitleg weer.
    fireEvent.click(knop);
    expect(screen.queryByText(/Win je allereerste match/i)).not.toBeInTheDocument();
  });
});
