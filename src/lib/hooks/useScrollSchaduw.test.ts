import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { schaduwVoor, useScrollSchaduw } from "./useScrollSchaduw";

// #912: de filterchips van de feed lopen op telefoonbreedte van het scherm af
// zonder scrollbar. Deze afleiding bepaalt aan welke kant de fade komt.
describe("schaduwVoor", () => {
  it("meldt niets als alles past", () => {
    expect(schaduwVoor(0, 300, 300)).toBe("geen");
  });

  it("wijst naar rechts aan het begin van een te brede rij", () => {
    expect(schaduwVoor(0, 900, 300)).toBe("rechts");
  });

  it("wijst naar beide kanten in het midden", () => {
    expect(schaduwVoor(300, 900, 300)).toBe("beide");
  });

  it("wijst alleen naar links aan het einde", () => {
    expect(schaduwVoor(600, 900, 300)).toBe("links");
  });

  it("negeert sub-pixel-afronding aan de randen", () => {
    // Zonder speling blijft er een fade hangen die niets meer afdekt.
    expect(schaduwVoor(0.5, 900.4, 900)).toBe("geen");
  });
});

// De filterchips van de feed worden pas breder dan het scherm zodra de tellers
// binnenkomen ("Matches 65"). De ResizeObserver kijkt naar de border box en
// vuurt dan niet, dus er werd nooit hermeten en de fade bleef weg (#944).
describe("useScrollSchaduw — hermeten bij groeiende inhoud", () => {
  it("meet opnieuw als alleen de inhoud breder wordt", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(el, "scrollWidth", { value: 200, configurable: true });
    const ref = { current: el };

    const { result, rerender } = renderHook(() => useScrollSchaduw(ref));
    expect(result.current).toBe("geen");

    // Tellers komen binnen: de rij is nu breder dan zijn doos, maar de doos
    // zelf verandert niet — geen resize-event, geen scroll-event.
    Object.defineProperty(el, "scrollWidth", { value: 400, configurable: true });
    rerender();
    expect(result.current).toBe("rechts");
  });
});
