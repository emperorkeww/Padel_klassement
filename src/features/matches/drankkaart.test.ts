import { describe, it, expect } from "vitest";
import {
  BIEREN,
  DRANKEN,
  FRISDRANKEN,
  drankIcon,
  drankInfo,
  drankLabel,
  traktatieOpen,
  traktatieRegel,
  traktatieTekst,
  zoekDranken,
} from "@/features/matches/drankkaart";
import { MATCH_DONE, MATCH_PLANNED } from "@/test/fixtures";
import type { Match } from "@/types";

const gepland = MATCH_PLANNED as unknown as Match;
const gespeeld = MATCH_DONE as unknown as Match;

describe("drankkaart — de preset (#1004)", () => {
  it("bevat de 25 bieren en 10 frisdranken uit de issue", () => {
    expect(BIEREN).toHaveLength(25);
    expect(FRISDRANKEN).toHaveLength(10);
    expect(DRANKEN).toHaveLength(35);
  });

  it("heeft unieke slugs die de databank-check overleven", () => {
    const slugs = DRANKEN.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    // Spiegel van matches_wager_drink_slug in tables/05_matches.sql.
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it("geeft label en icoon terug, en degradeert een onbekende slug", () => {
    expect(drankLabel("tripel-karmeliet")).toBe("Tripel Karmeliet");
    expect(drankIcon("tripel-karmeliet")).not.toBe("");
    expect(drankInfo("tripel-karmeliet")?.soort).toBe("bier");
    // Een slug die van de kaart gehaald is mag niets breken.
    expect(drankLabel("verdwenen-brouwsel")).toBe("verdwenen-brouwsel");
    expect(drankIcon("verdwenen-brouwsel")).toBe("🥂");
    expect(drankInfo("verdwenen-brouwsel")).toBeNull();
    expect(drankLabel(null)).toBe("");
  });

  it("zoekt hoofdletter-ongevoelig op label én slug", () => {
    expect(zoekDranken("karmeliet").map((d) => d.slug)).toEqual([
      "tripel-karmeliet",
    ]);
    expect(zoekDranken("KARMELIET")).toHaveLength(1);
    expect(zoekDranken("red-bull").map((d) => d.slug)).toEqual(["red-bull"]);
    expect(zoekDranken("")).toHaveLength(35);
    expect(zoekDranken("cava")).toHaveLength(0);
  });
});

describe("traktatieTekst — het onderwerp van de weddenschap", () => {
  it("noemt aantal en drankje per winnaar", () => {
    expect(traktatieTekst("duvel", 2)).toBe("2× Duvel per winnaar");
  });

  it("valt terug op 1 bij een ontbrekend of onzinnig aantal", () => {
    expect(traktatieTekst("duvel", null)).toBe("1× Duvel per winnaar");
    expect(traktatieTekst("duvel", 0)).toBe("1× Duvel per winnaar");
  });

  it("is leeg zonder drankje", () => {
    expect(traktatieTekst(null, 3)).toBe("");
  });
});

describe("traktatieRegel — de stand van zaken (#1004)", () => {
  it("zwijgt wanneer er nergens om gespeeld wordt", () => {
    expect(traktatieRegel(gepland)).toBeNull();
  });

  it("toont de inzet op een geplande match", () => {
    const m = { ...gepland, wager_drink: "duvel", wager_drink_qty: 1 };
    expect(traktatieRegel(m)).toContain("Inzet: 1× Duvel per winnaar");
  });

  it("noemt de openstaande rekening na een gewonnen match", () => {
    const m = { ...gespeeld, wager_drink: "duvel", wager_drink_qty: 2 };
    expect(traktatieRegel(m)).toContain("Nog te betalen: 2× Duvel per winnaar");
  });

  it("meldt een ingeloste traktatie", () => {
    const m = {
      ...gespeeld,
      wager_drink: "duvel",
      wager_drink_qty: 1,
      wager_settled_at: "2026-08-01T22:00:00.000Z",
    };
    expect(traktatieRegel(m)).toContain("Traktatie ingelost");
  });

  it("laat de inzet vervallen bij een afgelaste match", () => {
    const m = {
      ...gepland,
      status: "cancelled" as const,
      wager_drink: "duvel",
      wager_drink_qty: 1,
    };
    expect(traktatieRegel(m)).toContain("vervallen");
  });

  it("laat de inzet vervallen bij gelijkspel", () => {
    const m = {
      ...gespeeld,
      winner_team_id: null,
      wager_drink: "duvel",
      wager_drink_qty: 1,
    };
    expect(traktatieRegel(m)).toContain("vervallen");
  });
});

describe("traktatieOpen — mag de knop 'Traktatie ingelost' verschijnen?", () => {
  it("ja: afgerond, winnaar, nog niet afgevinkt", () => {
    expect(
      traktatieOpen({ ...gespeeld, wager_drink: "duvel" }),
    ).toBe(true);
  });

  it("nee zonder drankje, vóór de match, bij gelijkspel of als het al betaald is", () => {
    expect(traktatieOpen(gespeeld)).toBe(false);
    expect(traktatieOpen({ ...gepland, wager_drink: "duvel" })).toBe(false);
    expect(
      traktatieOpen({ ...gespeeld, wager_drink: "duvel", winner_team_id: null }),
    ).toBe(false);
    expect(
      traktatieOpen({
        ...gespeeld,
        wager_drink: "duvel",
        wager_settled_at: "2026-08-01T22:00:00.000Z",
      }),
    ).toBe(false);
  });
});
