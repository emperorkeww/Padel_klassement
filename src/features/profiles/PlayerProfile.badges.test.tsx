import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("opent een pop-up met de uitleg na een tik op een badge", async () => {
    renderProfile("p1");

    const knop = (await screen.findByText(/Eerste overwinning/)).closest("button")!;
    // Nog geen pop-up en geen uitleg zichtbaar.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Win je allereerste match/i)).not.toBeInTheDocument();

    fireEvent.click(knop);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Win je allereerste match/i);
    expect(dialog).toHaveTextContent(/Behaald/i);

    // Sluiten verbergt de pop-up en de uitleg weer.
    fireEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Win je allereerste match/i)).not.toBeInTheDocument();
  });

  it("laat de eigenaar een behaalde badge uitlichten bovenaan het profiel", async () => {
    // p1 is de ingelogde gebruiker (SESSION), dus dit is haar eigen profiel.
    renderProfile("p1");

    // Nog niets uitgelicht.
    const eerste = (await screen.findByText(/Eerste overwinning/)).closest("li")!;
    expect(
      screen.queryByRole("heading", { name: "Uitgelichte badges" }),
    ).not.toBeInTheDocument();

    // De behaalde badge heeft een ster-toggle; aantikken licht hem uit.
    const ster = eerste.querySelector(".badges__star") as HTMLButtonElement;
    expect(ster).toBeTruthy();
    fireEvent.click(ster);

    const sectie = (
      await screen.findByRole("heading", { name: "Uitgelichte badges" })
    ).closest("section")!;
    expect(sectie).toHaveTextContent(/Eerste overwinning/);
  });

  it("opent de uitleg-pop-up via een uitgelichte badge", async () => {
    renderProfile("p1");

    // Licht een behaalde badge uit zodat de sectie verschijnt.
    const eerste = (await screen.findByText(/Eerste overwinning/)).closest("li")!;
    fireEvent.click(eerste.querySelector(".badges__star") as HTMLButtonElement);
    const sectie = (
      await screen.findByRole("heading", { name: "Uitgelichte badges" })
    ).closest("section")!;

    // De uitgelichte pil is tikbaar en opent dezelfde uitleg-pop-up.
    fireEvent.click(
      within(sectie).getByRole("button", { name: /Eerste overwinning/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/Win je allereerste match/i);
  });

  it("toont geen ster-toggle op andermans profiel", async () => {
    // p2 is niet de ingelogde gebruiker → geen uitlicht-knoppen.
    renderProfile("p2");
    await screen.findByRole("heading", { name: "Badges" });
    expect(document.querySelector(".badges__star")).toBeNull();
  });
});
