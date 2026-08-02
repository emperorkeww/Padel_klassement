import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle } from "./usePageTitle";

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
