import { describe, it, expect } from "vitest";
import { setsWaarschuwing, setsWinnaar } from "./setsCheck";
import type { SetScore } from "./api";

const waarschuwing = (
  sets: SetScore[],
  scoreA: number | null,
  scoreB: number | null,
) =>
  setsWaarschuwing({
    sets,
    scoreA,
    scoreB,
    labelA: "Alice & Bob",
    labelB: "Carol & Dave",
  });

describe("setsWinnaar", () => {
  it("telt gewonnen sets, niet games", () => {
    // A pakt set 1 en 3 met samen minder games dan B in set 2 — toch wint A.
    expect(
      setsWinnaar([
        [6, 4],
        [0, 6],
        [7, 5],
      ]),
    ).toBe("a");
  });

  it("geeft null bij een gelijk aantal sets", () => {
    expect(
      setsWinnaar([
        [6, 4],
        [3, 6],
      ]),
    ).toBeNull();
  });

  it("negeert een gelijk gespeelde set", () => {
    expect(
      setsWinnaar([
        [6, 6],
        [6, 4],
      ]),
    ).toBe("a");
  });

  it("geeft null zonder sets", () => {
    expect(setsWinnaar([])).toBeNull();
  });
});

describe("setsWaarschuwing", () => {
  it("zwijgt als sets en eindstand dezelfde winnaar aanwijzen", () => {
    expect(waarschuwing([[6, 4]], 6, 4)).toBeNull();
  });

  it("zwijgt wanneer de cijfers een ander totaal zijn dan de sets", () => {
    // De ene groep logt de games van één set, de andere het totaal over alle
    // sets. Beide conventies zijn geldig, dus hier mag niets afgaan.
    expect(
      waarschuwing(
        [
          [6, 4],
          [3, 6],
          [6, 2],
        ],
        15,
        12,
      ),
    ).toBeNull();
    expect(
      waarschuwing(
        [
          [6, 4],
          [3, 6],
          [6, 2],
        ],
        2,
        1,
      ),
    ).toBeNull();
  });

  it("waarschuwt als de sets de andere kant op wijzen", () => {
    const melding = waarschuwing(
      [
        [6, 4],
        [3, 6],
        [6, 2],
      ],
      4,
      6,
    );
    expect(melding).toContain("Alice & Bob");
    expect(melding).toContain("Carol & Dave");
  });

  it("waarschuwt als de sets een winnaar geven maar de eindstand gelijk is", () => {
    expect(waarschuwing([[6, 4]], 5, 5)).toContain("gelijk");
  });

  it("zwijgt bij een gelijk aantal sets, wat de eindstand ook zegt", () => {
    // 1-1 in sets doet geen uitspraak; de eindstand mag dan alles zijn.
    expect(
      waarschuwing(
        [
          [6, 4],
          [3, 6],
        ],
        4,
        6,
      ),
    ).toBeNull();
  });

  it("zwijgt zonder sets of zonder eindstand", () => {
    expect(waarschuwing([], 6, 4)).toBeNull();
    expect(waarschuwing([[6, 4]], null, null)).toBeNull();
    expect(waarschuwing([[6, 4]], 6, null)).toBeNull();
  });
});
