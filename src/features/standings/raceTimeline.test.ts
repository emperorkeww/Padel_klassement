import { describe, expect, it } from "vitest";
import type { Row } from "./leaderboardHelpers";
import {
  buildRaceTimeline,
  calculateRankingMovement,
  MAX_TIMELINE_DAYS,
} from "./raceTimeline";

const punt = (day: string, rating_before: number, rating_after: number) => ({
  match_id: `m-${day}-${rating_after}`,
  rating_before,
  rating_after,
  delta: rating_after - rating_before,
  played_at: `${day}T20:00:00Z`,
});

const row = (key: string, rating: number | null, options: Partial<Row> = {}): Row => ({
  key,
  rating,
  rank: Number(key.replace(/\D/g, "")) || 1,
  isMe: false,
  name: key,
  profile: null,
  played: 10,
  won: 5,
  drawn: 0,
  lost: 5,
  points: 15,
  goalDiff: 0,
  games: 10,
  history: [],
  form: [],
  ...options,
});

describe("buildRaceTimeline", () => {
  it("bouwt een startframe plus één frame per speeldag, met carry-forward", () => {
    const rows = [
      row("p1", 1035, {
        history: [punt("2026-08-01", 990, 1020), punt("2026-08-05", 1020, 1035)],
      }),
      row("p2", 995, { history: [punt("2026-08-01", 1000, 995)] }),
    ];
    const timeline = buildRaceTimeline(rows);
    expect(timeline?.frames.map((f) => f.day)).toEqual([
      null,
      "2026-08-01",
      "2026-08-05",
    ]);
    const [start, dag1, dag2] = timeline!.frames;
    expect(start.ratings.get("p1")).toBe(990);
    expect(start.ratings.get("p2")).toBe(1000);
    expect(start.ranks.get("p2")).toBe(1);
    expect(dag1.ratings.get("p1")).toBe(1020);
    expect(dag1.ranks.get("p1")).toBe(1);
    // p2 speelde niet op 5 augustus: zijn rating loopt gewoon door.
    expect(dag2.ratings.get("p2")).toBe(995);
    expect(dag2.ratings.get("p1")).toBe(1035);
  });

  it("benoemt de grootste stijger per frame als verhaallijn", () => {
    const rows = [
      row("p1", 1035, {
        history: [punt("2026-08-01", 990, 1020), punt("2026-08-05", 1020, 1035)],
      }),
      row("p2", 995, { history: [punt("2026-08-01", 1000, 995)] }),
    ];
    const timeline = buildRaceTimeline(rows);
    expect(timeline?.frames[1].riser).toEqual({ key: "p1", from: 2, to: 1 });
    expect(timeline?.frames[2].riser).toBeNull();
  });

  it("dimt een debutant tot zijn eerste speeldag", () => {
    const rows = [
      row("p1", 1030, {
        history: [punt("2026-08-01", 1010, 1020), punt("2026-08-05", 1020, 1030)],
      }),
      row("p3", 1010, { history: [punt("2026-08-05", 1000, 1010)] }),
    ];
    const timeline = buildRaceTimeline(rows);
    const [start, dag1, dag2] = timeline!.frames;
    expect(start.debuted.has("p3")).toBe(false);
    expect(dag1.debuted.has("p3")).toBe(false);
    expect(dag2.debuted.has("p3")).toBe(true);
    // Tot dan staat hij stil op zijn startwaarde — geen verzonnen beweging.
    expect(start.ratings.get("p3")).toBe(1000);
    expect(dag1.ratings.get("p3")).toBe(1000);
  });

  it("laat een speler zonder recente historie constant en ongedimd meedoen", () => {
    const rows = [
      row("p1", 1020, { history: [punt("2026-08-01", 990, 1020)] }),
      row("p2", 1000),
    ];
    const timeline = buildRaceTimeline(rows);
    for (const frame of timeline!.frames) {
      expect(frame.ratings.get("p2")).toBe(1000);
      expect(frame.debuted.has("p2")).toBe(true);
    }
  });

  it("kapt de film op de laatste tien speeldagen", () => {
    const dagen = Array.from(
      { length: MAX_TIMELINE_DAYS + 2 },
      (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`,
    );
    const history = dagen.map((dag, i) => punt(dag, 1000 + i * 5, 1005 + i * 5));
    const timeline = buildRaceTimeline([
      row("p1", 1005 + (dagen.length - 1) * 5, { history }),
    ]);
    expect(timeline?.frames).toHaveLength(MAX_TIMELINE_DAYS + 1);
    expect(timeline?.frames[1].day).toBe(dagen[2]);
    // Het startframe pakt de rating van vóór het venster op.
    expect(timeline?.frames[0].ratings.get("p1")).toBe(1005 + 5);
  });

  it("kiest bij een gelijke sprong de grootste ratingwinst als stijger", () => {
    const rows = [
      row("p1", 1050),
      row("p2", 990, { history: [punt("2026-08-01", 1020, 990)] }),
      row("p3", 1012, { history: [punt("2026-08-01", 1010, 1012)] }),
      row("p4", 1001, { history: [punt("2026-08-01", 1000, 1001)] }),
    ];
    // p3 en p4 klimmen allebei één plek doordat p2 valt; p3 won meer rating.
    const timeline = buildRaceTimeline(rows);
    expect(timeline?.frames[1].riser).toEqual({ key: "p3", from: 3, to: 2 });
  });

  it("biedt geen film zonder speeldagen of zonder wijziging", () => {
    expect(buildRaceTimeline([row("p1", 1000)])).toBeNull();
    expect(
      buildRaceTimeline([
        row("p1", 1000, { history: [punt("2026-08-01", 1000, 1000)] }),
      ]),
    ).toBeNull();
  });
});

describe("calculateRankingMovement", () => {
  it("berekent stijgen, dalen, gelijk en nieuw", () => {
    expect(calculateRankingMovement(5, 7)).toBe(2);
    expect(calculateRankingMovement(7, 5)).toBe(-2);
    expect(calculateRankingMovement(5, 5)).toBe(0);
    expect(calculateRankingMovement(5, null)).toBe("nieuw");
  });
});
