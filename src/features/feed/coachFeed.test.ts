import { describe, it, expect } from "vitest";
import { coachOpmerking, coachStemming, type CoachCtx } from "./coachFeed";
import type { FeedEvent } from "../../lib/feed";
import type { Match, Profile } from "../../lib/types";

const ctx: CoachCtx = {
  intensiteitVoor: () => "gemeen",
  profiles: {},
};

const matchStub = { id: "m1", team_a_id: "ta", team_b_id: "tb", winner_team_id: "ta" } as Match;

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

  it("houdt kampioen-jabs actief zolang het schild uit staat", () => {
    const e: FeedEvent = {
      kind: "season-champion",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      seasonLabel: "Q2 2026",
    };
    expect(coachOpmerking(e, ctx)).toContain("—");
  });

  it("gebruikt neutrale kampioen-tekst bij een roast-schild", () => {
    const e: FeedEvent = {
      kind: "season-champion",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      seasonLabel: "Q2 2026",
    };
    const beschermd: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: { p1: { roast_schild: true } as Profile },
    };
    expect(coachOpmerking(e, beschermd)).not.toContain("—");
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

  it("neutraliseert ranking-commentaar alleen bij een roast-schild", () => {
    const daler: FeedEvent = { kind: "rank", at: "2026-07-01T12:00:00Z", playerId: "p1", shift: -3, rank: 9 };
    const zonderSchild = coachOpmerking(daler, ctx);
    const beschermd: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: { p1: { roast_schild: true } as Profile },
    };
    const metSchild = coachOpmerking(daler, beschermd);
    expect(zonderSchild).toMatch(/trainen|gezellig|zwaartekracht|kelderklasse|zakken|gezakt/i);
    expect(metSchild).toMatch(/rustig|volgende match|stap terug|omlaag/i);
  });

  it("neutraliseert bagel-commentaar als een verliezer een roast-schild heeft", () => {
    const e: FeedEvent = {
      kind: "match",
      at: "2026-07-01T12:00:00Z",
      match: matchStub,
      highlights: [{ type: "score", label: "bagel" }],
      myDelta: null,
    };
    const beschermd: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: { p2: { roast_schild: true } as Profile },
      teams: {
        ta: { player1_id: "p3", player2_id: "p4" },
        tb: { player1_id: "p1", player2_id: "p2" },
      } as never,
    };
    expect(coachOpmerking(e, beschermd)).toMatch(/duidelijke uitslag|eenzijdige set|volgende match|neutraal/i);
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

describe("coachStemming", () => {
  const radioactief = () => "radioactief" as const;

  it("geeft een persoonlijke roast de groepsintensiteit", () => {
    const e: FeedEvent = {
      kind: "pias-week",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      winChance: 0.8,
      weekStart: "2026-06-29",
    };
    expect(coachStemming(e, radioactief)).toBe("radioactief");
  });

  it("is trots bij een kampioen en promotie", () => {
    const champ: FeedEvent = {
      kind: "season-champion",
      at: "2026-07-01T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      seasonLabel: "Q2 2026",
    };
    const promotie: FeedEvent = {
      kind: "rank",
      at: "2026-07-01T12:00:00Z",
      playerId: "p1",
      shift: 3,
      rank: 2,
    };
    expect(coachStemming(champ, () => "gemeen")).toBe("trots");
    expect(coachStemming(promotie, () => "gemeen")).toBe("trots");
  });

  it("valt terug op portret bij een event zonder eigen reactie", () => {
    const e: FeedEvent = { kind: "friendship", at: "2026-07-01T12:00:00Z", a: "p1", b: "p2" };
    expect(coachStemming(e, () => "gemeen")).toBe("portret");
  });
});

describe("coachOpmerking — anti-herhaling (#201)", () => {
  const champion = (): FeedEvent => ({
    kind: "season-champion",
    at: "2026-07-01T12:00:00Z",
    groupId: "g1",
    groupName: "Vrijdag",
    playerId: "p1",
    seasonLabel: "Q2 2026",
  });

  it("herhaalt geen quip binnen één weergave, zelfs bij dezelfde seed", () => {
    // Zelfde event (zelfde seed) → zonder dedup zou het identiek zijn. Met een
    // gedeelde set moet elke quip verschillen — en dat bewijst meteen dat de
    // eventpool minstens 8 varianten heeft.
    const g = new Set<string>();
    const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, gebruikt: g };
    const acht = Array.from({ length: 8 }, () => coachOpmerking(champion(), c));
    expect(new Set(acht).size).toBe(8);
  });

  it("is deterministisch: zelfde volgorde + verse set → zelfde resultaat", () => {
    const run = () => {
      const g = new Set<string>();
      const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, gebruikt: g };
      return [champion(), champion(), champion()].map((e) => coachOpmerking(e, c));
    };
    expect(run()).toEqual(run());
  });
});
