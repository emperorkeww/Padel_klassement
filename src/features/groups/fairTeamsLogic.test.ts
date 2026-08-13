import { describe, it, expect } from "vitest";
import { fairTeams } from "@/features/groups/fairTeamsLogic";
import type { PlayerRating } from "@/types";

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

describe("andere verdeling (#1271)", () => {
  // Acht spelers = twee volle banen en geen reserves. Precies het geval waarin
  // "Andere verdeling" niets deed: `variant` koos alleen een andere
  // 2-2-splitsing bínnen een viertal, dus je speelde elke ronde tegen dezelfde
  // drie mensen.
  const ACHT = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const R = ratings({
    a: 1400, b: 1300, c: 1200, d: 1100,
    e: 1000, f: 900, g: 800, h: 700,
  });

  /** Wie deelt met wie een baan, als sets per baan. */
  const banen = (variant: number) =>
    fairTeams(ACHT, R, variant).courts.map((c) =>
      [...c.teamA.playerIds, ...c.teamB.playerIds].sort().join(","),
    );

  it("zet bij variant 0 de sterksten bij elkaar", () => {
    expect(banen(0)).toEqual(["a,b,c,d", "e,f,g,h"]);
  });

  it("wisselt spelers over de baangrens bij een volgende verdeling", () => {
    expect(banen(1)).not.toEqual(banen(0));
    expect(banen(2)).not.toEqual(banen(1));
    expect(banen(3)).not.toEqual(banen(2));
  });

  it("houdt de banen op rating bij elkaar", () => {
    // De ruil begint bij de spelers die qua rating het dichtst bij de grens
    // zitten, dus de sterkste en de zwakste komen nooit samen op één baan.
    for (const v of [1, 2, 3]) {
      const samen = banen(v).find((baan) => baan.includes("a"));
      expect(samen).not.toContain("h");
    }
  });

  it("komt na vier verdelingen weer bij het begin uit", () => {
    expect(banen(4)).toEqual(banen(0));
  });

  it("laat één baan met rust — daar valt niets te wisselen", () => {
    const vier = ["a", "b", "c", "d"];
    const een = fairTeams(vier, R, 0).courts[0];
    const twee = fairTeams(vier, R, 1).courts[0];
    // Dezelfde vier mensen, maar wél een andere teamindeling.
    expect(
      [...twee.teamA.playerIds, ...twee.teamB.playerIds].sort(),
    ).toEqual(["a", "b", "c", "d"]);
    expect(twee.teamA.playerIds).not.toEqual(een.teamA.playerIds);
  });
});
