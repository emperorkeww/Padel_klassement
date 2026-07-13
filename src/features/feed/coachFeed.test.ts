import { describe, it, expect } from "vitest";
import { coachOpmerking, coachStemming, type CoachCtx, KAMPIOEN, KAMPIOEN_NEUTRAAL } from "./coachFeed";
import type { FeedEvent } from "../../lib/feed";
import type { Match, Profile, Team } from "../../lib/types";

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

  it("reageert op een 6-0 match", () => {
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
    expect(KAMPIOEN).toContain(coachOpmerking(e, ctx));
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
    expect(KAMPIOEN_NEUTRAAL).toContain(coachOpmerking(e, beschermd));
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
    expect(zonderSchild).toMatch(/trainen|gezellig|zwaartekracht|kelderklasse|zakken|gezakt|degradatie|scheidsrechter|omlaag|Infantino|complot|FIFA/i);
    expect(metSchild).toMatch(/rustig|volgende match|stap terug|omlaag/i);
  });

  it("neutraliseert 6-0 commentaar als een verliezer een roast-schild heeft", () => {
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

describe("coachOpmerking — stats-bewust (#200)", () => {
  // ta = {p3,p4} wint, tb = {p1,p2} verliest.
  const statsTeams: Record<string, Team> = {
    ta: { id: "ta", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
    tb: { id: "tb", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  };
  const m = (part: Partial<Match> & { id: string; played_at: string }): Match => ({
    team_a_id: "ta",
    team_b_id: "tb",
    status: "completed",
    winner_team_id: "ta",
    created_by: null,
    created_at: part.played_at,
    group_id: null,
    round_number: null,
    score_a: 6,
    score_b: 0,
    ...part,
  });
  const bagelEvent = (match: Match): FeedEvent => ({
    kind: "match",
    at: match.played_at ?? "",
    match,
    highlights: [{ type: "score", label: "bagel" }],
    myDelta: null,
  });

  it("verwerkt de herhaling in een bagel-quip als de matchlijst er is", () => {
    const b1 = m({ id: "b1", played_at: "2026-07-05T12:00:00Z" });
    const b2 = m({ id: "b2", played_at: "2026-07-12T12:00:00Z" });
    const c: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: {},
      teams: statsTeams,
      matches: [b1, b2],
    };
    // 2e bagel deze maand → een concrete feit-lijn i.p.v. een generieke pool.
    expect(coachOpmerking(bagelEvent(b2), c)).toMatch(/deze maand|op rij|afgang/i);
  });

  it("valt terug op de generieke pool zonder matchlijst", () => {
    const b2 = m({ id: "b2", played_at: "2026-07-12T12:00:00Z" });
    const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, teams: statsTeams };
    expect(coachOpmerking(bagelEvent(b2), c)).not.toMatch(/deze maand|op rij|afgang/i);
  });

  it("noemt het puntenverschil bij een monsterzege", () => {
    const mm = m({ id: "mm", played_at: "2026-07-20T12:00:00Z", score_a: 6, score_b: 1 });
    const e: FeedEvent = {
      kind: "match",
      at: mm.played_at ?? "",
      match: mm,
      highlights: [{ type: "score", label: "monsterzege" }],
      myDelta: null,
    };
    const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, teams: statsTeams, matches: [mm] };
    expect(coachOpmerking(e, c)).toMatch(/5 games verschil/);
  });

  it("noemt de winkans bij een upset", () => {
    const um = m({ id: "um", played_at: "2026-07-21T12:00:00Z", score_a: 6, score_b: 4 });
    const e: FeedEvent = {
      kind: "match",
      at: um.played_at ?? "",
      match: um,
      highlights: [{ type: "upset", chance: 0.12, winnerTeamId: "ta" }],
      myDelta: null,
    };
    const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, teams: statsTeams, matches: [um] };
    expect(coachOpmerking(e, c)).toMatch(/12% winkans/);
  });

  it("meldt de mijlpaal-reeks bij een winreeks", () => {
    const wins = [1, 2, 3].map((i) =>
      m({ id: `w${i}`, played_at: `2026-07-0${i}T12:00:00Z`, winner_team_id: "ta", score_a: 6, score_b: 2 }),
    );
    const e: FeedEvent = {
      kind: "match",
      at: wins[2].played_at ?? "",
      match: wins[2],
      highlights: [{ type: "streak", playerId: "p3", count: 3 }],
      myDelta: null,
    };
    const c: CoachCtx = { intensiteitVoor: () => "gemeen", profiles: {}, teams: statsTeams, matches: wins };
    expect(coachOpmerking(e, c)).toMatch(/op rij/);
  });

  it("zet 'al je Nde pias deze maand' voor de sneer", () => {
    const e: FeedEvent = {
      kind: "pias-week",
      at: "2026-07-13T12:00:00Z",
      groupId: "g1",
      groupName: "Vrijdag",
      playerId: "p1",
      winChance: 0.8,
      weekStart: "2026-07-13",
    };
    const c: CoachCtx = {
      intensiteitVoor: () => "gemeen",
      profiles: {},
      piasWeeks: [
        { playerId: "p1", weekStart: "2026-07-06" },
        { playerId: "p1", weekStart: "2026-07-13" },
      ],
    };
    expect(coachOpmerking(e, c)).toMatch(/^Al je 2e pias deze maand\. /);
  });

  it("is deterministisch met matchcontext", () => {
    const b1 = m({ id: "b1", played_at: "2026-07-05T12:00:00Z" });
    const b2 = m({ id: "b2", played_at: "2026-07-12T12:00:00Z" });
    const run = () => {
      const c: CoachCtx = {
        intensiteitVoor: () => "gemeen",
        profiles: {},
        teams: statsTeams,
        matches: [b1, b2],
        gebruikt: new Set<string>(),
      };
      return coachOpmerking(bagelEvent(b2), c);
    };
    expect(run()).toBe(run());
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
