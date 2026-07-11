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
    // Ludieke tiers onder Muurbloempje (open naar beneden).
    [400, "Kneus III"],
    [533, "Kneus III"],
    [534, "Kneus II"],
    [599, "Kneus I"],
    [600, "Pylon III"],
    [700, "Luchtmepper III"],
    [799, "Luchtmepper I"],
    // Bestaande banden (vanaf 800) — ongewijzigd.
    [800, "Muurbloempje III"],
    [833, "Muurbloempje III"],
    [834, "Muurbloempje II"],
    [899, "Muurbloempje I"],
    [900, "Terrastijger III"],
    [999, "Terrastijger I"],
    [1000, "Bink III"],
    [1099, "Bink I"],
    [1100, "Netbeul III"],
    [1199, "Netbeul I"],
    // Nieuwe hoge tiers.
    [1200, "Haai III"],
    [1299, "Haai I"],
    [1300, "Padelbaas III"],
    [1399, "Padelbaas I"],
    [1400, "GOAT"],
    [1600, "GOAT"],
  ])("rating %i → %s", (rating, label) => {
    expect(tierFor(rating)?.label).toBe(label);
  });

  it("geeft null voor een speler zonder rating", () => {
    expect(tierFor(null)).toBeNull();
  });

  it("start (1000) is Bink III", () => {
    const t = tierFor(1000)!;
    expect(t.naam).toBe("Bink");
    expect(t.sub).toBe(3);
  });

  it("alleen de hoogste tier (GOAT) heeft geen sub-niveaus", () => {
    expect(tierFor(1400)?.sub).toBeNull();
    expect(tierFor(1600)?.sub).toBeNull();
    // Haai is nu begrensd en heeft dus wél sub-niveaus.
    expect(tierFor(1200)?.sub).toBe(3);
  });

  it("draagt emoji en ludieke bijnaam", () => {
    expect(tierFor(1000)?.emoji).toBe("😎");
    expect(tierFor(1000)?.flavor).toBe("begint het gevaarlijk te geloven");
    expect(tierFor(450)?.emoji).toBe("🩹");
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
    expect(tierTitle(tierFor(450)!)).toBe("Kneus III · meer blessure dan speler · rating tot 533");
    expect(tierTitle(tierFor(1040)!)).toBe("Bink II · begint het gevaarlijk te geloven · rating 1034–1066");
    expect(tierTitle(tierFor(1500)!)).toBe("GOAT · onaantastbaar — en dat weet iedereen · rating 1400+");
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
    expect(w.naar.label).toBe("Bink II");
  });

  it("hoofdtier-promotie", () => {
    const w = tierChange(1095, 1105)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.label).toBe("Bink I");
    expect(w.naar.label).toBe("Netbeul III");
  });

  it("promotie over de nieuwe onderste grens (Luchtmepper → Muurbloempje)", () => {
    const w = tierChange(790, 810)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.naam).toBe("Luchtmepper");
    expect(w.naar.label).toBe("Muurbloempje III");
  });

  it("promotie naar de hoogste tier (Padelbaas → GOAT)", () => {
    const w = tierChange(1399, 1400)!;
    expect(w.richting).toBe("promotie");
    expect(w.naar.label).toBe("GOAT");
  });

  it("degradatie", () => {
    const w = tierChange(1100, 1095)!;
    expect(w.richting).toBe("degradatie");
    expect(w.naar.label).toBe("Bink I");
  });

  it("null-inputs geven null", () => {
    expect(tierChange(null, 1100)).toBeNull();
    expect(tierChange(1100, null)).toBeNull();
  });
});

describe("tierProgress", () => {
  it("berekent de punten tot de volgende hoofd-divisie", () => {
    const p = tierProgress(1045)!;
    expect(p.huidig.naam).toBe("Bink");
    expect(p.volgende?.naam).toBe("Netbeul");
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
    expect(legend[0].naam).toBe("GOAT");
    expect(legend[0].vanaf).toBe(1400);
    // De laagste tier heeft geen instapdrempel.
    const laagste = legend[legend.length - 1];
    expect(laagste.naam).toBe("Kneus");
    expect(laagste.vanaf).toBeNull();
    // Elke tier draagt emoji + bijnaam.
    expect(legend.every((l) => l.emoji && l.flavor)).toBe(true);
  });
});
