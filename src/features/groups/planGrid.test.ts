import { describe, it, expect } from "vitest";
import { buildPlanGrid, bestPlanMoments, cellKey, isFeasible } from "./planGrid";
import type { CourtRow, DayAvailability, SlotOption, WeekDay } from "../availability/api";
import type { SlotVote } from "./planApi";

// Bouwt een baanrij: { "20:00": [60,90] } = vrij om 20:00 voor 60 én 90 min.
function court(name: string, free: Record<string, number[]>): CourtRow {
  const map = new Map<string, SlotOption[]>();
  for (const [t, durations] of Object.entries(free)) {
    map.set(
      t,
      durations.map((d) => ({ duration: d, price: "20 EUR", perPerson: "€ 5" })),
    );
  }
  return { court: { id: name, name, type: "" }, free: map };
}
function day(courts: CourtRow[]): DayAvailability {
  return { open: "08:00", close: "23:00", timeZone: "Europe/Brussels", courts };
}

// Verre datums zodat "vandaag" nooit meespeelt (deterministisch).
const D1 = "2099-07-13";
const D2 = "2099-07-14";

// D1: 18:00 → 1 baan, 20:00 → 4 banen. D2: 20:00 → 2 banen.
const week: WeekDay[] = [
  {
    date: D1,
    data: day([
      court("Terrein 1", { "18:00": [60, 90], "20:00": [60, 90] }),
      court("Terrein 2", { "20:00": [60, 90] }),
      court("Terrein 3", { "20:00": [60, 90] }),
      court("Terrein 4", { "20:00": [60, 90] }),
    ]),
    error: null,
  },
  {
    date: D2,
    data: day([
      court("Terrein 1", { "20:00": [60, 90] }),
      court("Terrein 2", { "20:00": [60, 90] }),
    ]),
    error: null,
  },
];

function vote(
  player: string,
  date: string,
  time: string,
  status: SlotVote["status"],
): SlotVote {
  return { group_id: "g", player_id: player, date, start_time: time, status, updated_at: "" };
}

describe("buildPlanGrid", () => {
  it("combineert vrije banen met de stemmen en berekent 'playable'", () => {
    const votes = [
      // D1 20:00: 4× kan → met 4 banen 1 speelbare baan.
      vote("p1", D1, "20:00", "yes"),
      vote("p2", D1, "20:00", "yes"),
      vote("p3", D1, "20:00", "yes"),
      vote("p4", D1, "20:00", "yes"),
      vote("p5", D1, "20:00", "maybe"),
      // D1 18:00: 3× kan, maar dat is < 4 → 0 speelbaar.
      vote("p1", D1, "18:00", "yes"),
      vote("p2", D1, "18:00", "yes"),
      vote("p3", D1, "18:00", "yes"),
      // Stem op een slot zonder vrije baan (D2 18:00) → genegeerd.
      vote("p1", D2, "18:00", "yes"),
    ];
    const grid = buildPlanGrid(week, votes, null);

    expect(grid.times).toEqual(["18:00", "20:00"]);
    const c2000 = grid.cells.get(cellKey(D1, "20:00"))!;
    expect(c2000.courtsFree).toBe(4);
    expect(c2000.yes).toHaveLength(4);
    expect(c2000.maybe).toEqual(["p5"]);
    expect(c2000.playable).toBe(1); // min(⌊4/4⌋, 4)
    expect(isFeasible(c2000)).toBe(true);

    const c1800 = grid.cells.get(cellKey(D1, "18:00"))!;
    expect(c1800.courtsFree).toBe(1);
    expect(c1800.yes).toHaveLength(3);
    expect(c1800.playable).toBe(0); // te weinig spelers
    expect(isFeasible(c1800)).toBe(false);

    // Stem op D2 18:00 telde niet mee (geen baan daar).
    expect(grid.cells.has(cellKey(D2, "18:00"))).toBe(false);
  });

  it("beperkt playable door het aantal banen (8 spelers, 2 banen → 2)", () => {
    const votes = Array.from({ length: 8 }, (_, i) =>
      vote(`p${i + 1}`, D2, "20:00", "yes"),
    );
    const grid = buildPlanGrid(week, votes, null);
    const c = grid.cells.get(cellKey(D2, "20:00"))!;
    expect(c.yes).toHaveLength(8);
    expect(c.courtsFree).toBe(2);
    expect(c.playable).toBe(2); // min(⌊8/4⌋=2, 2 banen)
  });
});

describe("bestPlanMoments", () => {
  it("rangschikt op speelbare banen, dan #kan, dan vroegst", () => {
    const votes = [
      // D1 20:00: 4 kan, 4 banen → playable 1.
      ...["p1", "p2", "p3", "p4"].map((p) => vote(p, D1, "20:00", "yes")),
      // D2 20:00: 8 kan, 2 banen → playable 2 (wint).
      ...Array.from({ length: 8 }, (_, i) => vote(`q${i}`, D2, "20:00", "yes")),
      // D1 18:00: 2 kan → playable 0 (laatst).
      vote("p1", D1, "18:00", "yes"),
      vote("p2", D1, "18:00", "yes"),
    ];
    const grid = buildPlanGrid(week, votes, null);
    const best = bestPlanMoments(grid, 3);
    expect(best.map((c) => `${c.date} ${c.time}`)).toEqual([
      `${D2} 20:00`, // playable 2
      `${D1} 20:00`, // playable 1
      `${D1} 18:00`, // playable 0, maar wel iemand die kan
    ]);
  });

  it("negeert slots waar niemand kan", () => {
    const grid = buildPlanGrid(week, [], null);
    expect(bestPlanMoments(grid)).toEqual([]);
  });
});
