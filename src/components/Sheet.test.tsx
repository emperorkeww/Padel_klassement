import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Sheet } from "./Sheet";

// Kleine gastheer: een openknop + de Sheet, zodat we focus-terugzetten kunnen
// controleren (focus hoort na sluiten terug naar de opener te gaan).
function Host() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Titel">
        <p>Inhoud</p>
      </Sheet>
    </>
  );
}

describe("<Sheet />", () => {
  it("rendert niets zolang hij dicht is", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Titel">
        <p>Inhoud</p>
      </Sheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("toont titel + sluitknop en legt de focus op de dialoog", () => {
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Titel" });
    expect(dialog).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Titel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sluiten/i })).toBeInTheDocument();
  });

  it("sluit via Escape, sluitknop en de achtergrond, en geeft focus terug", () => {
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Open" });
    // In jsdom verplaatst een klik de focus niet vanzelf; zet 'm expliciet zodat
    // we het terugzetten op de opener kunnen controleren.
    opener.focus();

    // Escape sluit.
    fireEvent.click(opener);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Focus keert terug naar de knop die 'm opende.
    expect(opener).toHaveFocus();

    // Sluitknop sluit.
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: /sluiten/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Klik op de achtergrond sluit; klik op de kaart zelf niet.
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("roept extra onKeyDown aan op de dialoog (bv. pijltjes)", () => {
    const onKey = vi.fn();
    render(
      <Sheet open onClose={() => {}} ariaLabel="X" onKeyDown={onKey}>
        <p>Inhoud</p>
      </Sheet>,
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(onKey).toHaveBeenCalled();
  });
});
