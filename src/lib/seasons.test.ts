import { describe, it, expect } from "vitest";
import {
  isSeasonClosed,
  listSeasons,
  parseSeasonId,
  seasonFor,
  seasonFromId,
} from "./seasons";

describe("parseSeasonId", () => {
  it("aanvaardt geldige ids", () => {
    expect(parseSeasonId("2026-q1")).toEqual({ year: 2026, quarter: 1 });
    expect(parseSeasonId("1999-q4")).toEqual({ year: 1999, quarter: 4 });
  });

  it("weigert ongeldige ids", () => {
    for (const bad of [
      "",
      "onzin",
      "2026-q0",
      "2026-q5",
      "2026-Q3", // hoofdletter telt niet: de app schrijft altijd kleine letters
      "26-q1",
      "2026q3",
      "2026-q33",
    ]) {
      expect(parseSeasonId(bad)).toBeNull();
    }
  });
});

describe("seasonFromId", () => {
  it("geeft label en grenzen (start inclusief, einde exclusief)", () => {
    const s = seasonFromId("2026-q3")!;
    expect(s.label).toBe("Q3 2026");
    expect(s.start.getTime()).toBe(new Date(2026, 6, 1).getTime());
    expect(s.end.getTime()).toBe(new Date(2026, 9, 1).getTime());
  });

  it("laat Q4 eindigen op 1 januari van het volgende jaar", () => {
    const s = seasonFromId("2025-q4")!;
    expect(s.start.getTime()).toBe(new Date(2025, 9, 1).getTime());
    expect(s.end.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });

  it("geeft null voor een ongeldig id", () => {
    expect(seasonFromId("2026-q7")).toBeNull();
    expect(seasonFromId("gisteren")).toBeNull();
  });
});

describe("seasonFor", () => {
  it("kent randdatums aan het juiste kwartaal toe", () => {
    expect(seasonFor(new Date(2026, 0, 1)).id).toBe("2026-q1");
    expect(seasonFor(new Date(2026, 2, 31, 23, 59)).id).toBe("2026-q1");
    expect(seasonFor(new Date(2026, 3, 1)).id).toBe("2026-q2");
    expect(seasonFor(new Date(2025, 11, 31)).id).toBe("2025-q4");
    expect(seasonFor(new Date(2026, 6, 3)).id).toBe("2026-q3");
  });
});

describe("listSeasons", () => {
  it("geeft alle kwartalen van eerste datum tot nu, nieuwste eerst", () => {
    const list = listSeasons(new Date(2025, 10, 15), new Date(2026, 6, 3));
    expect(list.map((s) => s.id)).toEqual([
      "2026-q3",
      "2026-q2",
      "2026-q1",
      "2025-q4",
    ]);
  });

  it("geeft één kwartaal als beide datums erin vallen", () => {
    const list = listSeasons(new Date(2026, 6, 1), new Date(2026, 8, 30));
    expect(list.map((s) => s.id)).toEqual(["2026-q3"]);
  });

  it("geeft niets als de startdatum na nu ligt", () => {
    expect(listSeasons(new Date(2027, 0, 1), new Date(2026, 6, 3))).toEqual([]);
  });
});

describe("isSeasonClosed", () => {
  const q2 = seasonFromId("2026-q2")!;

  it("is afgesloten vanaf de eerste tel van het volgende kwartaal", () => {
    expect(isSeasonClosed(q2, new Date(2026, 6, 1))).toBe(true);
    expect(isSeasonClosed(q2, new Date(2026, 6, 3))).toBe(true);
  });

  it("loopt nog tot en met de laatste tel van het kwartaal", () => {
    expect(isSeasonClosed(q2, new Date(2026, 5, 30, 23, 59, 59))).toBe(false);
    expect(isSeasonClosed(q2, new Date(2026, 3, 1))).toBe(false);
  });
});
