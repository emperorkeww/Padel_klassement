import { describe, expect, it } from "vitest";
import {
  afwezigLabel,
  zichtbareSpelers,
  type KiesbareSpeler,
} from "./spelersKiezer";

const SPELERS: KiesbareSpeler[] = [
  { id: "a", naam: "Papapadel" },
  { id: "b", naam: "Ciska Slowack" },
  { id: "c", naam: "Gilles Smet" },
  { id: "d", naam: "Brecht" },
];

describe("zichtbareSpelers", () => {
  it("toont zonder filter en zoekterm iedereen in de oorspronkelijke volgorde", () => {
    const uit = zichtbareSpelers(SPELERS, {
      zoek: "",
      filter: "alles",
      gekozen: new Set(["a"]),
    });
    expect(uit.map((s) => s.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("splitst op aanwezig en afwezig", () => {
    const gekozen = new Set(["a", "c"]);
    expect(
      zichtbareSpelers(SPELERS, { zoek: "", filter: "aan", gekozen }).map(
        (s) => s.id,
      ),
    ).toEqual(["a", "c"]);
    expect(
      zichtbareSpelers(SPELERS, { zoek: "", filter: "uit", gekozen }).map(
        (s) => s.id,
      ),
    ).toEqual(["b", "d"]);
  });

  it("zoekt hoofdletterongevoelig op een deel van de naam", () => {
    const uit = zichtbareSpelers(SPELERS, {
      zoek: "SLOW",
      filter: "alles",
      gekozen: new Set(),
    });
    expect(uit.map((s) => s.id)).toEqual(["b"]);
  });

  it("negeert spaties rond de zoekterm", () => {
    const uit = zichtbareSpelers(SPELERS, {
      zoek: "   ",
      filter: "alles",
      gekozen: new Set(),
    });
    expect(uit).toHaveLength(4);
  });

  it("combineert de filtertab met de zoekterm", () => {
    const uit = zichtbareSpelers(SPELERS, {
      zoek: "gilles",
      filter: "uit",
      gekozen: new Set(["c"]),
    });
    // Gilles staat aan, dus onder "Afwezig" blijft er niets over.
    expect(uit).toEqual([]);
  });
});

describe("afwezigLabel", () => {
  it("is leeg als er niemand afwezig is", () => {
    expect(afwezigLabel([])).toBe("");
  });

  it("somt tot en met drie namen op", () => {
    expect(afwezigLabel(["Ciska", "Gilles", "Brecht"])).toBe(
      "Ciska, Gilles, Brecht",
    );
  });

  it("telt de rest in plaats van door te sommen", () => {
    expect(afwezigLabel(["Ciska", "Gilles", "Brecht", "Obe", "Davy"])).toBe(
      "Ciska, Gilles, Brecht +2",
    );
  });
});
