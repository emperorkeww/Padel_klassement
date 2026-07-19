import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDictatorAnthem } from "./useDictatorAnthem";

// Bron-URL's die de hook krijgt; welke track maakt de hook niet uit, alleen dat
// er een bron is (≠ null → actief). Twee verschillende voor de wissel-test.
const SRC = "km-anthem.mp3";
const OTHER_SRC = "imperial-march.mp3";

// jsdom implementeert play()/pause() niet — stub ze zodat we het gedrag van de
// hook (spelen/stoppen/dempen/blokkeren) los kunnen testen.
let playMock: ReturnType<typeof vi.fn<() => Promise<void>>>;
let pauseMock: ReturnType<typeof vi.fn<() => void>>;

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
}

beforeEach(() => {
  playMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  pauseMock = vi.fn<() => void>();
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(
    playMock,
  );
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(
    pauseMock,
  );
  setHidden(false);
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDictatorAnthem", () => {
  it("speelt zodra active en het tabblad zichtbaar is", async () => {
    const { result } = renderHook(() => useDictatorAnthem(SRC));
    await waitFor(() => expect(result.current.playing).toBe(true));
    expect(playMock).toHaveBeenCalled();
  });

  it("speelt niet wanneer inactief", () => {
    renderHook(() => useDictatorAnthem(null));
    expect(playMock).not.toHaveBeenCalled();
  });

  it("schakelt naar de nieuwe track wanneer de heerser (src) wisselt", async () => {
    const { result, rerender } = renderHook(
      ({ src }) => useDictatorAnthem(src),
      { initialProps: { src: SRC } },
    );
    await waitFor(() => expect(result.current.playing).toBe(true));

    playMock.mockClear();
    pauseMock.mockClear();
    // Andere dictator → andere bron: oude pauzeert, nieuwe speelt.
    rerender({ src: OTHER_SRC });
    await waitFor(() => expect(playMock).toHaveBeenCalled());
    expect(pauseMock).toHaveBeenCalled();
  });

  it("stopt zodra src null wordt (troon vacant / geen dictator)", async () => {
    const { result, rerender } = renderHook(
      ({ src }: { src: string | null }) => useDictatorAnthem(src),
      { initialProps: { src: SRC as string | null } },
    );
    await waitFor(() => expect(result.current.playing).toBe(true));

    rerender({ src: null });
    expect(result.current.playing).toBe(false);
    expect(pauseMock).toHaveBeenCalled();
  });

  it("stopt (pauze) bij het verlaten van de pagina — unmount", async () => {
    const { result, unmount } = renderHook(() => useDictatorAnthem(SRC));
    await waitFor(() => expect(result.current.playing).toBe(true));
    unmount();
    expect(pauseMock).toHaveBeenCalled();
  });

  it("pauzeert wanneer het tabblad wordt verborgen en hervat bij terugkeer", async () => {
    const { result } = renderHook(() => useDictatorAnthem(SRC));
    await waitFor(() => expect(result.current.playing).toBe(true));

    playMock.mockClear();
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pauseMock).toHaveBeenCalled();

    act(() => {
      setHidden(false);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(playMock).toHaveBeenCalled();
  });

  it("dempen stopt het lied en onthoudt de voorkeur", async () => {
    const { result } = renderHook(() => useDictatorAnthem(SRC));
    await waitFor(() => expect(result.current.playing).toBe(true));

    act(() => result.current.toggleMute());
    expect(result.current.muted).toBe(true);
    expect(result.current.playing).toBe(false);
    expect(pauseMock).toHaveBeenCalled();
    expect(window.localStorage.getItem("dictator-anthem-muted")).toBe("1");
  });

  it("start niet bij mount als de gebruiker eerder dempte", () => {
    window.localStorage.setItem("dictator-anthem-muted", "1");
    const { result } = renderHook(() => useDictatorAnthem(SRC));
    expect(result.current.muted).toBe(true);
    expect(playMock).not.toHaveBeenCalled();
  });

  it("markeert blocked wanneer de browser autoplay weigert", async () => {
    playMock.mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    const { result } = renderHook(() => useDictatorAnthem(SRC));
    await waitFor(() => expect(result.current.blocked).toBe(true));
    expect(result.current.playing).toBe(false);
  });
});