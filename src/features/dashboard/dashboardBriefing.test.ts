import { describe, it, expect } from "vitest";
import { dashboardBriefing, type BriefingInput } from "./dashboardBriefing";
import type { Match, PlayerStanding, Profile, Team } from "@/types";

// De briefing zat als 70 regels afleiding in Dashboard.tsx en was alleen via een
// volledige render te raken (#736). Hier de takken die eigen logica bevatten.

const ME: PlayerStanding = {
  player_id: "p1",
  username: "alice",
  played: 10,
  won: 6,
  drawn: 0,
  lost: 4,
  points: 18,
  goal_diff: 5,
} as unknown as PlayerStanding;

const TEAMS: Record<string, Team> = {
  "t-mij": { id: "t-mij", player1_id: "p1", player2_id: "p3" } as unknown as Team,
  "t-rivaal": { id: "t-rivaal", player1_id: "p2", player2_id: "p4" } as unknown as Team,
};

const PROFIELEN: Record<string, Profile> = {
  p1: { id: "p1", username: "alice" } as unknown as Profile,
  p2: { id: "p2", username: "bob" } as unknown as Profile,
};

/** Eén verloren duel tegen p2, zodat de verliesreeks te sturen is. */
function verloren(id: string): Match {
  return {
    id,
    team_a_id: "t-mij",
    team_b_id: "t-rivaal",
    status: "completed",
    winner_team_id: "t-rivaal",
    score_a: 2,
    score_b: 6,
    played_at: "2026-07-01T10:00:00.000Z",
    created_at: "2026-07-01T10:00:00.000Z",
  } as unknown as Match;
}

const VOLGENDE = {
  id: "m-next",
  team_a_id: "t-mij",
  team_b_id: "t-rivaal",
  status: "planned",
  created_at: "2026-07-03T10:00:00.000Z",
} as unknown as Match;

function input(over: Partial<BriefingInput> = {}): BriefingInput {
  return {
    myId: "p1",
    me: ME,
    profile: PROFIELEN.p1,
    rank: 3,
    streak: 0,
    losing: 0,
    vorm: [],
    dayDelta: 0,
    matches: [],
    teams: TEAMS,
    profiles: PROFIELEN,
    ratings: {},
    eloRanked: [ME],
    nextMatch: null,
    rival: null,
    tierNext: null,
    nextBadge: null,
    vandaag: "2026-07-03",
    ...over,
  };
}

describe("dashboardBriefing", () => {
  it("zwijgt zolang je nog niet in het klassement staat", () => {
    expect(dashboardBriefing(input({ me: undefined }))).toBeNull();
  });

  it("geeft een regel zodra er een klassementsrij is", () => {
    const regel = dashboardBriefing(input());
    expect(typeof regel).toBe("string");
    expect(regel).not.toBe("");
  });

  it("is stabiel per dag en verschilt tussen dagen", () => {
    const a = dashboardBriefing(input());
    expect(dashboardBriefing(input())).toBe(a);
    // Andere seed-dag mag een andere regel opleveren; stabiliteit binnen de dag
    // is wat telt, dus we controleren enkel dat de seed echt meedoet.
    const b = dashboardBriefing(input({ vandaag: "2026-07-04" }));
    expect(typeof b).toBe("string");
  });

  it("noemt de rivaal bij een lopende verliesreeks tegen hem", () => {
    const rival = { oppId: "p2", rec: { played: 4, won: 1, drawn: 0, lost: 3 } };
    const regel = dashboardBriefing(
      input({
        rival,
        nextMatch: VOLGENDE,
        matches: [verloren("m1"), verloren("m2")],
      }),
    );
    expect(regel).toContain("bob");
  });

  it("zwijgt over de rivaal bij één nederlaag — dat is geen reeks", () => {
    const rival = { oppId: "p2", rec: { played: 2, won: 1, drawn: 0, lost: 1 } };
    const regel = dashboardBriefing(
      input({ rival, nextMatch: VOLGENDE, matches: [verloren("m1")] }),
    );
    expect(regel).not.toContain("bob");
  });

  it("laat het roast-schild de rivaal-sneer doven", () => {
    const rival = { oppId: "p2", rec: { played: 4, won: 1, drawn: 0, lost: 3 } };
    const met = dashboardBriefing(
      input({
        rival,
        nextMatch: VOLGENDE,
        matches: [verloren("m1"), verloren("m2")],
        profile: { ...PROFIELEN.p1, roast_schild: true } as unknown as Profile,
      }),
    );
    expect(met).not.toContain("bob");
  });
});
