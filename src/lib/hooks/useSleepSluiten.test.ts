import { describe, it, expect } from "vitest";
import { besluit, scrimFactor } from "./useSleepSluiten";

// De rekenkundige helft van de sleephook (#1180). Het gebaar zelf staat in
// Sheet.test.tsx; hier alleen de twee grenzen waar het op aankomt.

describe("besluit()", () => {
  it("sluit pas voorbij de afstandsdrempel", () => {
    expect(besluit(95, 0)).toBe("terug");
    expect(besluit(97, 0)).toBe("sluit");
  });

  it("neemt een korte, snelle zwiep ook aan", () => {
    // Ver onder de afstandsdrempel, maar wel besliste snelheid.
    expect(besluit(40, 0.9)).toBe("sluit");
    // Snel maar nauwelijks bewogen is een tik, geen veeg.
    expect(besluit(20, 0.9)).toBe("terug");
    // Ver genoeg voor de snelheidsregel, maar traag: dan telt de afstand.
    expect(besluit(40, 0.4)).toBe("terug");
  });
});

describe("scrimFactor()", () => {
  it("laat de achtergrond terugkomen, maar nooit helemaal", () => {
    expect(scrimFactor(0)).toBe(1);
    expect(scrimFactor(200)).toBeCloseTo(0.5);
    // De pagina eronder is geen bestemming: er blijft altijd scrim staan.
    expect(scrimFactor(10_000)).toBeCloseTo(0.3);
  });

  it("houdt omhoog trekken op de rusttoestand", () => {
    expect(scrimFactor(-80)).toBe(1);
  });
});
