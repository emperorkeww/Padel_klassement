import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { Sheet } from "@/ui/Sheet";

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

  it("draagt het glasmateriaal in de scrollbare variant (#1062)", () => {
    render(
      <Sheet open onClose={() => {}} title="Titel" className="eigen">
        <p>Inhoud</p>
      </Sheet>,
    );

    const paneel = screen.getByRole("dialog");
    expect(paneel).toHaveClass("glas", "glas--sterk");
    // Het paneel scrollt; met de gewone lagen zou de rand na één schermhoogte
    // scrollen ergens in het niets komen te staan.
    expect(paneel).toHaveClass("glas--scrollbaar");
    // Geen vorm-class: de sheet houdt zijn eigen hoeken (alleen bovenaan rond
    // op mobiel, helemaal rond op desktop).
    expect(paneel.className).not.toMatch(/glas--paneel|glas--pil|glas--cirkel/);
    expect(paneel).toHaveClass("eigen");
  });

  // Deze regel is met een render niet te betrappen — jsdom rekent geen CSS uit
  // en kent geen backdrop root — maar hij breekt het glas volledig zodra
  // iemand hem terugdraait, en dan zie je het alleen in de browser.
  it("houdt opacity uit de sheet-animaties (#1062)", () => {
    const css = readFileSync("src/components/ui/ui.css", "utf8");
    const keyframes = css.match(/@keyframes sheet-(up|fade)\s*\{[\s\S]*?\n\}/g);

    expect(keyframes).toHaveLength(2);
    for (const blok of keyframes!) {
      // Een element met opacity < 1 is een backdrop root: de backdrop-filter
      // van het paneel erin ziet dan niets meer van de pagina, en Chrome houdt
      // die laag ook ná de animatie vast. De sheet wordt dan een doorzichtig
      // vlak zonder blur, met de pagina scherp leesbaar er dwars doorheen.
      expect(blok).not.toMatch(/opacity/);
    }
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
