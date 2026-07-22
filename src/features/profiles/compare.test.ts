import { describe, it, expect } from "vitest";
import {
  comparisonSide,
  jointMatches,
  jointRol,
  ratingRankIndex,
  ratioBalk,
  vsKaartVoor,
} from "./compare";
import type { EditieContext } from "@/features/standings/edities";
import type { Match, PlayerRating, PlayerStanding, Profile, Team } from "@/types";

// Vier spelers in wisselende duo's, zodat p1 en p2 zowel partners als
// tegenstanders kunnen zijn.
const teams: Record<string, Team> = {
  tAB: { id: "tAB", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tCD: { id: "tCD", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tAC: { id: "tAC", name: null, player1_id: "p1", player2_id: "p3", created_at: "" },
  tBD: { id: "tBD", name: null, player1_id: "p2", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  return {
    id: `m${seq}`,
    team_a_id: "tAB",
    team_b_id: "tCD",
    status: "completed",
    winner_team_id: null,
    played_at: "2026-07-01T12:00:00Z",
    created_by: null,
    created_at: "2026-07-01T12:00:00Z",
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    format: "2v2",
    ...part,
  };
}

const standing = (part: Partial<PlayerStanding>): PlayerStanding => ({
  player_id: "p1",
  username: "alice",
  full_name: null,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  points: 0,
  goal_diff: 0,
  ...part,
});

describe("ratingRankIndex", () => {
  it("rangschikt op rating aflopend en valt terug op de punten-tie-break", () => {
    const standings: PlayerStanding[] = [
      standing({ player_id: "p1", points: 3 }),
      standing({ player_id: "p2", points: 9 }),
      standing({ player_id: "p3", points: 1 }),
    ];
    const ratings: Record<string, PlayerRating> = {
      p1: { player_id: "p1", rating: 1200, games: 10, updated_at: "" },
      p3: { player_id: "p3", rating: 1200, games: 10, updated_at: "" },
      // p2 heeft geen rating -> zakt naar onderen (-Infinity).
    };
    const index = ratingRankIndex(standings, ratings);
    // p1 en p3 delen 1200; p1 wint de punten-tie-break (3 > 1). p2 (geen rating) laatst.
    expect(index.get("p1")).toBe(1);
    expect(index.get("p3")).toBe(2);
    expect(index.get("p2")).toBe(3);
  });
});

describe("comparisonSide", () => {
  const ratings: Record<string, PlayerRating> = {
    p1: { player_id: "p1", rating: 1250, games: 20, updated_at: "" },
  };
  const rankIndex = new Map<string, number>([["p1", 2]]);

  it("bundelt rating, tier, positie, winrate en vorm", () => {
    // p1 & p2 winnen twee keer van p3 & p4, verliezen één keer.
    const matches = [
      match({ team_a_id: "tAB", team_b_id: "tCD", winner_team_id: "tAB" }),
      match({ team_a_id: "tAB", team_b_id: "tCD", winner_team_id: "tAB" }),
      match({ team_a_id: "tAB", team_b_id: "tCD", winner_team_id: "tCD" }),
    ];
    const kant = comparisonSide({
      id: "p1",
      naam: "Alice",
      standing: standing({ player_id: "p1", played: 3, won: 2, lost: 1, points: 6 }),
      matches,
      teams,
      ratings,
      rankIndex,
    });
    expect(kant.naam).toBe("Alice");
    expect(kant.rating).toBe(1250);
    expect(kant.tier).not.toBeNull();
    expect(kant.rank).toBe(2);
    expect(kant.punten).toBe(6);
    expect(kant.gespeeld).toBe(3);
    expect(kant.winrate).toBe(67); // 2/3 afgerond
    expect(kant.vorm).toHaveLength(3);
  });

  it("valt netjes terug zonder rating/standing", () => {
    const kant = comparisonSide({
      id: "px",
      naam: "Onbekend",
      standing: null,
      matches: [],
      teams,
      ratings: {},
      rankIndex: new Map(),
    });
    expect(kant.rating).toBeNull();
    expect(kant.tier).toBeNull();
    expect(kant.rank).toBeNull();
    expect(kant.punten).toBe(0);
    expect(kant.winrate).toBeNull();
    expect(kant.vorm).toEqual([]);
    expect(kant.badges).toBe(0);
  });
});

describe("jointRol", () => {
  it("herkent duo versus rivalen", () => {
    const samen = match({ team_a_id: "tAB", team_b_id: "tCD" }); // p1 & p2 samen
    const tegen = match({ team_a_id: "tAC", team_b_id: "tBD" }); // p1 vs p2
    expect(jointRol(samen, teams, "p1", "p2")).toBe("duo");
    expect(jointRol(tegen, teams, "p1", "p2")).toBe("rivalen");
  });
});

describe("jointMatches", () => {
  it("houdt enkel afgewerkte matches met beide spelers, nieuwste eerst", () => {
    const oud = match({
      team_a_id: "tAB",
      team_b_id: "tCD",
      played_at: "2026-01-01T12:00:00Z",
    });
    const nieuw = match({
      team_a_id: "tAC",
      team_b_id: "tBD",
      played_at: "2026-06-01T12:00:00Z",
    });
    const zonderP2 = match({ team_a_id: "tAC", team_b_id: "tCD" }); // geen p2
    const gepland = match({
      team_a_id: "tAB",
      team_b_id: "tCD",
      status: "scheduled",
    });
    const result = jointMatches([oud, nieuw, zonderP2, gepland], teams, "p1", "p2");
    expect(result.map((m) => m.id)).toEqual([nieuw.id, oud.id]);
  });

  it("respecteert de limiet", () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      match({
        team_a_id: "tAB",
        team_b_id: "tCD",
        played_at: `2026-07-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
      }),
    );
    expect(jointMatches(many, teams, "p1", "p2", 10)).toHaveLength(10);
  });
});

describe("vsKaartVoor (#499) — dictator- en editie-bewust, zoals overal elders", () => {
  // Editie-context met alles uit (en gerichte overrides per test, #625).
  const ctx = (over: Partial<EditieContext> = {}): EditieContext => ({
    dictatorId: null,
    iconKey: null,
    kampioen: null,
    inForm: null,
    ...over,
  });
  const profile = (id: string, extra: Partial<Profile> = {}): Profile => ({
    id,
    username: id,
    full_name: null,
    avatar_url: null,
    created_at: "",
    ...extra,
  });
  const ratings: Record<string, PlayerRating> = {
    p1: { player_id: "p1", rating: 1650, games: 20, updated_at: "" },
    p2: { player_id: "p2", rating: 1250, games: 20, updated_at: "" },
  };

  it("klemt 1600+ terug naar GOAT tenzij de speler zelf de zittende dictator is (#621)", () => {
    const nietDictator = vsKaartVoor({
      id: "p1",
      profile: profile("p1"),
      naam: "Alice",
      ratings,
      edities: ctx(),
    });
    expect(nietDictator.tier?.key).toBe("legende");

    const zittendeDictator = vsKaartVoor({
      id: "p1",
      profile: profile("p1"),
      naam: "Alice",
      ratings,
      edities: ctx({ dictatorId: "p1" }),
    });
    expect(zittendeDictator.tier?.key).toBe("dictator");
  });

  it("draagt dezelfde editie en playstyles als de rest van de app", () => {
    const inForm = { playerId: "p2", delta: 48, matches: 3 };
    const kaart = vsKaartVoor({
      id: "p2",
      profile: profile("p2", {
        avatar_url: "https://example.com/p2.png",
        featured_badges: ["eerste-overwinning"],
      }),
      naam: "Bob",
      ratings,
      edities: ctx({ inForm }),
    });
    expect(kaart.editie).toBe("inform");
    expect(kaart.editieTekst).toBe("⚡ In-Form · +48");
    expect(kaart.avatarUrl).toBe("https://example.com/p2.png");
    expect(kaart.playstyles.map((b) => b.id)).toContain("eerste-overwinning");
  });

  it("valt netjes terug zonder rating", () => {
    const kaart = vsKaartVoor({
      id: "px",
      profile: profile("px"),
      naam: "Onbekend",
      ratings: {},
      edities: ctx(),
    });
    expect(kaart.rating).toBeNull();
    expect(kaart.tier).toBeNull();
    expect(kaart.editie).toBeNull();
    expect(kaart.playstyles).toEqual([]);
  });
});

describe("ratioBalk", () => {
  it("verdeelt winst/gelijk/verlies over 100%", () => {
    expect(ratioBalk(3, 1, 0)).toEqual({ win: 75, draw: 0, loss: 25 });
  });
  it("geeft nullen bij geen duels", () => {
    expect(ratioBalk(0, 0, 0)).toEqual({ win: 0, draw: 0, loss: 0 });
  });
});
