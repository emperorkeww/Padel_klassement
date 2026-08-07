import { describe, expect, it } from "vitest";
import {
  banen,
  beschrijving,
  ctaLabel,
  klemRondes,
  reserves,
  rondes,
} from "./speelformaat";

describe("banen en reserves", () => {
  it("rekent vier spelers per baan", () => {
    expect(banen(8)).toBe(2);
    expect(reserves(8)).toBe(0);
  });

  it("zet de rest op de bank in plaats van er een halve baan van te maken", () => {
    expect(banen(6)).toBe(1);
    expect(reserves(6)).toBe(2);
  });

  // Het design rondt hier naar boven af (max(1, …)), maar de generator maakt
  // met minder dan vier spelers echt nul banen — en de knop staat dan uit.
  it("belooft geen baan die er niet komt", () => {
    expect(banen(3)).toBe(0);
    expect(banen(0)).toBe(0);
  });
});

describe("rondes", () => {
  it("volgt bij Americano de keuze van de gebruiker", () => {
    expect(rondes("americano", 1)).toBe(1);
    expect(rondes("americano", 7)).toBe(7);
  });

  // Sinds #1141 ook bij Eerlijk: elke ronde krijgt een eigen verdeling, dus
  // een hele avond in één tik herhaalt geen duo's.
  it("volgt de keuze ook bij Eerlijk", () => {
    expect(rondes("eerlijk", 7)).toBe(7);
  });

  it("is er één bij Mexicano, ongeacht de keuze", () => {
    expect(rondes("mexicano", 7)).toBe(1);
  });
});

describe("beschrijving", () => {
  it("noemt het aantal aanwezigen en de banen", () => {
    expect(beschrijving("eerlijk", 8)).toContain("8 aanwezige spelers");
    expect(beschrijving("eerlijk", 8)).toContain("2 banen");
  });

  it("schrijft één baan uit in plaats van '1 banen'", () => {
    expect(beschrijving("americano", 5)).toContain("één baan");
  });

  it("legt bij Mexicano de paring uit", () => {
    expect(beschrijving("mexicano", 8)).toContain("nummer 1 speelt met nummer 4");
  });
});

describe("ctaLabel", () => {
  it("noemt per vorm wat de knop doet", () => {
    expect(ctaLabel("eerlijk")).toBe("Stel eerlijke teams voor");
    expect(ctaLabel("americano")).toBe("Start Americano");
    expect(ctaLabel("mexicano")).toBe("Start Mexicano");
  });
});

describe("klemRondes", () => {
  it("houdt de waarde tussen één en tien", () => {
    expect(klemRondes(0)).toBe(1);
    expect(klemRondes(-3)).toBe(1);
    expect(klemRondes(5)).toBe(5);
    expect(klemRondes(99)).toBe(10);
  });

  // Een leeg invoerveld geeft Number("") === 0, en een gewiste NaN-waarde mag
  // de knop niet op "Start NaN Americano-rondes" zetten.
  it("valt terug op het minimum bij een onbruikbaar getal", () => {
    expect(klemRondes(Number.NaN)).toBe(1);
    expect(klemRondes(Number("")))
      .toBe(1);
  });
});

describe("ctaLabel met een aantal rondes", () => {
  it("noemt het aantal zodra het er meer dan één zijn", () => {
    expect(ctaLabel("americano", 1)).toBe("Start Americano");
    expect(ctaLabel("americano", 4)).toBe("Start 4 Americano-rondes");
  });

  // Eerlijk zet er sinds #1141 net zoveel klaar als Americano — elke ronde met
  // een eigen verdeling. Mexicano niet: die heeft de vorige uitslagen nodig.
  it("noemt het aantal ook bij Eerlijk", () => {
    expect(ctaLabel("eerlijk", 1)).toBe("Stel eerlijke teams voor");
    expect(ctaLabel("eerlijk", 4)).toBe("Stel 4 eerlijke rondes voor");
  });

  it("laat Mexicano ongemoeid", () => {
    expect(ctaLabel("mexicano", 4)).toBe("Start Mexicano");
  });
});
