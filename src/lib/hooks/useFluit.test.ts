import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/features/coach/components/var_fluit.mp3", () => ({
  default: "fluit.mp3",
}));

import { useFluit } from "@/lib/hooks/useFluit";

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

class FakeAudio {
  src: string;
  preload = "";
  currentTime = 0;
  constructor(src?: string) {
    this.src = src ?? "";
  }
  play = play;
  pause = pause;
}

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  window.sessionStorage.clear();
  window.localStorage.clear();
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFluit", () => {
  it("fluit één keer per zaak", () => {
    const { result } = renderHook(() => useFluit());
    act(() => result.current.fluit("zaak-1"));
    act(() => result.current.fluit("zaak-1"));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("fluit wel opnieuw voor een andere zaak", () => {
    const { result } = renderHook(() => useFluit());
    act(() => result.current.fluit("zaak-1"));
    act(() => result.current.fluit("zaak-2"));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("zwijgt als de gebruiker gedempt heeft, en onthoudt dat", () => {
    const { result } = renderHook(() => useFluit());
    act(() => result.current.toggleMute());
    expect(result.current.muted).toBe(true);
    act(() => result.current.fluit("zaak-1"));
    expect(play).not.toHaveBeenCalled();
    // Een volgende sessie start gedempt.
    const tweede = renderHook(() => useFluit());
    expect(tweede.result.current.muted).toBe(true);
  });

  it("zwijgt bij prefers-reduced-motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const { result } = renderHook(() => useFluit());
    act(() => result.current.fluit("zaak-1"));
    expect(play).not.toHaveBeenCalled();
  });

  it("laat een geweigerde autoplay stil passeren", async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error("NotAllowed")));
    const { result } = renderHook(() => useFluit());
    expect(() => act(() => result.current.fluit("zaak-1"))).not.toThrow();
  });

  it("doet niets in een omgeving zonder Audio", () => {
    vi.stubGlobal("Audio", undefined);
    const { result } = renderHook(() => useFluit());
    expect(() => act(() => result.current.fluit("zaak-1"))).not.toThrow();
    expect(play).not.toHaveBeenCalled();
  });
});
