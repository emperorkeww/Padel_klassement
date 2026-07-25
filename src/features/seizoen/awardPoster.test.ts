import { describe, it, expect } from "vitest";
import { awardPoster, rijHoogte } from "@/features/seizoen/awardPoster";
import type { Award } from "@/features/seizoen/awards";

const NAMEN: Record<string, string> = { a: "Alice Aerts", c: "Carol Claes" };
const naam = (id: string) => NAMEN[id] ?? "Onbekend";

const award = (over: Partial<Award> = {}): Award => ({
  id: "reeks",
  emoji: "🔥",
  titel: "Langste reeks",
  playerId: "a",
  waarde: 4,
  detail: "4 overwinningen op rij",
  ...over,
});

const poster = (awards: Award[]) =>
  awardPoster({
    groepsnaam: "De Radioactieve Rakkers",
    seizoen: "☀️ Zomer 2026",
    awards,
    naam,
  });

describe("awardPoster", () => {
  it("geeft null zonder awards, zodat de deelknop wegvalt", () => {
    expect(poster([])).toBeNull();
  });

  it("zet naam, titel en detail per rij klaar", () => {
    const p = poster([award()])!;
    expect(p).toMatchObject({
      groepsnaam: "De Radioactieve Rakkers",
      seizoen: "☀️ Zomer 2026",
    });
    expect(p.rijen).toEqual([
      {
        emoji: "🔥",
        titel: "Langste reeks",
        naam: "Alice Aerts",
        detail: "4 overwinningen op rij",
        schande: false,
      },
    ]);
  });

  it("markeert alleen de pias als schande", () => {
    const p = poster([
      award(),
      award({ id: "pias", emoji: "🤡", titel: "Pias van het seizoen", playerId: "c" }),
    ])!;
    expect(p.rijen.map((r) => r.schande)).toEqual([false, true]);
    expect(p.rijen[1].naam).toBe("Carol Claes");
  });

  it("houdt de volgorde van de awards aan", () => {
    const p = poster([
      award({ id: "scherpschutter", titel: "Scherpschutter" }),
      award({ id: "kraker", titel: "Koning van de kraker" }),
    ])!;
    expect(p.rijen.map((r) => r.titel)).toEqual([
      "Scherpschutter",
      "Koning van de kraker",
    ]);
  });
});

describe("rijHoogte", () => {
  it("laat acht awards binnen de poster passen", () => {
    for (let n = 1; n <= 8; n++) {
      const h = rijHoogte(n);
      const stapel = n * h + 14 * (n - 1); // MIN_GAP tussen de rijen
      expect(stapel, `${n} awards`).toBeLessThanOrEqual(1240 - 272);
    }
  });

  it("rekt één award niet uit tot een reus", () => {
    expect(rijHoogte(1)).toBe(150);
    expect(rijHoogte(3)).toBe(150);
  });

  it("krimpt mee met het aantal awards, maar niet onder de leesbare bodem", () => {
    expect(rijHoogte(8)).toBeLessThan(rijHoogte(5));
    expect(rijHoogte(8)).toBeGreaterThanOrEqual(92);
    expect(rijHoogte(20)).toBe(92);
  });
});
