import { describe, it, expect } from "vitest";
import { ONFIRE_DREMPEL, onFireDoorbraken, onFireSpelers } from "./onFire";
import type { RatingPoint } from "@/types";

/** RatingPoint met alleen de velden die de helper leest; oud → nieuw op dag. */
const punt = (dag: number, delta: number): RatingPoint => ({
  match_id: `m${dag}`,
  rating_before: 1000,
  rating_after: 1000 + delta,
  delta,
  played_at: `2026-07-${String(dag).padStart(2, "0")}T19:00:00Z`,
});

/** n winsten op rij als recentste punten, met optioneel een staart ervoor. */
const reeks = (n: number, staart: number[] = []): RatingPoint[] => [
  ...staart.map((d, i) => punt(i + 1, d)),
  ...Array.from({ length: n }, (_, i) => punt(10 + i, 8)),
];

describe("onFireSpelers (#632)", () => {
  it("telt de actieve delta>0-reeks terug vanaf de recentste match", () => {
    expect(onFireSpelers({ p1: reeks(6, [-4]) })).toEqual({ p1: 6 });
  });

  it("hanteert de drempel: één te weinig is geen editie", () => {
    expect(onFireSpelers({ p1: reeks(ONFIRE_DREMPEL - 1) })).toEqual({});
    expect(onFireSpelers({ p1: reeks(ONFIRE_DREMPEL) })).toEqual({
      p1: ONFIRE_DREMPEL,
    });
  });

  it("breekt de reeks op elke delta ≤ 0, ook een gelijkspel-min", () => {
    // 5 winsten, maar de recentste match is een (klein) verlies → geen reeks.
    expect(onFireSpelers({ p1: [...reeks(5), punt(28, -0.5)] })).toEqual({});
    // Delta 0 breekt ook.
    expect(onFireSpelers({ p1: [...reeks(5), punt(28, 0)] })).toEqual({});
  });

  it("rekent niet op gesorteerde input", () => {
    const geschud = [...reeks(5, [-4])].reverse();
    expect(onFireSpelers({ p1: geschud })).toEqual({ p1: 5 });
  });

  it("kan meerdere dragers tegelijk hebben — anders dan de andere edities", () => {
    const dragers = onFireSpelers({
      p1: reeks(5),
      p2: reeks(7, [-2]),
      p3: reeks(2),
    });
    expect(dragers).toEqual({ p1: 5, p2: 7 });
  });

  it("geeft leeg terug zonder histories of zonder punten", () => {
    expect(onFireSpelers({})).toEqual({});
    expect(onFireSpelers({ p1: [] })).toEqual({});
  });
});

describe("onFireDoorbraken (#986)", () => {
  it("wijst de match aan waarin de reeks de drempel haalde", () => {
    // reeks(5) loopt over dag 10..14; de 5e zege valt op dag 14.
    expect(onFireDoorbraken({ p1: reeks(5) })).toEqual([
      {
        playerId: "p1",
        matchId: "m14",
        at: punt(14, 8).played_at,
        streak: ONFIRE_DREMPEL,
      },
    ]);
  });

  it("blijft op dezelfde match staan als de reeks doorgroeit", () => {
    // Dat is de hele reden dat het item aan de doorbraak hangt: zonder dat zou
    // elke volgende zege een tweede item bovenaan de feed zetten.
    const bij5 = onFireDoorbraken({ p1: reeks(5) })[0];
    const bij8 = onFireDoorbraken({ p1: reeks(8) })[0];
    expect(bij8.matchId).toBe(bij5.matchId);
    expect(bij8.at).toBe(bij5.at);
    // En het getal beschrijft dat moment, niet de reeks van nu.
    expect(bij8.streak).toBe(ONFIRE_DREMPEL);
  });

  it("zwijgt onder de drempel en na een onderbroken reeks", () => {
    expect(onFireDoorbraken({ p1: reeks(ONFIRE_DREMPEL - 1) })).toEqual([]);
    expect(onFireDoorbraken({ p1: [...reeks(6), punt(28, -3)] })).toEqual([]);
  });

  it("rekent niet op gesorteerde input", () => {
    const geschud = [...reeks(6, [-4])].reverse();
    expect(onFireDoorbraken({ p1: geschud })[0].matchId).toBe("m14");
  });

  it("levert één regel per drager", () => {
    const uit = onFireDoorbraken({ p1: reeks(5), p2: reeks(9), p3: reeks(2) });
    expect(uit.map((d) => d.playerId).sort()).toEqual(["p1", "p2"]);
  });
});
