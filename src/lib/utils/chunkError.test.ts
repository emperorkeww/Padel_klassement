import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  herlaadNetGeprobeerd,
  initChunkErrorDetectie,
  isChunkLoadError,
  markeerPreloadFout,
  onthoudHerlaadpoging,
} from "@/lib/utils/chunkError";

// De module houdt een tijdstempel bij dat tests niet kunnen wissen. De klok
// daarom per test vóóruit zetten in plaats van terug naar een vast moment:
// zo is een preload-fout uit een eerdere test gegarandeerd verlopen, ongeacht
// de volgorde waarin de tests draaien.
let klok = new Date("2026-07-26T10:00:00Z").getTime();
beforeEach(() => {
  vi.useFakeTimers();
  klok += 5 * 60_000;
  vi.setSystemTime(klok);
  sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

// De letterlijke meldingen zoals de browsers ze geven. Dit is puur stringwerk
// en gaat stil kapot, dus staan ze hier voluit.
const CHUNK_MELDINGEN = [
  // Chrome / Edge
  "Failed to fetch dynamically imported module: https://vamos.be/assets/Feed-CFL_vkoW.js",
  // Firefox
  "error loading dynamically imported module: https://vamos.be/assets/Feed-CFL_vkoW.js",
  // Safari
  "Importing a module script failed.",
  // Vite's CSS-preloadhelper
  "Unable to preload CSS for /assets/Leaderboard-aEGtDxRV.css",
  // SPA-fallback serveert index.html voor een verdwenen chunk
  "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\". Strict MIME type checking is enforced for module scripts per HTML spec.",
  "'text/html' is not a valid JavaScript MIME type.",
];

describe("isChunkLoadError", () => {
  it.each(CHUNK_MELDINGEN)("herkent: %s", (melding) => {
    expect(isChunkLoadError(new Error(melding))).toBe(true);
  });

  it("herkent de webpack-stijl foutnaam", () => {
    const fout = new Error("Loading chunk 3 failed.");
    fout.name = "ChunkLoadError";
    expect(isChunkLoadError(fout)).toBe(true);
  });

  it("houdt een gewone programmeerfout erbuiten", () => {
    expect(
      isChunkLoadError(
        new Error("Cannot read properties of undefined (reading 'rating')"),
      ),
    ).toBe(false);
    expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });

  it("gaat om met een fout die geen Error is", () => {
    expect(isChunkLoadError("Failed to fetch dynamically imported module")).toBe(true);
    expect(isChunkLoadError({ zomaar: "iets" })).toBe(false);
  });

  it("telt een recente preload-fout mee, ook zonder bruikbare melding", () => {
    expect(isChunkLoadError(new Error("iets vaags"))).toBe(false);
    markeerPreloadFout();
    expect(isChunkLoadError(new Error("iets vaags"))).toBe(true);
  });

  it("laat een oude preload-fout weer los", () => {
    markeerPreloadFout();
    vi.advanceTimersByTime(11_000);
    expect(isChunkLoadError(new Error("iets vaags"))).toBe(false);
  });
});

describe("initChunkErrorDetectie", () => {
  it("luistert naar vite:preloadError en ruimt zichzelf op", () => {
    const stop = initChunkErrorDetectie();
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(isChunkLoadError(new Error("iets vaags"))).toBe(true);

    vi.advanceTimersByTime(11_000);
    stop();
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(isChunkLoadError(new Error("iets vaags"))).toBe(false);
  });
});

describe("herlaad-guard", () => {
  it("weet dat er net herladen is en vergeet dat na een minuut", () => {
    expect(herlaadNetGeprobeerd()).toBe(false);
    onthoudHerlaadpoging();
    expect(herlaadNetGeprobeerd()).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(herlaadNetGeprobeerd()).toBe(false);
  });

  it("blijft overeind als sessionStorage niet mag (private mode)", () => {
    // De hele global vervangen i.p.v. een spy: de sessionStorage in deze
    // omgeving is een proxy die toegewezen eigenschappen als opgeslagen
    // sleutels behandelt, waardoor een spy er niet overheen komt.
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() => onthoudHerlaadpoging()).not.toThrow();
    expect(herlaadNetGeprobeerd()).toBe(false);
    vi.unstubAllGlobals();
  });
});
