import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useVerbergBijScrollen } from "./useVerbergBijScrollen";

// De zwevende acties (#942) lagen tijdens het scrollen over de score-steppers
// van een matchkaart en over de rating van de klassementsrij eronder. Deze
// suite bewaakt wanneer ze wijken en wanneer ze terugkomen.

/** Zet de scrollpositie en vuur het event dat de hook afluistert. rAF is in de
 *  testomgeving direct, dus na deze call staat de nieuwe stand vast. */
function scrollNaar(y: number) {
  act(() => {
    window.scrollY = y;
    window.dispatchEvent(new Event("scroll"));
  });
}

beforeEach(() => {
  window.scrollY = 0;
  // jsdom kent requestAnimationFrame, maar niet synchroon; direct uitvoeren
  // houdt de test bij de logica in plaats van bij de timing.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

describe("useVerbergBijScrollen", () => {
  it("staat er bij het openen van de pagina", () => {
    const { result } = renderHook(() => useVerbergBijScrollen());
    expect(result.current).toBe(false);
  });

  it("wijkt zodra je vooruit scrolt", () => {
    const { result } = renderHook(() => useVerbergBijScrollen());
    scrollNaar(600);
    expect(result.current).toBe(true);
  });

  it("komt terug zodra je terugscrolt", () => {
    const { result } = renderHook(() => useVerbergBijScrollen());
    scrollNaar(600);
    scrollNaar(400);
    expect(result.current).toBe(false);
  });

  it("blijft staan in de rustzone bovenaan", () => {
    // Meteen verdwijnen bij de eerste veeg voelt kapot, en bovenaan ligt er
    // niets onder de knop dat je net wilde raken.
    const { result } = renderHook(() => useVerbergBijScrollen());
    scrollNaar(80);
    expect(result.current).toBe(false);
  });

  it("negeert kleine bewegingen", () => {
    // Rubber-band, een tik op de pagina of een herberekende layout mogen de
    // knop niet laten knipperen.
    const { result } = renderHook(() => useVerbergBijScrollen());
    scrollNaar(600);
    scrollNaar(595);
    expect(result.current).toBe(true);
  });

  it("staat er weer na een sprong naar boven", () => {
    // Ankerlink of routewissel: dan hoort de knop er meteen te staan, zonder
    // dat je eerst een stukje omhoog moet scrollen.
    const { result } = renderHook(() => useVerbergBijScrollen());
    scrollNaar(900);
    expect(result.current).toBe(true);
    scrollNaar(0);
    expect(result.current).toBe(false);
  });
});
