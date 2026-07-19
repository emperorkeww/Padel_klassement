import { describe, it, expect } from "vitest";
import {
  tierChange,
  tierFor,
  tierTitle,
  tierProgress,
  tierLegend,
  zelfdeDivisie,
} from "@/features/rating/tiers";

describe("tierFor", () => {
  it.each([
    // Ludieke tiers onder Bankvuller (open naar beneden).
    [400, "Sletje van de baan III"],
    [533, "Sletje van de baan III"],
    [534, "Sletje van de baan II"],
    [599, "Sletje van de baan I"],
    [600, "Toerist III"],
    [700, "Prutser III"],
    [799, "Prutser I"],
    // Bestaande banden (vanaf 800) — ongewijzigd.
    [800, "Bankvuller III"],
    [833, "Bankvuller III"],
    [834, "Bankvuller II"],
    [899, "Bankvuller I"],
    [900, "Blaaskaak III"],
    [999, "Blaaskaak I"],
    [1000, "Wannabe III"],
    [1100, "Glazenwasser III"],
    [1199, "Glazenwasser I"],
    // Nieuwe hoge tiers.
    [1200, "Racketconsument III"],
    [1299, "Racketconsument I"],
    [1300, "Forever second III"],
    [1399, "Forever second I"],
    // GOAT is nu begrensd (1400–1599) en heeft dus sub-niveaus.
    [1400, "GOAT III"],
    [1466, "GOAT III"],
    [1467, "GOAT II"],
    [1534, "GOAT I"],
    [1599, "GOAT I"],
    // El Padelissimo is de nieuwe open-top divisie zonder sub-niveaus.
    [1600, "El Padelissimo"],
    [1700, "El Padelissimo"],
  ])("rating %i → %s", (rating, label) => {
    expect(tierFor(rating)?.label).toBe(label);
  });

  it("geeft null voor een speler zonder rating", () => {
    expect(tierFor(null)).toBeNull();
  });

  it("start (1000) is Wannabe III", () => {
    const t = tierFor(1000)!;
    expect(t.naam).toBe("Wannabe");
    expect(t.sub).toBe(3);
  });

  it("alleen de hoogste tier (El Padelissimo) heeft geen sub-niveaus", () => {
    expect(tierFor(1600)?.sub).toBeNull();
    expect(tierFor(1700)?.sub).toBeNull();
    // GOAT is nu begrensd (1400–1599) en heeft dus wél sub-niveaus.
    expect(tierFor(1400)?.sub).toBe(3);
    expect(tierFor(1200)?.sub).toBe(3);
  });

  it("draagt emoji en ludieke bijnaam", () => {
    expect(tierFor(1000)?.emoji).toBe("😤");
    expect(tierFor(1000)?.flavor).toBe("koopt een racket van €350 om het chronische gebrek aan talent te compenseren");
    expect(tierFor(450)?.emoji).toBe("🥴");
  });

  it("rang stijgt strikt over de hele schaal", () => {
    const ratings = [
      450, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1600,
    ];
    const rangen = ratings.map((r) => tierFor(r)!.rang);
    for (let i = 1; i < rangen.length; i++) {
      expect(rangen[i]).toBeGreaterThan(rangen[i - 1]);
    }
  });
});

describe("tierTitle", () => {
  it("bevat de bijnaam en het rating-bereik", () => {
    expect(tierTitle(tierFor(450)!)).toBe("Sletje van de baan III · wordt door de rest van de club gebruikt voor makkelijke gratis winst · rating tot 533");
    expect(tierTitle(tierFor(1040)!)).toBe("Wannabe II · koopt een racket van €350 om het chronische gebrek aan talent te compenseren · rating 1034–1066");
    expect(tierTitle(tierFor(1500)!)).toBe("GOAT II · heeft een ego dat zo reusachtig groot is dat het niet eens in de kooi past · rating 1467–1533");
    expect(tierTitle(tierFor(1650)!)).toBe("El Padelissimo · regeert de club als absolute dictator, weert tegenstanders per direct uit de groepsapp en eist 90% van de baromzet · rating 1600+");
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
    expect(w.naar.label).toBe("Wannabe II");
  });

  it("hoofdtier-promotie", () => {
    const w = tierChange(1095, 1105)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.label).toBe("Wannabe I");
    expect(w.naar.label).toBe("Glazenwasser III");
  });

  it("promotie over de nieuwe onderste grens (Prutser → Bankvuller)", () => {
    const w = tierChange(790, 810)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.naam).toBe("Prutser");
    expect(w.naar.label).toBe("Bankvuller III");
  });

  it("promotie naar GOAT (Forever second → GOAT III)", () => {
    const w = tierChange(1399, 1400)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.naar.label).toBe("GOAT III");
  });

  it("promotie naar de hoogste tier (GOAT → El Padelissimo)", () => {
    const w = tierChange(1599, 1600)!;
    expect(w.richting).toBe("promotie");
    expect(w.hoofdtier).toBe(true);
    expect(w.van.naam).toBe("GOAT");
    expect(w.naar.label).toBe("El Padelissimo");
    expect(w.naar.key).toBe("dictator");
  });

  it("degradatie", () => {
    const w = tierChange(1100, 1095)!;
    expect(w.richting).toBe("degradatie");
    expect(w.naar.label).toBe("Wannabe I");
  });

  it("null-inputs geven null", () => {
    expect(tierChange(null, 1100)).toBeNull();
    expect(tierChange(1100, null)).toBeNull();
  });
});

describe("tierProgress", () => {
  it("berekent de punten tot de volgende hoofd-divisie", () => {
    const p = tierProgress(1045)!;
    expect(p.huidig.naam).toBe("Wannabe");
    expect(p.volgende?.naam).toBe("Glazenwasser");
    expect(p.volgende?.vanaf).toBe(1100);
    expect(p.puntenNodig).toBe(55);
  });

  it("op een banddrempel is de volle 100 nodig", () => {
    expect(tierProgress(1000)?.puntenNodig).toBe(100);
  });

  it("GOAT klimt nog naar El Padelissimo", () => {
    const p = tierProgress(1500)!;
    expect(p.huidig.naam).toBe("GOAT");
    expect(p.volgende?.naam).toBe("El Padelissimo");
    expect(p.volgende?.vanaf).toBe(1600);
    expect(p.puntenNodig).toBe(100);
  });

  it("in de hoogste tier (El Padelissimo) is er geen volgende", () => {
    const p = tierProgress(1650)!;
    expect(p.huidig.naam).toBe("El Padelissimo");
    expect(p.volgende).toBeNull();
    expect(p.puntenNodig).toBeNull();
  });

  it("null zonder rating", () => {
    expect(tierProgress(null)).toBeNull();
  });
});

describe("zelfdeDivisie", () => {
  it("geeft de gedeelde band als iedereen in dezelfde hoofddivisie zit", () => {
    // Verschillende sub-niveaus (Wannabe III t/m I) blijven één divisie.
    const band = zelfdeDivisie([1000, 1040, 1099, 1010])!;
    expect(band.naam).toBe("Wannabe");
    expect(band.emoji).toBe("😤");
  });

  it("null zodra één speler in een andere divisie zit", () => {
    expect(zelfdeDivisie([1000, 1040, 1099, 1100])).toBeNull();
  });

  it("null zodra één rating ontbreekt", () => {
    expect(zelfdeDivisie([1000, null, 1040, 1010])).toBeNull();
    expect(zelfdeDivisie([])).toBeNull();
  });

  it("werkt in de open top (El Padelissimo) en de bodem", () => {
    expect(zelfdeDivisie([1600, 1750])?.naam).toBe("El Padelissimo");
    // GOAT is nu begrensd maar blijft één divisie over zijn sub-niveaus heen.
    expect(zelfdeDivisie([1400, 1599])?.naam).toBe("GOAT");
    // Een GOAT en een El Padelissimo zitten niet in dezelfde divisie.
    expect(zelfdeDivisie([1500, 1600])).toBeNull();
    expect(zelfdeDivisie([400, 599])?.naam).toBe("Sletje van de baan");
  });
});

describe("tierLegend", () => {
  it("somt alle tiers op van hoog naar laag met instapdrempel", () => {
    const legend = tierLegend();
    expect(legend).toHaveLength(11);
    expect(legend[0].naam).toBe("El Padelissimo");
    expect(legend[0].vanaf).toBe(1600);
    expect(legend[0].range).toBe("1600+");
    // GOAT staat nu op de tweede plek, begrensd.
    expect(legend[1].naam).toBe("GOAT");
    expect(legend[1].vanaf).toBe(1400);
    // De laagste tier heeft geen instapdrempel.
    const laagste = legend[legend.length - 1];
    expect(laagste.naam).toBe("Sletje van de baan");
    expect(laagste.vanaf).toBeNull();
    // Elke tier draagt emoji + bijnaam.
    expect(legend.every((l) => l.emoji && l.flavor)).toBe(true);
  });
});
