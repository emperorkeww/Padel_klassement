import { describe, it, expect } from "vitest";
import { tierChange, tierFor, tierTitle } from "./tiers";

describe("tierFor", () => {
  it.each([
    // Alle bandranden: min inclusief, max exclusief.
    [700, "Brons III"],
    [833, "Brons III"],
    [834, "Brons II"],
    [866, "Brons II"],
    [867, "Brons I"],
    [899, "Brons I"],
    [900, "Zilver III"],
    [933, "Zilver III"],
    [934, "Zilver II"],
    [966, "Zilver II"],
    [967, "Zilver I"],
    [999, "Zilver I"],
    [1000, "Goud III"],
    [1033, "Goud III"],
    [1034, "Goud II"],
    [1066, "Goud II"],
    [1067, "Goud I"],
    [1099, "Goud I"],
    [1100, "Platina III"],
    [1133, "Platina III"],
    [1134, "Platina II"],
    [1166, "Platina II"],
    [1167, "Platina I"],
    [1199, "Platina I"],
    [1200, "Diamant"],
    [1450, "Diamant"],
  ])("rating %i → %s", (rating, label) => {
    expect(tierFor(rating)?.label).toBe(label);
  });

  it("geeft null voor een speler zonder rating", () => {
    expect(tierFor(null)).toBeNull();
  });

  it("start (1000) is Goud III", () => {
    const t = tierFor(1000)!;
    expect(t.naam).toBe("Goud");
    expect(t.sub).toBe(3);
  });

  it("Diamant heeft geen sub-niveaus", () => {
    expect(tierFor(1200)?.sub).toBeNull();
    expect(tierFor(1500)?.sub).toBeNull();
  });

  it("rang stijgt strikt over de hele schaal", () => {
    const ratings = [700, 834, 867, 900, 934, 967, 1000, 1034, 1067, 1100, 1134, 1167, 1200];
    const rangen = ratings.map((r) => tierFor(r)!.rang);
    for (let i = 1; i < rangen.length; i++) {
      expect(rangen[i]).toBeGreaterThan(rangen[i - 1]);
    }
  });
});

describe("tierTitle", () => {
  it("toont de drie grensvormen: open omlaag, gesloten band, open omhoog", () => {
    expect(tierTitle(tierFor(700)!)).toBe("Brons III · rating tot 833");
    expect(tierTitle(tierFor(1040)!)).toBe("Goud II · rating 1034–1066");
    expect(tierTitle(tierFor(1300)!)).toBe("Diamant · rating 1200+");
  });
});

describe("tierChange", () => {
  it("geen wissel binnen hetzelfde sub-niveau", () => {
    expect(tierChange(1000, 1010)).toBeNull();
  });

  it("sub-promotie binnen dezelfde hoofdtier", () => {
    const w = tierChange(1030, 1040)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(false);
    expect(w.naar.label).toBe("Goud II");
  });

  it("hoofdtier-promotie", () => {
    const w = tierChange(1095, 1105)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.label).toBe("Goud I");
    expect(w.naar.label).toBe("Platina III");
  });

  it("degradatie", () => {
    const w = tierChange(1100, 1095)!;
    expect(w.richting).toBe("degradatie");
    expect(w.hoofdtier).toBe(true);
    expect(w.naar.label).toBe("Goud I");
  });

  it("sprong over meerdere tiers", () => {
    const w = tierChange(950, 1150)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.naam).toBe("Zilver");
    expect(w.naar.label).toBe("Platina II");
  });

  it("exact op de Diamant-grens", () => {
    const w = tierChange(1199, 1200)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.naar.label).toBe("Diamant");
  });

  it("null-inputs geven null", () => {
    expect(tierChange(null, 1100)).toBeNull();
    expect(tierChange(1100, null)).toBeNull();
    expect(tierChange(null, null)).toBeNull();
  });
});
