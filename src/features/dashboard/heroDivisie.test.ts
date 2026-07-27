import { describe, expect, it } from "vitest";
import { heroBasis, heroBasisKlassen } from "./heroDivisie";
import { divisieKaart } from "@/features/rating/components/divisies";
import { tierFor, type TierKey } from "@/features/rating/tiers";

// Eén rating midden in elke band, zodat élke divisie langskomt (zelfde truc als
// de kaart-showcase). De laatste twee zijn de toptiers zonder register.
const RATINGS: ReadonlyArray<readonly [number, TierKey]> = [
  [550, "slof"],
  [650, "karton"],
  [750, "hout"],
  [850, "brons"],
  [950, "zilver"],
  [1050, "goud"],
  [1150, "platina"],
  [1250, "diamant"],
  [1350, "meester"],
  [1450, "legende"],
];

describe("heroBasis (#771)", () => {
  it("laat de kaart neutraal zonder rating", () => {
    // Nooit gespeeld: geen divisie om te tonen, dus de oude neutrale kaart.
    expect(heroBasis(null)).toBeNull();
  });

  it("geeft elke divisie zijn eigen basis", () => {
    for (const [rating, key] of RATINGS) {
      const basis = heroBasis(rating);
      expect(basis, `rating ${rating}`).not.toBeNull();
      expect(basis!.key).toBe(key);
    }
  });

  it("haalt de kleuren uit het register van de divisiekaart, niet uit een tweede palet", () => {
    // De kern van de aanpak (#710/#771): één bron voor kaart, poster én
    // dashboard. Zou hier een eigen hex staan, dan drijft het dashboard weg
    // zodra een divisie hertint wordt.
    for (const [rating, key] of RATINGS) {
      const reg = divisieKaart(key)?.register;
      if (!reg) continue;
      const stijl = heroBasis(rating)!.stijl as Record<string, string>;
      expect(stijl["--hero-div-lijn"]).toBe(reg.lijn);
      expect(stijl["--hero-div-gloed"]).toBe(reg.glow);
      expect(stijl["--hero-div-was"]).toBe(reg.vlak[0]);
      expect(stijl["--hero-div-hoog"]).toBe(reg.frame[0][1]);
    }
  });

  it("neemt het divisiemotief over als watermerk", () => {
    for (const [rating, key] of RATINGS) {
      const motief = divisieKaart(key)?.motief;
      const basis = heroBasis(rating)!;
      if (!motief) {
        expect(basis.watermerk, `${key} heeft geen motief`).toBeNull();
        continue;
      }
      expect(basis.watermerk?.paden).toBe(motief.paden);
      expect(basis.watermerk?.kleur).toBe(motief.kleur);
    }
  });

  it("geeft de twee toptiers hun premium glans in plaats van een register", () => {
    // GOAT en El Padelissimo staan op de generieke metaalladder (#710) maar
    // hebben wél een glansvariant (#773).
    expect(heroBasis(1450)).toMatchObject({ key: "legende", glans: "goat" });
    // De El-Padelissimo-tier is voorbehouden aan de troonhouder (#545): zonder
    // troon klemt tierForWeergave naar GOAT, precies zoals de badge ernaast.
    expect(heroBasis(1650)).toMatchObject({ key: "legende", glans: "goat" });
    expect(heroBasis(1650, { isDictator: true })).toMatchObject({
      key: "dictator",
      glans: "dictator",
    });
  });

  it("geeft de negen divisies géén glans", () => {
    for (const [rating, key] of RATINGS) {
      if (key === "legende" || key === "dictator") continue;
      expect(heroBasis(rating)!.glans).toBeNull();
    }
  });

  it("wijkt voor een permanent thema: dat neemt het materiaal over", () => {
    // Stap 4 van de laagvolgorde ligt boven stap 3, dus de divisielaag zou
    // onzichtbaar zijn. Geen lege DOM-lagen dan.
    for (const thema of ["dictator", "bigdaddy", "kampioen", "pias", "piet"] as const)
      expect(heroBasis(950, { permanent: thema })).toBeNull();
    expect(heroBasis(950, { permanent: null })).not.toBeNull();
  });

  it("volgt dezelfde tier als de divisiebadge in de kop", () => {
    // Anders zegt de kaart iets anders dan het chipje ernaast.
    for (const rating of [512, 999, 1000, 1399]) {
      expect(heroBasis(rating)!.key).toBe(tierFor(rating)!.key);
    }
  });
});

describe("heroBasisKlassen (#771)", () => {
  it("noemt de divisie zodat de CSS erop kan haken", () => {
    expect(heroBasisKlassen(heroBasis(950))).toEqual([
      "hero--divisie",
      "hero--div-zilver",
    ]);
  });

  it("zet de glansvariant erbij voor een toptier", () => {
    expect(heroBasisKlassen(heroBasis(1450))).toEqual([
      "hero--divisie",
      "hero--div-legende",
      "hero--glans-goat",
    ]);
  });

  it("geeft niets terug zonder basis", () => {
    expect(heroBasisKlassen(null)).toEqual([]);
  });
});
