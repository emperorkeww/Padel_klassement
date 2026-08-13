import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle, usePaginaTitel } from "./usePageTitle";

afterEach(() => {
  document.title = "Vamos!";
});

describe("usePageTitle (#910)", () => {
  it("zet de tabtitel met het merk erachter", () => {
    renderHook(() => usePageTitle("Klassement"));
    expect(document.title).toBe("Klassement · Vamos!");
  });

  it("volgt een wijziging binnen dezelfde pagina", () => {
    const { rerender } = renderHook(({ t }) => usePageTitle(t), {
      initialProps: { t: "Overzicht" },
    });
    expect(document.title).toBe("Overzicht · Vamos!");
    rerender({ t: "Clubblad" });
    expect(document.title).toBe("Clubblad · Vamos!");
  });

  it("laat de titel staan zolang de data nog laadt (null)", () => {
    document.title = "Vorige · Vamos!";
    renderHook(() => usePageTitle(null));
    expect(document.title).toBe("Vorige · Vamos!");
  });

  it("valt bij unmount terug op het merk alleen", () => {
    const { unmount } = renderHook(() => usePageTitle("Vrienden"));
    expect(document.title).toBe("Vrienden · Vamos!");
    unmount();
    expect(document.title).toBe("Vamos!");
  });
});

// De store die de mobiele topbalk voedt (#1299). Zelfde aanroep, ander gedrag
// bij `null`: de tabtitel blijft staan, de balk moet juist terugvallen.
describe("usePaginaTitel (#1299)", () => {
  it("geeft de titel van de gemounte pagina door", () => {
    const { result } = renderHook(() => {
      usePageTitle("Klassement");
      return usePaginaTitel();
    });
    expect(result.current).toBe("Klassement");
  });

  it("volgt een wijziging binnen dezelfde pagina", () => {
    const { result, rerender } = renderHook(
      ({ t }) => {
        usePageTitle(t);
        return usePaginaTitel();
      },
      { initialProps: { t: "Overzicht" } },
    );
    expect(result.current).toBe("Overzicht");
    rerender({ t: "Clubblad" });
    expect(result.current).toBe("Clubblad");
  });

  it("blijft leeg zolang de titel nog laadt, terwijl de tabtitel staat", () => {
    document.title = "Vorige · Vamos!";
    const { result } = renderHook(() => {
      usePageTitle(null);
      return usePaginaTitel();
    });
    expect(result.current).toBeNull();
    expect(document.title).toBe("Vorige · Vamos!");
  });

  it("is bij unmount weer leeg", () => {
    const { result, unmount } = renderHook(() => {
      usePageTitle("Vrienden");
      return usePaginaTitel();
    });
    expect(result.current).toBe("Vrienden");
    unmount();
    // Een losse lezer ziet de lege store; `result.current` bevriest bij unmount.
    const { result: naderhand } = renderHook(() => usePaginaTitel());
    expect(naderhand.current).toBeNull();
  });
});
