import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Geen supabase-mock nodig: het zoekpad hangt bewust niet aan api.ts en dus
// niet aan de databankclient (#391).
vi.mock("@/features/availability/clubSearchApi", () => ({ searchClubs: vi.fn() }));

import { searchClubs } from "@/features/availability/clubSearchApi";
import { ClubPicker } from "@/features/availability/components/ClubPicker";
import { DEFAULT_CLUB } from "@/features/availability/club";

const treffer = {
  id: "t-1",
  name: "Hangar Padel Club",
  city: "",
  timezone: "Europe/Brussels",
  adres: "9120 Vesten 43",
};

function open() {
  fireEvent.click(screen.getByRole("button", { name: /LAGO CLUB Padel Beveren/ }));
  return screen.getByRole("textbox");
}

afterEach(() => {
  vi.mocked(searchClubs).mockReset();
  localStorage.clear();
});

describe("ClubPicker — clubs zoeken (#391)", () => {
  it("zoekt na twee tekens en kiest een treffer zonder het adresveld door te geven", async () => {
    vi.mocked(searchClubs).mockResolvedValue([treffer]);
    const onPick = vi.fn();
    render(<ClubPicker onPick={onPick} />);

    fireEvent.change(open(), { target: { value: "hangar" } });

    const knop = await screen.findByRole("button", { name: /Hangar Padel Club/ });
    expect(screen.getByText("9120 Vesten 43")).toBeInTheDocument();
    expect(searchClubs).toHaveBeenCalledWith("hangar");

    fireEvent.click(knop);
    // De gekozen club is een Club, niet de zoektreffer: `adres` hoort niet in
    // de opgeslagen voorkeur.
    expect(onPick).toHaveBeenCalledWith({
      id: "t-1",
      name: "Hangar Padel Club",
      city: "",
      timezone: "Europe/Brussels",
    });
  });

  it("zoekt niet op één teken", async () => {
    render(<ClubPicker />);
    fireEvent.change(open(), { target: { value: "h" } });
    await waitFor(() => expect(screen.getByText(/minstens 2 tekens/i)).toBeInTheDocument());
    expect(searchClubs).not.toHaveBeenCalled();
  });

  it("toont een storing als de zoekopdracht faalt", async () => {
    vi.mocked(searchClubs).mockRejectedValue(new Error("Playtomic heeft een storing"));
    render(<ClubPicker />);
    fireEvent.change(open(), { target: { value: "hangar" } });
    expect(await screen.findByText(/Playtomic heeft een storing/)).toBeInTheDocument();
  });

  it("stelt de stad voor als er niets gevonden is", async () => {
    vi.mocked(searchClubs).mockResolvedValue([]);
    render(<ClubPicker />);
    fireEvent.change(open(), { target: { value: "zzzz" } });
    expect(await screen.findByText(/Geen Belgische club gevonden/)).toBeInTheDocument();
  });

  // De eigen locatie (#322) deelt het veld met de zoekfunctie en mag er niet
  // door verdrongen worden: beide staan tegelijk in het paneel.
  it("houdt de eigen locatie naast de treffers in poll-modus", async () => {
    vi.mocked(searchClubs).mockResolvedValue([treffer]);
    const onPick = vi.fn();
    render(<ClubPicker allowManual onPick={onPick} />);

    fireEvent.change(open(), { target: { value: "hangar" } });
    expect(await screen.findByRole("button", { name: /Hangar Padel Club/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /📍 hangar/ }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "", name: "hangar", timezone: DEFAULT_CLUB.timezone }),
    );
  });
});
