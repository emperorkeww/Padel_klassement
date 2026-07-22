import { describe, it, expect } from "vitest";
import { spelerVanDeWeek } from "./spelerVanDeWeek";
import type { RatingPoint } from "@/types";

const NU = new Date("2026-07-22T12:00:00Z");

/** RatingPoint op `dagenGeleden` dagen vóór NU met de gegeven delta. */
function punt(dagenGeleden: number, delta: number, after = 1000): RatingPoint {
  return {
    match_id: `m-${dagenGeleden}-${delta}`,
    rating_before: after - delta,
    rating_after: after,
    delta,
    played_at: new Date(
      NU.getTime() - dagenGeleden * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

describe("spelerVanDeWeek (#497)", () => {
  it("kiest de speler met de meeste Elo-winst in de laatste 7 dagen", () => {
    const uitkomst = spelerVanDeWeek(
      {
        p1: [punt(1, 12), punt(2, 10)],
        p2: [punt(1, 30), punt(3, 18)],
      },
      NU,
    );
    expect(uitkomst).toEqual({ playerId: "p2", delta: 48, matches: 2 });
  });

  it("telt matches buiten het 7-daagse venster niet mee", () => {
    const uitkomst = spelerVanDeWeek(
      {
        // Grote winst, maar 8+ dagen oud → alleen de verse matches tellen.
        p1: [punt(8, 90), punt(1, 5), punt(2, 6)],
        p2: [punt(1, 8), punt(2, 1)],
      },
      NU,
    );
    expect(uitkomst).toEqual({ playerId: "p1", delta: 11, matches: 2 });
  });

  it("vereist minstens 2 matches in het venster", () => {
    const uitkomst = spelerVanDeWeek(
      {
        p1: [punt(1, 40)],
        p2: [punt(1, 4), punt(2, 4)],
      },
      NU,
    );
    // p1 heeft de grootste winst maar maar één match — p2 wint.
    expect(uitkomst?.playerId).toBe("p2");
  });

  it("geeft null als niemand een positieve week draait", () => {
    expect(
      spelerVanDeWeek(
        {
          p1: [punt(1, -6), punt(2, -3)],
          p2: [punt(1, 2), punt(2, -8)],
        },
        NU,
      ),
    ).toBeNull();
  });

  it("breekt een gelijke winst op de hoogste rating na de laatste match", () => {
    const uitkomst = spelerVanDeWeek(
      {
        p1: [punt(1, 10, 1100), punt(2, 10, 1090)],
        p2: [punt(1, 10, 1300), punt(2, 10, 1290)],
      },
      NU,
    );
    expect(uitkomst?.playerId).toBe("p2");
  });

  it("geeft null zonder histories", () => {
    expect(spelerVanDeWeek({}, NU)).toBeNull();
  });
});
