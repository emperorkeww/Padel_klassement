import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  aanwijzerPositie,
  fijneAanwijzer,
  useGlasAanwijzer,
} from "./useGlasAanwijzer";

function stelAanwijzerIn(fijn: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: fijn })),
  );
}

/** Genoeg van een React-pointerevent om de handlers te voeden. */
function nepEvent(el: HTMLElement, clientX = 0, clientY = 0) {
  return { currentTarget: el, clientX, clientY } as ReactPointerEvent<HTMLElement>;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 7;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("aanwijzerPositie", () => {
  it("rekent om naar coördinaten binnen het vlak", () => {
    expect(aanwijzerPositie({ left: 100, top: 40 }, 160, 52)).toEqual({
      x: "60px",
      y: "12px",
    });
  });

  it("rondt af, want subpixels leveren hier niets op", () => {
    expect(aanwijzerPositie({ left: 0.4, top: 0.4 }, 10, 10)).toEqual({
      x: "10px",
      y: "10px",
    });
  });
});

describe("fijneAanwijzer", () => {
  it("is onwaar zonder matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(fijneAanwijzer()).toBe(false);
  });

  it("volgt de mediaquery", () => {
    stelAanwijzerIn(true);
    expect(fijneAanwijzer()).toBe(true);
    stelAanwijzerIn(false);
    expect(fijneAanwijzer()).toBe(false);
  });
});

describe("useGlasAanwijzer (#1062)", () => {
  it("geeft niets terug op een aanraakscherm", () => {
    stelAanwijzerIn(false);
    const { result } = renderHook(() => useGlasAanwijzer());
    expect(result.current.onPointerMove).toBeUndefined();
    expect(result.current.onPointerLeave).toBeUndefined();
  });

  it("geeft niets terug als het vlak niet interactief is", () => {
    stelAanwijzerIn(true);
    const { result } = renderHook(() => useGlasAanwijzer(false));
    expect(result.current.onPointerMove).toBeUndefined();
  });

  it("schrijft de positie op het element, zonder rerender", () => {
    stelAanwijzerIn(true);
    let renders = 0;
    const el = document.createElement("div");
    const { result } = renderHook(() => {
      renders++;
      return useGlasAanwijzer();
    });

    result.current.onPointerMove!(nepEvent(el, 48, 16));

    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("48px");
    expect(el.style.getPropertyValue("--glas-aanwijzer-y")).toBe("16px");
    // De hele reden dat dit geen state is: bewegen mag geen render kosten.
    expect(renders).toBe(1);
  });

  it("vraagt hoogstens één frame aan per reeks bewegingen", () => {
    stelAanwijzerIn(true);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const el = document.createElement("div");
    const { result } = renderHook(() => useGlasAanwijzer());

    result.current.onPointerMove!(nepEvent(el, 10, 10));
    result.current.onPointerMove!(nepEvent(el, 20, 20));
    result.current.onPointerMove!(nepEvent(el, 30, 30));
    expect(frames).toHaveLength(1);

    // En dan telt de laatste positie, niet de eerste.
    frames[0](0);
    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("30px");
  });

  it("wist het hooglicht als de aanwijzer het vlak verlaat", () => {
    stelAanwijzerIn(true);
    const el = document.createElement("div");
    const { result } = renderHook(() => useGlasAanwijzer());

    result.current.onPointerMove!(nepEvent(el, 48, 16));
    result.current.onPointerLeave!(nepEvent(el));

    expect(el.style.getPropertyValue("--glas-aanwijzer-x")).toBe("");
    expect(el.style.getPropertyValue("--glas-aanwijzer-y")).toBe("");
  });
});
