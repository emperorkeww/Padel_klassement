import { describe, expect, it } from "vitest";
import { naarFoutRij } from "./foutmelding.ts";

// Wat errorReport.ts echt verstuurt (zie de payload onderin meldFout).
const ECHTE_MELDING = {
  bron: "render",
  bericht: "Cannot read properties of undefined (reading 'naam')",
  stack: "TypeError: ...\n  at MatchDetail",
  componentStack: "\n  in MatchDetail\n  in ErrorBoundary",
  scope: "route",
  chunk: false,
  pad: "/match/abc",
  build: "2026-08-08T10:00:00Z",
  sessie: "k3j4h5g6",
  ua: "Mozilla/5.0 (Linux; Android 14)",
};

describe("naarFoutRij", () => {
  it("neemt een echte melding van errorReport.ts over", () => {
    expect(naarFoutRij(ECHTE_MELDING)).toEqual({
      bron: "render",
      bericht: "Cannot read properties of undefined (reading 'naam')",
      stack: "TypeError: ...\n  at MatchDetail",
      component_stack: "\n  in MatchDetail\n  in ErrorBoundary",
      scope: "route",
      chunk: false,
      pad: "/match/abc",
      build: "2026-08-08T10:00:00Z",
      sessie: "k3j4h5g6",
      user_agent: "Mozilla/5.0 (Linux; Android 14)",
    });
  });

  it("houdt de chunk-markering vast", () => {
    const rij = naarFoutRij({ ...ECHTE_MELDING, chunk: true });
    expect(rij?.chunk).toBe(true);
  });

  // Dit endpoint is publiek en ongeauthenticeerd. Alles hieronder is wat een
  // willekeurige POST erin kan gooien.
  describe("rommel van buiten", () => {
    it("weigert een melding zonder bericht", () => {
      expect(naarFoutRij({ bron: "render" })).toBeNull();
      expect(naarFoutRij({ bericht: "   " })).toBeNull();
      expect(naarFoutRij({ bericht: 42 })).toBeNull();
    });

    it("weigert wat geen object is", () => {
      expect(naarFoutRij(null)).toBeNull();
      expect(naarFoutRij("kapot")).toBeNull();
      expect(naarFoutRij(["kapot"])).toBeNull();
      expect(naarFoutRij(undefined)).toBeNull();
    });

    it("vervangt een onbekende bron door 'onbekend'", () => {
      expect(naarFoutRij({ bericht: "x", bron: "verzonnen" })?.bron).toBe(
        "onbekend",
      );
      expect(naarFoutRij({ bericht: "x" })?.bron).toBe("onbekend");
      expect(naarFoutRij({ bericht: "x", bron: { a: 1 } })?.bron).toBe(
        "onbekend",
      );
    });

    it("maakt van chunk altijd een echte boolean", () => {
      // "true" als string mag niet stilzwijgend waar worden.
      expect(naarFoutRij({ bericht: "x", chunk: "true" })?.chunk).toBe(false);
      expect(naarFoutRij({ bericht: "x", chunk: 1 })?.chunk).toBe(false);
    });

    it("negeert velden van het verkeerde type in plaats van te vallen", () => {
      const rij = naarFoutRij({
        bericht: "x",
        stack: { boom: true },
        pad: 12,
        ua: null,
      });
      expect(rij?.stack).toBeNull();
      expect(rij?.pad).toBeNull();
      expect(rij?.user_agent).toBeNull();
    });

    // De client kapt af op 1500 en de Worker op 8 kB, maar wie het endpoint
    // rechtstreeks aanroept doet geen van beide.
    it("kapt elk veld af op zijn eigen grens", () => {
      const rij = naarFoutRij({
        bericht: "b".repeat(5000),
        stack: "s".repeat(50_000),
        componentStack: "c".repeat(50_000),
        pad: "/p".repeat(5000),
        ua: "u".repeat(5000),
        scope: "x".repeat(500),
      });
      expect(rij?.bericht).toHaveLength(500);
      expect(rij?.stack).toHaveLength(4000);
      expect(rij?.component_stack).toHaveLength(4000);
      expect(rij?.pad).toHaveLength(300);
      expect(rij?.user_agent).toHaveLength(300);
      expect(rij?.scope).toHaveLength(100);
    });

    it("maakt van lege strings null in plaats van lege rijen", () => {
      const rij = naarFoutRij({ bericht: "x", stack: "", scope: "  " });
      expect(rij?.stack).toBeNull();
      expect(rij?.scope).toBeNull();
    });
  });
});
