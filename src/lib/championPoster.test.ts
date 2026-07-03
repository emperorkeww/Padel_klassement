import { describe, it, expect } from "vitest";
import { championPoster } from "./championPoster";

const ROWS = [
  { name: "Carol Claes", points: 9 },
  { name: "Dave Dubois", points: 6 },
  { name: "Alice Anders", points: 3 },
  { name: "Bob Bakker", points: 0 },
];

describe("championPoster", () => {
  it("bouwt seizoenslabel, kampioen en podium-top-3 op", () => {
    const p = championPoster("Q2 2026", ROWS);
    expect(p).not.toBeNull();
    expect(p?.seasonLabel).toBe("Q2 2026");
    expect(p?.champion).toBe("Carol Claes");
    // Alleen de top 3, in volgorde, met plaats en punten.
    expect(p?.podium).toEqual([
      { place: 1, name: "Carol Claes", points: 9 },
      { place: 2, name: "Dave Dubois", points: 6 },
      { place: 3, name: "Alice Anders", points: 3 },
    ]);
  });

  it("maakt het podium korter bij minder dan drie spelers", () => {
    const p = championPoster("Q1 2026", ROWS.slice(0, 2));
    expect(p?.podium).toHaveLength(2);
    expect(p?.podium[1]).toEqual({ place: 2, name: "Dave Dubois", points: 6 });
  });

  it("geeft null zonder spelers", () => {
    expect(championPoster("Q1 2026", [])).toBeNull();
  });
});
