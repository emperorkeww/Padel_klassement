import { describe, it, expect } from "vitest";
import { feedSummary, type FeedSummaryCtx } from "./feedSummary";
import type { Match, Profile } from "../../lib/types";

const profiel = (id: string, naam: string): Profile =>
  ({ id, username: id, full_name: naam, avatar_url: null, created_at: "" } as Profile);

const ctx: FeedSummaryCtx = {
  myId: "p1",
  profiles: {
    p1: profiel("p1", "Alice Anders"),
    p2: profiel("p2", "Bob Boers"),
    p3: profiel("p3", "Carol Claes"),
    p4: profiel("p4", "Dave De Vos"),
  },
  teams: {
    "t-ab": { id: "t-ab", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
    "t-cd": { id: "t-cd", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  },
};

const match = (extra: Partial<Match> = {}): Match =>
  ({
    id: "m1",
    team_a_id: "t-ab",
    team_b_id: "t-cd",
    status: "completed",
    winner_team_id: "t-ab",
    played_at: "2026-07-02T12:00:00Z",
    created_at: "2026-07-02T12:00:00Z",
    score_a: 6,
    score_b: 3,
    ...extra,
  } as Match);

describe("feedSummary", () => {
  it("match: winnaar won van verliezer, linkt naar de match", () => {
    const r = feedSummary({ kind: "match", at: "", match: match(), highlights: [], myDelta: null }, ctx);
    expect(r).toEqual({
      icon: "🎾",
      tekst: "Alice Anders & Bob Boers won van Carol Claes & Dave De Vos",
      to: "/matches/m1",
    });
  });

  it("match: gelijkspel zonder winnaar", () => {
    const r = feedSummary(
      { kind: "match", at: "", match: match({ winner_team_id: null }), highlights: [], myDelta: null },
      ctx,
    );
    expect(r.tekst).toContain("speelde gelijk tegen");
  });

  it("friendship: 'Jij en X' als het jou betreft, anders beide namen; linkt naar de ander", () => {
    const mijn = feedSummary({ kind: "friendship", at: "", a: "p1", b: "p2" }, ctx);
    expect(mijn).toMatchObject({ icon: "🤝", tekst: "Jij en Bob Boers zijn nu vrienden", to: "/spelers/p2" });
    const anderen = feedSummary({ kind: "friendship", at: "", a: "p2", b: "p3" }, ctx);
    expect(anderen.tekst).toBe("Bob Boers en Carol Claes zijn nu vrienden");
    expect(anderen.to).toBe("/spelers/p2");
  });

  it("planned: geplande match linkt naar de match", () => {
    const r = feedSummary(
      { kind: "planned", at: "", match: match({ status: "scheduled", winner_team_id: null }) },
      ctx,
    );
    expect(r.icon).toBe("🗓️");
    expect(r.to).toBe("/matches/m1");
  });

  it("group-joined: naam + groep, linkt naar de groep", () => {
    const r = feedSummary(
      { kind: "group-joined", at: "", groupId: "g1", groupName: "Vrijdagavond", playerId: "p2" },
      ctx,
    );
    expect(r).toEqual({
      icon: "👥",
      tekst: "Bob Boers is lid geworden van Vrijdagavond",
      to: "/groepen/g1",
    });
  });

  it("rank: stijging linkt naar het klassement", () => {
    const r = feedSummary({ kind: "rank", at: "", playerId: "p2", shift: 3, rank: 2 }, ctx);
    expect(r.icon).toBe("⬆️");
    expect(r.tekst).toBe("Bob Boers steeg naar #2");
    expect(r.to).toBe("/klassement");
  });

  it("season-champion: linkt naar de groepsstand van dat seizoen", () => {
    const r = feedSummary(
      { kind: "season-champion", at: "", groupId: "g1", groupName: "Vrijdagavond", playerId: "p3", seasonLabel: "Q2 2026" },
      ctx,
    );
    expect(r.icon).toBe("🏆");
    expect(r.to).toBe("/groepen/g1?tab=stand&seizoen=Q2 2026");
  });
});
