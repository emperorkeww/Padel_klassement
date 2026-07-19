import { describe, it, expect } from "vitest";
import { splitDictatorThrone } from "./leaderboardHelpers";

// Compacte rijen — de nieuwe splitDictatorThrone (#545) kiest de troon op `key`
// (de server-side bepaalde troonhouder), niet meer op de rating-snapshot.
const row = (key: string, rating: number | null) => ({ key, rating });

describe("splitDictatorThrone (#528 + machtsbehoud #545)", () => {
  it("tilt de aangewezen dictator uit de lijst; het volk begint bij #2", () => {
    const rows = [
      row("dictator", 1687),
      row("a", 1543),
      row("b", 1498),
      row("c", 1471),
    ];
    const { throne, rest } = splitDictatorThrone(rows, "dictator");
    expect(throne?.key).toBe("dictator");
    expect(rest.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });

  it("kiest de troonhouder op key, óók als hij niet bovenaan staat", () => {
    // Machtsbehoud: de zittende dictator kan (tijdelijk) lager staan dan een
    // 1600+-uitdager die hem nog niet stríkt verslagen heeft.
    const rows = [row("uitdager", 1620), row("zittend", 1610), row("c", 1400)];
    const { throne, rest } = splitDictatorThrone(rows, "zittend");
    expect(throne?.key).toBe("zittend");
    expect(rest.map((r) => r.key)).toEqual(["uitdager", "c"]);
  });

  it("geeft geen troon als er niemand regeert (vacante troon → null)", () => {
    const rows = [row("a", 1650), row("b", 1498)];
    const { throne, rest } = splitDictatorThrone(rows, null);
    expect(throne).toBeNull();
    expect(rest).toHaveLength(2);
  });

  it("geeft geen troon als de dictator niet in de (gefilterde) lijst staat", () => {
    const rows = [row("a", 1543), row("b", 1498)];
    const { throne, rest } = splitDictatorThrone(rows, "iemand-anders");
    expect(throne).toBeNull();
    expect(rest.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("werkt met een lege lijst", () => {
    expect(splitDictatorThrone([], "x").throne).toBeNull();
    expect(splitDictatorThrone([], null).rest).toEqual([]);
  });
});
