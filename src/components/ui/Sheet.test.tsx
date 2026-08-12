import { describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  createEvent,
} from "@testing-library/react";
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

  it("stelt zijn materiaal bij met genoeg gewicht (#1083)", () => {
    const css = readFileSync("src/components/ui/ui.css", "utf8");

    // glas.css komt ná ui.css in de cascade, dus `.sheet { --glas-dekking }`
    // verliest van `.glas--sterk` en doet niets. Dit kostte een meetronde:
    // de afstelling stond er, en er kwam gewoon niets van aan.
    expect(css).toMatch(/\.sheet\.glas \{[^}]*--glas-dekking:/);
    expect(css).not.toMatch(/\n\.sheet \{[^}]*--glas-dekking:/);

    // De scrim onder een glazen paneel is lichter dan die van de lightboxen:
    // scrim én materiaal dempten allebei, en dan blijft er van de pagina niets
    // herkenbaars over. De lightboxen houden --overlay.
    expect(css).toMatch(/\.sheet-backdrop \{[^}]*--scrim: var\(--overlay-glas\)/);
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

/* ------------------------------------------------------------------ */
/* Veeg omlaag om te sluiten (#1180)                                    */
/* ------------------------------------------------------------------ */

/**
 * Eén aanraakpunt op (x, y), op tijdstip `t`. Touch-events en niet
 * pointer-events, precies om dezelfde reden als in de hook: dit is een
 * vingerbeweging.
 *
 * `timeStamp` staat als getter op Event en is niet via de init mee te geven;
 * met een eigen property op de instantie overschaduw je hem. Zonder dat leest
 * de hook de echte klok, en dan hangt de snelheid — en dus of de sheet sluit —
 * af van hoe druk de machine het heeft.
 */
function raak(
  el: Element,
  soort: "touchStart" | "touchMove" | "touchEnd" | "touchCancel",
  y: number,
  { x = 0, t = 0 }: { x?: number; t?: number } = {},
) {
  const punt = { clientX: x, clientY: y };
  const touches = soort === "touchEnd" || soort === "touchCancel" ? [] : [punt];
  const gebeurtenis = createEvent[soort](el, {
    touches,
    changedTouches: [punt],
  });
  Object.defineProperty(gebeurtenis, "timeStamp", { value: t });
  return fireEvent(el, gebeurtenis);
}

/** De sluitanimatie leest de hoogte van het paneel; jsdom rekent geen layout. */
function metHoogte(el: Element, hoogte = 400) {
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    height: hoogte,
  } as DOMRect);
}

function opent(onClose = vi.fn()) {
  render(
    <Sheet open onClose={onClose} title="Titel">
      <p>Inhoud</p>
    </Sheet>,
  );
  const paneel = screen.getByRole("dialog");
  metHoogte(paneel);
  return { paneel, onClose };
}

describe("<Sheet /> — veeg omlaag om te sluiten (#1180)", () => {
  it("volgt de vinger en sluit voorbij de drempel", () => {
    const { paneel, onClose } = opent();

    raak(paneel, "touchStart", 100, { t: 0 });
    // Voorbij de slop: het gebaar is van ons.
    raak(paneel, "touchMove", 112, { t: 60 });
    raak(paneel, "touchMove", 230, { t: 400 });
    expect(paneel.style.transform).toBe("translateY(130px)");

    raak(paneel, "touchEnd", 230, { t: 420 });
    // Eerst uit beeld schuiven, pas dán sluiten: anders verdwijnt hij
    // halverwege de beweging.
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.transitionEnd(paneel, { propertyName: "transform" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("veert terug onder de drempel", () => {
    const { paneel, onClose } = opent();

    // Traag: ruim een halve seconde over 50px, dus ook geen zwiep.
    raak(paneel, "touchStart", 100, { t: 0 });
    raak(paneel, "touchMove", 112, { t: 200 });
    raak(paneel, "touchMove", 150, { t: 600 });
    expect(paneel.style.transform).toBe("translateY(50px)");

    raak(paneel, "touchEnd", 150, { t: 620 });
    expect(onClose).not.toHaveBeenCalled();
    expect(paneel.style.transform).toBe("");
  });

  it("neemt een korte, snelle zwiep ook aan", () => {
    const { paneel, onClose } = opent();

    // 60px in 60ms is ver onder de afstandsdrempel, maar niemand doet dat per
    // ongeluk.
    raak(paneel, "touchStart", 100, { t: 0 });
    raak(paneel, "touchMove", 112, { t: 12 });
    raak(paneel, "touchMove", 160, { t: 60 });
    raak(paneel, "touchEnd", 160, { t: 62 });

    fireEvent.transitionEnd(paneel, { propertyName: "transform" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("laat een gescrolde sheet met rust — dan scrol je, dan veeg je niet", () => {
    const { paneel, onClose } = opent();
    Object.defineProperty(paneel, "scrollTop", {
      value: 120,
      configurable: true,
    });

    raak(paneel, "touchStart", 100, { t: 0 });
    const bewogen = raak(paneel, "touchMove", 260, { t: 100 });

    expect(paneel.style.transform).toBe("");
    // De browser mag gewoon zijn eigen scroll doen.
    expect(bewogen).toBe(true);
    raak(paneel, "touchEnd", 260, { t: 120 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("kaapt een horizontale veeg niet", () => {
    const { paneel, onClose } = opent();

    raak(paneel, "touchStart", 100, { x: 200, t: 0 });
    raak(paneel, "touchMove", 106, { x: 260, t: 60 });
    // Ook als de vinger daarna alsnog zakt: de richting is één keer beslist,
    // anders springt de sheet halverwege een zijwaartse veeg mee.
    raak(paneel, "touchMove", 240, { x: 260, t: 200 });

    expect(paneel.style.transform).toBe("");
    raak(paneel, "touchEnd", 240, { x: 260, t: 220 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("veert terug als het systeem het gebaar afbreekt", () => {
    const { paneel, onClose } = opent();

    raak(paneel, "touchStart", 100, { t: 0 });
    raak(paneel, "touchMove", 112, { t: 60 });
    raak(paneel, "touchMove", 260, { t: 400 });
    raak(paneel, "touchCancel", 260, { t: 420 });

    expect(paneel.style.transform).toBe("");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("slikt de klik op de achtergrond na een veeg die terugveerde", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Titel">
        <p>Inhoud</p>
      </Sheet>,
    );
    const paneel = screen.getByRole("dialog");
    metHoogte(paneel);
    const achtergrond = paneel.parentElement!;

    raak(paneel, "touchStart", 100, { t: 0 });
    raak(paneel, "touchMove", 112, { t: 200 });
    raak(paneel, "touchMove", 150, { t: 600 });
    raak(paneel, "touchEnd", 150, { t: 620 });

    // De vinger eindigt boven de achtergrond; de browser maakt daar een klik
    // van, en die zou de sheet alsnog sluiten.
    fireEvent.click(achtergrond);
    expect(onClose).not.toHaveBeenCalled();
    // Daarna sluit een echte klik gewoon weer.
    fireEvent.click(achtergrond);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("toont een sleepgreep zonder er een tweede sluitknop van te maken", () => {
    const { paneel } = opent();

    const greep = paneel.querySelector(".sheet__greep");
    expect(greep).toBeInTheDocument();
    expect(greep).toHaveAttribute("aria-hidden", "true");
    // Twee controls die allebei "Sluiten" heten is ruis voor een schermlezer —
    // en het maakt getByRole("button", {name: /sluiten/i}) in de rest van de
    // testsuite meteen dubbelzinnig.
    expect(screen.getAllByRole("button", { name: /sluiten/i })).toHaveLength(1);
  });

  it("dimt de scrim via kleur en niet via opacity (#1062)", () => {
    const css = readFileSync("src/components/ui/ui.css", "utf8");
    // Zonder commentaar: het waarschuwt hier nu juist vóór opacity, en dat
    // woord zou de assertie hieronder anders zelf laten struikelen.
    const blok = css
      .match(/\.sheet-backdrop \{[^}]*\}/)![0]
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Een element met opacity < 1 is een backdrop root: de backdrop-filter van
    // het glazen paneel erin ziet dan niets meer van de pagina.
    expect(blok).toMatch(/--sheet-scrim: 1/);
    expect(blok).toMatch(/color-mix\(\s*in srgb,\s*var\(--scrim\)/);
    expect(blok).not.toMatch(/opacity/);
    // Scrollen in de sheet mag niet doorslaan naar pull-to-refresh: dat is
    // hetzelfde gebaar als wegvegen.
    expect(css).toMatch(/\.sheet \{[^}]*overscroll-behavior: contain/);
  });
});
