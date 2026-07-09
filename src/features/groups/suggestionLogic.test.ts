import { describe, it, expect } from "vitest";
import {
  playedMoments,
  suggestMoments,
  weekdayOf,
  type CanSignal,
  type SuggestionSources,
} from "./suggestionLogic";
import type { WeekHeatmap } from "../availability/availabilityShare";

// 2026-07-10 is een vrijdag, 2026-07-11 een zaterdag.
const HEAT: WeekHeatmap = {
  times: ["19:00", "20:00"],
  days: [
    { date: "2026-07-10", counts: { "19:00": 1, "20:00": 3 }, error: null },
    { date: "2026-07-11", counts: { "20:00": 2 }, error: null },
  ],
};

const vote = (
  date: string,
  time: string,
  playerId: string,
  status: CanSignal["status"] = "yes",
): CanSignal => ({
  player_id: playerId,
  date,
  start_time: time,
  status,
});

const base: SuggestionSources = {
  heat: HEAT,
  slotVotes: [],
  history: [],
  pastPlayable: [],
  existing: [],
};

describe("suggestMoments", () => {
  it("suggereert per dag het beste slot, meeste banen eerst", () => {
    const s = suggestMoments(base);
    expect(s.map((x) => `${x.date} ${x.time}`)).toEqual([
      "2026-07-10 20:00", // 3 banen wint van 19:00 (1 baan) én van za (2)
      "2026-07-11 20:00",
    ]);
    expect(s[0].reasons).toContain("3 banen vrij");
  });

  it("weegt slot-stemmen van leden mee", () => {
    const s = suggestMoments({
      ...base,
      // Twee leden kunnen zaterdag om 20:00 → dat wint van vrijdag (3 banen).
      slotVotes: [
        vote("2026-07-11", "20:00", "p2"),
        vote("2026-07-11", "20:00", "p3"),
      ],
    });
    expect(`${s[0].date} ${s[0].time}`).toBe("2026-07-11 20:00");
    expect(s[0].reasons).toContain("2 leden kunnen dan");
  });

  it("weegt historiek (zelfde weekdag, ±1 uur) en eerdere volle voorstellen mee", () => {
    const vrijdag = weekdayOf("2026-07-10");
    const s = suggestMoments({
      ...base,
      history: [
        { weekday: vrijdag, hour: 20 },
        { weekday: vrijdag, hour: 21 }, // ±1 uur telt mee
        { weekday: (vrijdag + 1) % 7, hour: 20 }, // andere dag telt niet
      ],
      pastPlayable: [{ date: "2026-07-03", start_time: "20:00" }], // ook vrijdag
    });
    const top = s[0];
    expect(`${top.date} ${top.time}`).toBe("2026-07-10 20:00");
    expect(top.reasons).toContain("jullie speelden hier al 2 keer");
    expect(top.reasons).toContain("eerder voorstel hier raakte vol");
  });

  it("slaat al voorgestelde momenten over", () => {
    const s = suggestMoments({
      ...base,
      existing: [{ date: "2026-07-10", start_time: "20:00" }],
    });
    // Vrijdag valt terug op het overgebleven slot van 19:00.
    expect(s.map((x) => `${x.date} ${x.time}`)).toEqual([
      "2026-07-11 20:00",
      "2026-07-10 19:00",
    ]);
  });
});

describe("dagdeel-prior en leren van historiek", () => {
  it("verkiest een avonduur boven een lege ochtend", () => {
    const s = suggestMoments({
      ...base,
      heat: {
        times: ["09:00", "20:00"],
        days: [
          {
            date: "2026-07-10",
            counts: { "09:00": 4, "20:00": 1 }, // ochtend leger dan avond
            error: null,
          },
        ],
      },
    });
    // 09:00: min(4,3)=3 + prior(-2) = 1; 20:00: min(1,3)=1 + prior(2) = 3.
    expect(`${s[0].date} ${s[0].time}`).toBe("2026-07-10 20:00");
  });

  it("groeit met historiek naar de vaste uren van de groep toe", () => {
    const vrijdag = weekdayOf("2026-07-10");
    // Groep die structureel op vrijdagmiddag 14:00 speelt (4× gespeeld).
    const s = suggestMoments({
      ...base,
      heat: {
        times: ["14:00", "20:00"],
        days: [
          {
            date: "2026-07-10",
            counts: { "14:00": 2, "20:00": 2 },
            error: null,
          },
        ],
      },
      history: Array.from({ length: 4 }, () => ({ weekday: vrijdag, hour: 14 })),
    });
    // 14:00: 2 + 0 + min(8,8) = 10 verslaat 20:00: 2 + 2 = 4.
    expect(`${s[0].date} ${s[0].time}`).toBe("2026-07-10 14:00");
    expect(s[0].reasons).toContain("jullie speelden hier al 4 keer");
  });
});

describe("playedMoments", () => {
  it("zet ISO-tijdstippen om naar weekdag + uur in clubtijd", () => {
    // 18:30 UTC in juli = 20:30 in Brussel; 2026-07-03 is een vrijdag.
    const m = playedMoments(["2026-07-03T18:30:00.000Z"], "Europe/Brussels");
    expect(m).toEqual([{ weekday: 5, hour: 20 }]);
  });
});
