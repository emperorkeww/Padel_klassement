import { describe, it, expect } from "vitest";
import { coachOpmerking, type CoachCtx } from "./coachFeed";
import type { FeedEvent } from "../../lib/feed";
import type { Match, Profile } from "../../lib/types";

const ctx: CoachCtx = {
  intensiteitVoor: () => "gemeen",
  profiles: {},
};

const matchStub = { id: "m1" } as Match;

describe("coachOpmerking", () => {
  it("zwijgt bij mundane gebeurtenissen", () => {
    const e: FeedEvent = { kind: "friendship", at: "2026-07-01T12:00:00Z", a: "p1", b: "p2" };
    expect(coachOpmerking(e, ctx)).toBeNull();
  });

  it("zwijgt bij een gewone match zonder highlights", () => {
    const e: FeedEvent = {
      kind: "match",
      at: "2026-07-01T12:00:00Z",
      match: matchStub,
      highlights: [],
      myDelta: null,
    };
    expect(coachOpmerking(e, ctx)).toBeNull();
  });

  it("reageert op een bagel-match", () => {
    const e: FeedEvent = {
      kind: "match",
      at: "2026-07-01T12:00:00Z",
      match: matchStub,
      highlights: [{ type: "score", label: "bagel" }],
      myDelta: null,
    };
    expect(coachOpmerking(e, ctx)).toBeTruthy();
  });

  it("feliciteert (met jab) een kampioen", () => {
    const e: FeedEvent = {
      kind: "season-champion",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      seasonLabel: "Q2 2026",
    };
    expect(coachOpmerking(e, ctx)).toBeTruthy();
  });

  it("onderscheidt promotie en degradatie", () => {
    const omhoog: FeedEvent = { kind: "rank", at: "2026-07-01T12:00:00Z", playerId: "p1", shift: 3, rank: 2 };
    const omlaag: FeedEvent = { kind: "rank", at: "2026-07-01T12:00:00Z", playerId: "p1", shift: -3, rank: 9 };
    const a = coachOpmerking(omhoog, ctx);
    const b = coachOpmerking(omlaag, ctx);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("roast de pias van de week, maar zwijgt bij een roast-schild", () => {
    const e: FeedEvent = {
      kind: "pias-week",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      winChance: 0.8,
      weekStart: "2026-06-29",
    };
    expect(coachOpmerking(e, ctx)).toBeTruthy();

    const beschermd: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: { p1: { roast_schild: true } as Profile },
    };
    expect(coachOpmerking(e, beschermd)).toBeNull();
  });
});
