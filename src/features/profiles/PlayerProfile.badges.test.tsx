import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";

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
        <Routes>
          <Route path="/spelers/:id" element={<PlayerProfile />} />
        </Routes>
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
});
