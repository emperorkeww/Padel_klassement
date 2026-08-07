import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { scrollVoortgang, useGlasScrollLicht } from "./useGlasScrollLicht";

function stelBewegingIn(gedempt: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: gedempt })),
  );
}

/** Zet de scrollmaten van het document zoals de hook ze uitleest. */
function stelPaginaIn(scrollY: number, documentHoogte: number, venster: number) {
  vi.stubGlobal("scrollY", scrollY);
  vi.stubGlobal("innerHeight", venster);
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(
    documentHoogte,
  );
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 7;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  stelBewegingIn(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("scrollVoortgang", () => {
  it("loopt van 0 bovenaan naar 1 onderaan", () => {
    expect(scrollVoortgang(0, 2000, 800)).toBe(0);
    expect(scrollVoortgang(600, 2000, 800)).toBe(0.5);
    expect(scrollVoortgang(1200, 2000, 800)).toBe(1);
  });

  it("houdt het licht in het midden als de pagina in beeld past", () => {
    // Geen speling betekent niets te volgen; een licht dat dan in de hoek
    // blijft hangen zou als een fout lezen in plaats van als glans.
    expect(scrollVoortgang(0, 700, 800)).toBe(0.5);
    expect(scrollVoortgang(0, 800, 800)).toBe(0.5);
  });

  it("klemt af buiten de grenzen", () => {
    // iOS laat je voorbij het einde trekken (rubber banding); dat mag het
    // hooglicht niet van het vlak af duwen.
    expect(scrollVoortgang(-200, 2000, 800)).toBe(0);
    expect(scrollVoortgang(9999, 2000, 800)).toBe(1);
  });
});

describe("useGlasScrollLicht", () => {
  function koppel(el: HTMLElement, actief = true) {
    const { result, unmount, rerender } = renderHook(
      ({ aan }: { aan: boolean }) => {
        const ref = useGlasScrollLicht<HTMLElement>(aan);
        ref.current = el;
        return ref;
      },
      { initialProps: { aan: actief } },
    );
    // De ref wordt tijdens de eerste render gezet; het effect draait daarna,
    // dus één rerender laat de hook 'm echt zien.
    rerender({ aan: actief });
    return { result, unmount };
  }

  it("zet het licht op de scrollpositie en volgt verdere scrolls", () => {
    const el = document.createElement("div");
    stelPaginaIn(0, 2000, 800);
    const { unmount } = koppel(el);

    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("0%");

    stelPaginaIn(600, 2000, 800);
    window.dispatchEvent(new Event("scroll"));
    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("50%");

    unmount();
    // Terug naar de rustpositie uit glas.css.
    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
  });

  it("beweegt niet met een bewegingsvoorkeur", () => {
    stelBewegingIn(true);
    const el = document.createElement("div");
    stelPaginaIn(600, 2000, 800);
    koppel(el);

    // Geen listener en geen beginwaarde: het licht blijft staan waar glas.css
    // het zet. `glas--levend` geeft dan nog steeds een stilstaande glans.
    window.dispatchEvent(new Event("scroll"));
    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
  });

  it("doet niets als hij uit staat", () => {
    const el = document.createElement("div");
    stelPaginaIn(600, 2000, 800);
    koppel(el, false);

    window.dispatchEvent(new Event("scroll"));
    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
  });
});
