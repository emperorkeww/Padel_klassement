import { describe, it, expect } from "vitest";
import { coachAvond, type AvondCtx } from "./coachEvening";
import type { EveningSummary, EveningRow } from "../../lib/eveningSummary";
import type { Profile } from "@/types";

const row = (over: Partial<EveningRow> & { playerId: string }): EveningRow => ({
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  points: 0,
  goalDiff: 0,
  ...over,
});

const summary = (over: Partial<EveningSummary> = {}): EveningSummary => ({
  matches: [],
  rows: [],
  bestDuo: null,
  biggestUpset: null,
  ...over,
});

const ctx = (over: Partial<AvondCtx> = {}): AvondCtx => ({
  intensiteit: "gemeen",
  profiles: {},
  naam: (id) => id,
  ...over,
});

describe("coachAvond", () => {
  it("geeft niets terug zonder spelers", () => {
    expect(coachAvond(summary(), "g1|2026-07-01", ctx())).toEqual([]);
  });

  it("hypet de held van de avond", () => {
    const s = summary({ rows: [row({ playerId: "p1", won: 3, played: 3 })] });
    const uit = coachAvond(s, "g1|2026-07-01", ctx());
    expect(uit[0]).toContain("p1");
    expect(uit[0]).toMatch(/winst/);
  });

  it("sneert de afgang van de avond, en respecteert het schild", () => {
    const rows = [
      row({ playerId: "p1", won: 2, played: 2 }),
      row({ playerId: "p3", won: 0, lost: 2, played: 2 }),
    ];
    const zonderSchild = coachAvond(summary({ rows }), "g1|d", ctx());
    // Tweede regel gaat over de afgang p3, met een sneer (streepje).
    expect(zonderSchild.some((l) => l.includes("p3") && l.includes("—"))).toBe(true);

    const metSchild = coachAvond(
      summary({ rows }),
      "g1|d",
      ctx({ profiles: { p3: { roast_schild: true } as Profile } }),
    );
    const afgangregel = metSchild.find((l) => l.includes("p3"));
    expect(afgangregel).toBeTruthy();
    expect(afgangregel).not.toContain("—"); // schild → enkel het feit
  });

  it("meldt een upset als cijfer-observatie", () => {
    const s = summary({
      rows: [row({ playerId: "p1", won: 1, played: 1 })],
      biggestUpset: { winnerTeamId: "t1", chance: 0.18, matchId: "m1" },
    });
    const uit = coachAvond(s, "g1|d", ctx());
    expect(uit.some((l) => l.includes("18%"))).toBe(true);
  });

  it("is deterministisch op de seed", () => {
    const s = summary({
      rows: [
        row({ playerId: "p1", won: 2, played: 2 }),
        row({ playerId: "p3", won: 0, lost: 2, played: 2 }),
      ],
      matches: [{} as never, {} as never],
    });
    expect(coachAvond(s, "g1|d", ctx())).toEqual(coachAvond(s, "g1|d", ctx()));
  });
});
