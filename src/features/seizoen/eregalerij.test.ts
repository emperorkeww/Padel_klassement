import { describe, it, expect } from "vitest";
import { eregalerij } from "@/features/seizoen/eregalerij";
import type { Match, Profile, Team } from "@/types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
};

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  id,
  username: id,
  full_name: id.toUpperCase(),
  avatar_url: null,
  created_at: "2026-01-01T00:00:00",
  ...over,
});

const PROFILES: Record<string, Profile> = {
  a: profile("a"),
  b: profile("b"),
  c: profile("c"),
  d: profile("d"),
};

let seq = 0;
const match = (over: Partial<Match>): Match => ({
  id: `m${++seq}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: "2026-02-10T19:00:00",
  created_at: "2026-02-10T18:00:00",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

/** "Nu" ligt in Q3 2026, dus Q1 en Q2 zijn afgesloten. */
const NU = new Date(2026, 7, 15);

describe("eregalerij", () => {
  it("geeft één regel per afgesloten kwartaal waarin gespeeld is, nieuwste eerst", () => {
    const rijen = eregalerij({
      matches: [
        match({ played_at: "2026-02-10T19:00:00" }), // Q1
        match({ played_at: "2026-05-04T19:00:00" }), // Q2
      ],
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen.map((r) => r.season.id)).toEqual(["2026-q2", "2026-q1"]);
    expect(rijen.map((r) => r.naam.label)).toEqual(["🌱 Lente 2026", "❄️ Winter 2026"]);
    expect(rijen.map((r) => r.gespeeld)).toEqual([1, 1]);
  });

  it("laat het lopende kwartaal buiten de galerij", () => {
    const rijen = eregalerij({
      matches: [match({ played_at: "2026-07-20T19:00:00" })], // Q3 = lopend
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen).toEqual([]);
  });

  it("slaat afgesloten kwartalen zonder match over", () => {
    const rijen = eregalerij({
      matches: [match({ played_at: "2026-05-04T19:00:00" })], // enkel Q2
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen.map((r) => r.season.id)).toEqual(["2026-q2"]);
  });

  it("kroont de punten-#1 van het kwartaal tot kampioen", () => {
    const rijen = eregalerij({
      matches: [
        match({ played_at: "2026-02-10T19:00:00", winner_team_id: "t-cd", score_a: 2, score_b: 6 }),
        match({ played_at: "2026-02-17T19:00:00", winner_team_id: "t-cd", score_a: 1, score_b: 6 }),
      ],
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen).toHaveLength(1);
    expect(["c", "d"]).toContain(rijen[0].kampioen?.player_id);
    // Beide winnaars staan boven de verliezers.
    expect(rijen[0].standings.slice(0, 2).map((s) => s.player_id).sort()).toEqual([
      "c",
      "d",
    ]);
  });

  it("negeert niet-afgeronde matches", () => {
    const rijen = eregalerij({
      matches: [
        match({ played_at: "2026-02-10T19:00:00", status: "scheduled", winner_team_id: null }),
      ],
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen).toEqual([]);
  });

  it("houdt gasten uit de stand (#468)", () => {
    const rijen = eregalerij({
      matches: [match({ played_at: "2026-02-10T19:00:00" })],
      teams: TEAMS,
      profiles: { ...PROFILES, b: profile("b", { is_guest: true }) },
      now: NU,
    });
    expect(rijen[0].standings.map((s) => s.player_id)).not.toContain("b");
  });

  it("wijst de pias van het kwartaal aan bij een afdroging", () => {
    // Vier keer met 6 games verschil de deur uit: ruim boven de drempel.
    const rijen = eregalerij({
      matches: [
        match({ played_at: "2026-02-03T19:00:00", score_a: 6, score_b: 0 }),
        match({ played_at: "2026-02-10T19:00:00", score_a: 6, score_b: 0 }),
        match({ played_at: "2026-02-17T19:00:00", score_a: 6, score_b: 0 }),
      ],
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(["c", "d"]).toContain(rijen[0].pias?.playerId);
  });

  it("laat de pias weg als niemand boven een drempel komt", () => {
    const rijen = eregalerij({
      matches: [match({ played_at: "2026-02-10T19:00:00", score_a: 6, score_b: 5 })],
      teams: TEAMS,
      profiles: PROFILES,
      now: NU,
    });
    expect(rijen[0].pias).toBeNull();
  });

  it("geeft niets zonder afgeronde matches", () => {
    expect(
      eregalerij({ matches: [], teams: TEAMS, profiles: PROFILES, now: NU }),
    ).toEqual([]);
  });
});
