import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deltaToday } from "./ratingDelta";
import type { RatingPoint } from "@/types";

function pt(played_at: string, delta: number): RatingPoint {
  return {
    match_id: `m-${played_at}-${delta}`,
    delta,
    rating_before: 1000,
    rating_after: 1000 + delta,
    played_at,
  } as RatingPoint;
}

describe("deltaToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Middag UTC: clubdag is 2026-07-14 in zowel UTC als Europe/Brussels.
    vi.setSystemTime(new Date("2026-07-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sommeert alle delta's van de clubdag", () => {
    const history = [
      pt("2026-07-13T19:00:00Z", 30), // gisteren: telt niet mee
      pt("2026-07-14T09:00:00Z", 12),
      pt("2026-07-14T10:30:00Z", -4),
      pt("2026-07-14T11:45:00Z", 7),
    ];
    expect(deltaToday(history, "Europe/Brussels")).toBe(15);
  });

  it("geeft 0 als er vandaag niet gespeeld is", () => {
    const history = [pt("2026-07-12T19:00:00Z", 9), pt("2026-07-13T19:00:00Z", -3)];
    expect(deltaToday(history, "Europe/Brussels")).toBe(0);
  });

  it("geeft 0 bij een lege historie", () => {
    expect(deltaToday([], "Europe/Brussels")).toBe(0);
  });

  it("geeft netto 0 als winst en verlies elkaar opheffen", () => {
    const history = [pt("2026-07-14T09:00:00Z", 8), pt("2026-07-14T11:00:00Z", -8)];
    expect(deltaToday(history, "Europe/Brussels")).toBe(0);
  });

  it("bepaalt de clubdag in de opgegeven tijdzone", () => {
    // 23:30 UTC: in Brussel (UTC+2, zomertijd) is het al 15 juli.
    vi.setSystemTime(new Date("2026-07-14T23:30:00Z"));
    const history = [pt("2026-07-14T20:00:00Z", 10)];
    expect(deltaToday(history, "UTC")).toBe(10);
    expect(deltaToday(history, "Europe/Brussels")).toBe(0);
  });
});
