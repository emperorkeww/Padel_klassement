import { describe, it, expect } from "vitest";
import { patchSpeelParams } from "./speelParams";

describe("patchSpeelParams", () => {
  it("zet en wist sleutels zonder de rest van de URL aan te raken", () => {
    const prev = new URLSearchParams("groep=g1&periode=7d&tab=leden");
    const next = patchSpeelParams(prev, { groep: "g2" });
    expect(next.get("groep")).toBe("g2");
    expect(next.get("periode")).toBe("7d");
    expect(next.get("tab")).toBe("leden");
  });

  it("wist een sleutel bij null én bij een lege waarde", () => {
    const prev = new URLSearchParams("groep=g1&periode=7d");
    expect(patchSpeelParams(prev, { groep: null }).has("groep")).toBe(false);
    // "Alle groepen" is de afwezigheid van de parameter, geen lege waarde:
    // ?groep= in de URL zou net zo goed lezen als een echte keuze.
    expect(patchSpeelParams(prev, { groep: "" }).has("groep")).toBe(false);
  });

  it("laat het origineel ongemoeid", () => {
    const prev = new URLSearchParams("groep=g1");
    patchSpeelParams(prev, { groep: "g2", periode: "30d" });
    expect(prev.get("groep")).toBe("g1");
    expect(prev.has("periode")).toBe(false);
  });

  // De reden van bestaan van deze functie: twee losse setSearchParams-calls in
  // dezelfde tick lezen allebei dezelfde snapshot en overschrijven elkaar. Eén
  // patch met twee sleutels kan dat niet.
  it("past meerdere sleutels van één actie in één keer toe", () => {
    const prev = new URLSearchParams("groep=g1&periode=7d&log=1");
    const next = patchSpeelParams(prev, { groep: null, periode: null });
    expect(next.has("groep")).toBe(false);
    expect(next.has("periode")).toBe(false);
    expect(next.get("log")).toBe("1");
  });
});
