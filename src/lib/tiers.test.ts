import { describe, it, expect } from "vitest";
import {
  tierChange,
  tierFor,
  tierTitle,
  tierProgress,
  tierLegend,
} from "./tiers";

describe("tierFor", () => {
  it.each([
    // Ludieke tiers onder Brons (open naar beneden).
    [400, "Slof III"],
    [533, "Slof III"],
    [534, "Slof II"],
    [599, "Slof I"],
    [600, "Karton III"],
    [700, "Hout III"],
    [799, "Hout I"],
    // Bestaande banden (vanaf 800) — ongewijzigd.
    [800, "Brons III"],
    [833, "Brons III"],
    [834, "Brons II"],
    [899, "Brons I"],
    [900, "Zilver III"],
    [999, "Zilver I"],
    [1000, "Goud III"],
    [1099, "Goud I"],
    [1100, "Platina III"],
    [1199, "Platina I"],
    // Nieuwe hoge tiers.
    [1200, "Diamant III"],
    [1299, "Diamant I"],
    [1300, "Meester III"],
    [1399, "Meester I"],
    [1400, "Legende"],
    [1600, "Legende"],
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

  it("alleen de hoogste tier (Legende) heeft geen sub-niveaus", () => {
    expect(tierFor(1400)?.sub).toBeNull();
    expect(tierFor(1600)?.sub).toBeNull();
    // Diamant is nu begrensd en heeft dus wél sub-niveaus.
    expect(tierFor(1200)?.sub).toBe(3);
  });

  it("draagt emoji en ludieke bijnaam", () => {
    expect(tierFor(1000)?.emoji).toBe("🥇");
    expect(tierFor(1000)?.flavor).toBe("goudhaantje");
    expect(tierFor(450)?.emoji).toBe("🩴");
  });

  it("rang stijgt strikt over de hele schaal", () => {
    const ratings = [
      450, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400,
    ];
    const rangen = ratings.map((r) => tierFor(r)!.rang);
    for (let i = 1; i < rangen.length; i++) {
      expect(rangen[i]).toBeGreaterThan(rangen[i - 1]);
    }
  });
});

describe("tierTitle", () => {
  it("bevat de bijnaam en het rating-bereik", () => {
    expect(tierTitle(tierFor(450)!)).toBe("Slof III · op je slippers · rating tot 533");
    expect(tierTitle(tierFor(1040)!)).toBe("Goud II · goudhaantje · rating 1034–1066");
    expect(tierTitle(tierFor(1500)!)).toBe("Legende · levende legende · rating 1400+");
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

  it("promotie over de nieuwe onderste grens (Hout → Brons)", () => {
    const w = tierChange(790, 810)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.naam).toBe("Hout");
    expect(w.naar.label).toBe("Brons III");
  });

  it("promotie naar de hoogste tier (Meester → Legende)", () => {
    const w = tierChange(1399, 1400)!;
    expect(w.richting).toBe("promotie");
    expect(w.naar.label).toBe("Legende");
  });

  it("degradatie", () => {
    const w = tierChange(1100, 1095)!;
    expect(w.richting).toBe("degradatie");
    expect(w.naar.label).toBe("Goud I");
  });

  it("null-inputs geven null", () => {
    expect(tierChange(null, 1100)).toBeNull();
    expect(tierChange(1100, null)).toBeNull();
  });
});

describe("tierProgress", () => {
  it("berekent de punten tot de volgende hoofd-divisie", () => {
    const p = tierProgress(1045)!;
    expect(p.huidig.naam).toBe("Goud");
    expect(p.volgende?.naam).toBe("Platina");
    expect(p.volgende?.vanaf).toBe(1100);
    expect(p.puntenNodig).toBe(55);
  });

  it("op een banddrempel is de volle 100 nodig", () => {
    expect(tierProgress(1000)?.puntenNodig).toBe(100);
  });

  it("in de hoogste tier is er geen volgende", () => {
    const p = tierProgress(1500)!;
    expect(p.volgende).toBeNull();
    expect(p.puntenNodig).toBeNull();
  });

  it("null zonder rating", () => {
    expect(tierProgress(null)).toBeNull();
  });
});

describe("tierLegend", () => {
  it("somt alle tiers op van hoog naar laag met instapdrempel", () => {
    const legend = tierLegend();
    expect(legend).toHaveLength(10);
    expect(legend[0].naam).toBe("Legende");
    expect(legend[0].vanaf).toBe(1400);
    // De laagste tier heeft geen instapdrempel.
    const laagste = legend[legend.length - 1];
    expect(laagste.naam).toBe("Slof");
    expect(laagste.vanaf).toBeNull();
    // Elke tier draagt emoji + bijnaam.
    expect(legend.every((l) => l.emoji && l.flavor)).toBe(true);
  });
});
