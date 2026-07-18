import { describe, it, expect } from "vitest";
import { buildMilestones } from "@/features/profiles/milestones";
import type { RatingPoint } from "@/types";

// Bouwt een oplopende rating-historie: elke match zet rating_after; de datum
// loopt per match één dag op vanaf 2026-01-01.
function history(afters: number[]): RatingPoint[] {
  let before = 1000;
  return afters.map((after, i) => {
    const point: RatingPoint = {
      match_id: `m-${i}`,
      rating_before: before,
      rating_after: after,
      delta: after - before,
      played_at: `2026-01-${String(i + 1).padStart(2, "0")}T18:00:00Z`,
    };
    before = after;
    return point;
  });
}

describe("buildMilestones", () => {
  it("geeft een lege lijst bij lege historie", () => {
    expect(buildMilestones([])).toEqual([]);
  });

  it("zet het debuut op de eerste match", () => {
    const ms = buildMilestones(history([1010, 1020]));
    expect(ms[0]).toMatchObject({ kind: "debuut", date: "2026-01-01T18:00:00Z" });
  });

  it("markeert de eerste passage van een Elo-drempel", () => {
    // Stijgt over 1100 bij match 3 (1105) en over 1200 bij match 5 (1205).
    const ms = buildMilestones(history([1040, 1080, 1105, 1150, 1205]));
    const elo = ms.filter((m) => m.kind === "elo");
    expect(elo.map((m) => `${m.value}@${m.date.slice(8, 10)}`)).toEqual([
      "1100@03",
      "1200@05",
    ]);
  });

  it("telt een drempel niet als de speler er niet onder begon", () => {
    // Twee matches, blijft onder 1100 → geen Elo-mijlpaal.
    const ms = buildMilestones(history([1030, 1050]));
    expect(ms.some((m) => m.kind === "elo")).toBe(false);
  });

  it("voegt match-tellers toe zodra het aantal gehaald is", () => {
    const afters = Array.from({ length: 10 }, (_, i) => 1000 + (i + 1));
    const ms = buildMilestones(history(afters));
    const teller = ms.find((m) => m.kind === "matches" && m.value === 10);
    expect(teller).toBeDefined();
    expect(teller?.date.slice(8, 10)).toBe("10");
    // Nog geen 25e match.
    expect(ms.some((m) => m.value === 25)).toBe(false);
  });

  it("sorteert alle mijlpalen chronologisch", () => {
    const afters = Array.from({ length: 12 }, (_, i) => 1000 + (i + 1) * 10);
    const ms = buildMilestones(history(afters));
    const dates = ms.map((m) => m.date);
    expect(dates).toEqual([...dates].sort());
  });
});
