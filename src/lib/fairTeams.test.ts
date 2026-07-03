import { describe, it, expect } from "vitest";
import { fairTeams } from "./fairTeams";
import type { PlayerRating } from "./types";

const NOW = "2026-07-02T10:00:00.000Z";

function ratings(entries: Record<string, number>): Record<string, PlayerRating> {
  return Object.fromEntries(
    Object.entries(entries).map(([player_id, rating]) => [
      player_id,
      { player_id, rating, games: 1, updated_at: NOW },
    ]),
  );
}

describe("fairTeams", () => {
  it("splitst 4 spelers zo dat het teamratingverschil minimaal is", () => {
    const r = ratings({ a: 1200, b: 1100, c: 1000, d: 900 });
    const { courts, reserves } = fairTeams(["a", "b", "c", "d"], r);

    expect(reserves).toEqual([]);
    expect(courts).toHaveLength(1);
    // Eerlijkst: sterkste + zwakste (1200+900) tegen de middenmoot (1100+1000).
    expect(courts[0].teamA.playerIds).toEqual(["a", "d"]);
    expect(courts[0].teamB.playerIds).toEqual(["b", "c"]);
    expect(courts[0].teamA.rating).toBe(1050);
    expect(courts[0].teamB.rating).toBe(1050);
    expect(courts[0].chanceA).toBeCloseTo(0.5);
  });

  it("kiest met variant 1 de op één na eerlijkste splitsing", () => {
    const r = ratings({ a: 1200, b: 1100, c: 1000, d: 900 });
    const { courts } = fairTeams(["a", "b", "c", "d"], r, 1);

    // Op één na eerlijkst: {a,c} (1100) tegen {b,d} (1000).
    expect(courts[0].teamA.playerIds).toEqual(["a", "c"]);
    expect(courts[0].teamB.playerIds).toEqual(["b", "d"]);
    expect(courts[0].chanceA).toBeGreaterThan(0.5);
  });

  it("verdeelt 8 spelers over 2 banen: sterkste viertal samen op baan 1", () => {
    const r = ratings({
      a: 1300, b: 1250, c: 1200, d: 1150,
      e: 1000, f: 950, g: 900, h: 850,
    });
    const { courts, reserves } = fairTeams(
      ["e", "a", "g", "c", "h", "b", "d", "f"],
      r,
    );

    expect(reserves).toEqual([]);
    expect(courts).toHaveLength(2);
    const baan1 = [...courts[0].teamA.playerIds, ...courts[0].teamB.playerIds];
    const baan2 = [...courts[1].teamA.playerIds, ...courts[1].teamB.playerIds];
    expect(baan1.sort()).toEqual(["a", "b", "c", "d"]);
    expect(baan2.sort()).toEqual(["e", "f", "g", "h"]);
  });

  it("zet bij 5 spelers de laagst gerankte apart als reserve", () => {
    const r = ratings({ a: 1200, b: 1100, c: 1000, d: 900, e: 800 });
    const { courts, reserves } = fairTeams(["e", "a", "b", "c", "d"], r);

    expect(courts).toHaveLength(1);
    expect(reserves).toEqual(["e"]);
  });

  it("geeft spelers zonder rating de startrating van 1000", () => {
    const r = ratings({ hoog: 1100, laag: 900 });
    const { courts } = fairTeams(["x", "hoog", "y", "laag"], r);

    // Eerlijkst: 1100+900 (gemiddeld 1000) tegen de twee ongerate spelers.
    expect(courts[0].teamA.playerIds).toEqual(["hoog", "laag"]);
    expect(courts[0].teamB.playerIds.sort()).toEqual(["x", "y"]);
    expect(courts[0].teamB.rating).toBe(1000);
    expect(courts[0].chanceA).toBeCloseTo(0.5);
  });

  it("geeft niets terug bij lege input en enkel reserves onder de 4 spelers", () => {
    expect(fairTeams([], {})).toEqual({ courts: [], reserves: [] });

    const r = ratings({ a: 1100, b: 1000, c: 900 });
    const { courts, reserves } = fairTeams(["b", "c", "a"], r);
    expect(courts).toEqual([]);
    expect(reserves).toEqual(["a", "b", "c"]);
  });
});
