import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { tierFor } from "@/features/rating/tiers";
import { GlazenwasserKaart } from "./GlazenwasserKaart";
import {
  GW_LAGEN,
  laagVensterStijl,
  naarKaartH,
  naarKaartY,
} from "./glazenwasserLayout";
import { glazenwasserStats } from "./glazenwasserStats";

const BRON = {
  gespeeld: 42,
  gewonnen: 26,
  gelijk: 4,
  verloren: 12,
  punten: 82,
  saldo: 38,
  rang: 3,
  vorm: ["W", "W", "L", "W", "W"] as const,
};

const kaart = (naam = "Papapadel") => (
  <GlazenwasserKaart
    elo={1150}
    tier={tierFor(1150)}
    naam={naam}
    avatar={<span>PA</span>}
    stats={glazenwasserStats(BRON)}
  />
);

describe("Glazenwasser-layout", () => {
  it("plaatst elke laag met een echte maat binnen bereik van de kaart", () => {
    for (const laag of GW_LAGEN) {
      const [left, top, breedte, hoogte] = laag.doel;
      expect(breedte, `${laag.naam} heeft geen breedte`).toBeGreaterThan(0);
      expect(hoogte, `${laag.naam} heeft geen hoogte`).toBeGreaterThan(0);
      // Buiten de kaart hangen mag — crest, trekker, emmer en water horen over de
      // lijst heen — maar niet zó ver dat een onderdeel het beeld uit loopt.
      expect(left, `${laag.naam} staat links buiten beeld`).toBeGreaterThan(-0.25);
      expect(left + breedte, `${laag.naam} loopt rechts uit beeld`).toBeLessThan(
        1.25,
      );
      expect(top, `${laag.naam} staat boven beeld`).toBeGreaterThan(-0.25);
    }
  });

  it("laat het onderschild dezelfde afbeelding volgen als de ring", () => {
    // De waterexplosie zat als eigen laag op een afwijkend anker, samen met het
    // onderschild dat erin ligt. Sinds het water in de ring zit, is de ring de
    // baas over die hoogte: hij is in het assetscript met exact dezelfde
    // stuksgewijze afbeelding herbemonsterd. Een eigen anker op het onderschild
    // zou het 1,8% kaarthoogte boven zijn eigen plas leggen.
    const schild = GW_LAGEN.find((l) => l.naam === "bottomShield");
    expect(schild, "onderschild ontbreekt").toBeDefined();
    expect(schild?.ankerY, "onderschild hoort geen eigen anker te hebben")
      .toBeUndefined();
    expect(GW_LAGEN.some((l) => l.naam === "bottomWater")).toBe(false);
    expect(GW_LAGEN.some((l) => l.naam === "bottomSqueegee")).toBe(false);
  });

  it("rekent de ring niet twee keer om", () => {
    // De ring staat al in kaartfracties; `laagVensterStijl` mag hem dus niet nóg
    // een keer door `naarKaartY` halen.
    const ringLaag = GW_LAGEN.find((l) => l.naam === "cardRing");
    expect(ringLaag?.voorbewerkt, "ring mist de voorbewerkt-vlag").toBe(true);
    const stijl = laagVensterStijl(ringLaag!) as unknown as Record<string, string>;
    expect(stijl.top).toBe(`${ringLaag!.doel[1] * 100}%`);
  });

  it("verdeelt de extra kaarthoogte in plaats van hem uit te rekken", () => {
    // Boven blijft aan de bovenrand hangen, onder aan de onderrand, en het midden
    // houdt zijn relatieve hoogte.
    expect(naarKaartY(0.05)).toBeLessThan(0.05);
    expect(naarKaartY(0.5)).toBeCloseTo(0.5, 3);
    expect(naarKaartY(0.95)).toBeGreaterThan(0.95);
    // Een maat krimpt altijd met dezelfde factor: artwork blijft in verhouding.
    expect(naarKaartH(0.2) / 0.2).toBeCloseTo(naarKaartH(0.5) / 0.5, 6);
  });
});

describe("Glazenwasser-statistieken", () => {
  it("levert zes kolommen met echte cijfers", () => {
    const stats = glazenwasserStats(BRON);
    expect(stats).toHaveLength(6);
    expect(stats.map((s) => s.waarde)).toEqual([
      "42",
      "62%",
      "82",
      "#3",
      "+38",
      "4/5",
    ]);
    for (const s of stats) expect(s.uitleg.length).toBeGreaterThan(4);
  });

  it("valt terug op streepjes zonder gespeelde matches", () => {
    const leeg = glazenwasserStats({
      gespeeld: 0,
      gewonnen: 0,
      gelijk: 0,
      verloren: 0,
      punten: 0,
      saldo: 0,
      rang: null,
      vorm: [],
    });
    expect(leeg.every((s) => s.waarde === "—")).toBe(true);
  });
});

describe("Glazenwasser-kaart", () => {
  it("toont rating, naam, divisie en alle zes statistieken", () => {
    render(kaart());

    expect(screen.getByText("1150")).toBeInTheDocument();
    expect(screen.getByText("Papapadel")).toBeInTheDocument();
    expect(screen.getByText("Glazenwasser II")).toBeInTheDocument();
    expect(screen.getByText("Concentratie")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("tekent elke artworklaag als eigen onderdeel", () => {
    const { container } = render(kaart());

    const lagen = [...container.querySelectorAll<HTMLElement>(".gw-kaart__laag")];
    expect(lagen).toHaveLength(GW_LAGEN.length);
    // Elk onderdeel is een eigen asset: dezelfde bron twee keer betekent dat een
    // laag naar zijn buurman wijst.
    const bronnen = lagen.map((l) => l.querySelector("img")?.getAttribute("src"));
    expect(new Set(bronnen).size).toBe(lagen.length);
    for (const laag of lagen) expect(laag).toHaveAttribute("aria-hidden", "true");
  });
});
