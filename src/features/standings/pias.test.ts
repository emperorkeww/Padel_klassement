import { describe, it, expect } from "vitest";
import {
  currentPias,
  isoParts,
  pickGlobalePias,
  pickPias,
  type PiasWeek,
} from "@/features/standings/pias";
import type { Match, RatingPoint, Team } from "@/types";

const team = (id: string, p1: string, p2: string): Team =>
  ({ id, name: null, player1_id: p1, player2_id: p2, created_at: "" }) as Team;

const TEAMS: Record<string, Team> = {
  strong: team("strong", "p1", "p2"),
  weak: team("weak", "p3", "p4"),
  mid: team("mid", "p5", "p6"),
};

const match = (
  id: string,
  winner: string | null,
  over: Partial<Match> = {},
): Match =>
  ({
    id,
    team_a_id: "strong",
    team_b_id: "weak",
    status: "completed",
    winner_team_id: winner,
    played_at: "2026-07-08T18:00:00Z", // woensdag, ISO-week begint ma 2026-07-06
    created_at: "2026-07-08T18:00:00Z",
    group_id: "g1",
    round_number: null,
    score_a: null,
    score_b: null,
    created_by: null,
    ...over,
  }) as Match;

const point = (matchId: string, before: number): RatingPoint =>
  ({
    match_id: matchId,
    rating_before: before,
    rating_after: before,
    delta: 0,
    played_at: "",
  }) as RatingPoint;

// strong (1300/1250) is torenhoog favoriet tegen weak (1000/1000).
const HIST: Record<string, RatingPoint[]> = {
  p1: [point("m1", 1300)],
  p2: [point("m1", 1250)],
  p3: [point("m1", 1000)],
  p4: [point("m1", 1000)],
};

describe("pickPias (#643) — anti-MVP-spiegel van recompute_pias/bepaalPias", () => {
  it("choke: de favoriet die verloor draagt de schande (tie → laagste id)", () => {
    // strong (1300/1250) verliest van weak (1000/1000): winkans ~83% → choke.
    // p1 en p2 choken allebei even hard: het laagste id wint, zoals bepaalPias.
    const rows = pickPias([match("m1", "weak")], TEAMS, HIST);
    expect(rows).toHaveLength(1);
    expect(rows[0].groupId).toBe("g1");
    expect(rows[0].playerId).toBe("p1");
    expect(rows[0].reden).toBe("choke");
    expect(rows[0].matchId).toBe("m1");
    expect(rows[0].weekStart).toBe("2026-07-06");
    expect(rows[0].winChance).toBeGreaterThan(0.6);
    expect(rows[0].waarde).toBe(rows[0].winChance);
  });

  it("geen afgang boven een drempel → geen pias (winst, draw, underdog)", () => {
    expect(pickPias([match("m1", "strong")], TEAMS, HIST)).toEqual([]);
    expect(pickPias([match("m1", null)], TEAMS, HIST)).toEqual([]);
    // weak verliest zonder scores van strong: geen favoriet, geen marge.
    expect(
      pickPias(
        [match("m1", "strong", { team_a_id: "weak", team_b_id: "strong" })],
        TEAMS,
        HIST,
      ),
    ).toEqual([]);
  });

  it("negeert matches zonder groep", () => {
    expect(pickPias([match("m1", "weak", { group_id: null })], TEAMS, HIST)).toEqual(
      [],
    );
  });

  it("bagel: 6–0 slikken weegt zwaarder dan elke choke", () => {
    // m1: strong choket tegen weak (ernst ~38); m2: weak krijgt een bagel van
    // mid (ernst 110) → de bagel-eter is de pias, tie → p3.
    const m2 = match("m2", "mid", {
      team_a_id: "mid",
      team_b_id: "weak",
      score_a: 6,
      score_b: 0,
      played_at: "2026-07-08T19:00:00Z",
    });
    const rows = pickPias([match("m1", "weak"), m2], TEAMS, HIST);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: "p3",
      reden: "bagel",
      ernst: 110,
      waarde: 1,
      winChance: null,
      matchId: "m2",
    });
  });

  it("afdroging: verlies met ≥ 4 games verschil, anker = laatste verlies", () => {
    // p3/p4 verliezen 6–2 (marge 4) en daarna 6–4: reden blijft de afdroging,
    // het anker is de láátste verloren match (zoals de SQL).
    const m1 = match("m1", "strong", { score_a: 6, score_b: 2 });
    const m2 = match("m2", "strong", {
      score_a: 6,
      score_b: 4,
      played_at: "2026-07-09T18:00:00Z",
    });
    const rows = pickPias([m1, m2], TEAMS, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: "p3",
      reden: "afdroging",
      ernst: 54,
      waarde: 4,
      winChance: null,
      matchId: "m2",
    });
  });

  it("zwarte reeks: drie verliezen op rij binnen de week", () => {
    const verlies = (id: string, uur: number) =>
      match(id, "strong", { played_at: `2026-07-08T${uur}:00:00Z` });
    const rows = pickPias(
      [verlies("m1", 16), verlies("m2", 17), verlies("m3", 18)],
      TEAMS,
      {},
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: "p3",
      reden: "zwarte-reeks",
      ernst: 43,
      waarde: 3,
      matchId: "m3",
    });
  });

  it("levert één pias per (groep, ISO-week)", () => {
    const week1 = match("m1", "strong", { score_a: 6, score_b: 0 });
    const week2 = match("m2", "strong", {
      score_a: 6,
      score_b: 0,
      played_at: "2026-07-15T18:00:00Z",
    });
    const rows = pickPias([week1, week2], TEAMS, {});
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.weekStart).sort()).toEqual([
      "2026-07-06",
      "2026-07-13",
    ]);
  });
});

describe("currentPias", () => {
  const row = (weekStart: string): PiasWeek => ({
    groupId: "g1",
    isoYear: 2026,
    isoWeek: 1,
    weekStart,
    playerId: "p1",
    matchId: "m",
    reden: "choke",
    ernst: 38,
    waarde: 0.8,
    winChance: 0.8,
  });

  it("kiest de rij van de lopende week", () => {
    const rows = [row("2026-06-29"), row("2026-07-06")];
    const now = new Date("2026-07-08T10:00:00Z");
    expect(currentPias(rows, now)?.weekStart).toBe("2026-07-06");
  });

  it("valt terug op de meest recente rij buiten een lopende week", () => {
    const rows = [row("2026-06-29"), row("2026-07-06")];
    const now = new Date("2026-08-01T10:00:00Z");
    expect(currentPias(rows, now)?.weekStart).toBe("2026-07-06");
  });

  it("null zonder rijen", () => {
    expect(currentPias([], new Date("2026-07-08T10:00:00Z"))).toBeNull();
  });
});

describe("pickGlobalePias (#631/#643) — spiegel van get_global_pias", () => {
  const rij = (over: Partial<PiasWeek>): PiasWeek => ({
    groupId: "g1",
    isoYear: 2026,
    isoWeek: 30,
    weekStart: "2026-07-20",
    playerId: "p1",
    matchId: "m1",
    reden: "choke",
    ernst: 37,
    waarde: 0.7,
    winChance: 0.7,
    ...over,
  });

  it("kiest per week de per-groep-pias met de hoogste ernst", () => {
    const rows = [
      rij({ groupId: "g1", playerId: "p1", ernst: 37 }),
      rij({ groupId: "g2", playerId: "p2", reden: "bagel", ernst: 110, waarde: 1, winChance: null }),
      rij({ groupId: "g3", playerId: "p3", reden: "afdroging", ernst: 55, waarde: 5, winChance: null }),
    ];
    const globaal = pickGlobalePias(rows);
    expect(globaal).toHaveLength(1);
    // De globale pias is per definitie ook de pias van z'n eigen groep.
    expect(globaal[0]).toEqual(rows[1]);
  });

  it("breekt gelijke ernst met het laagste player-id (zelfde als bepaalPias)", () => {
    const rows = [
      rij({ groupId: "g2", playerId: "p9", ernst: 54 }),
      rij({ groupId: "g1", playerId: "p2", ernst: 54 }),
    ];
    expect(pickGlobalePias(rows)[0].playerId).toBe("p2");
  });

  it("levert één winnaar per ISO-week", () => {
    const rows = [
      rij({ isoWeek: 29, weekStart: "2026-07-13", playerId: "p1", ernst: 39 }),
      rij({ isoWeek: 30, weekStart: "2026-07-20", playerId: "p2", ernst: 37 }),
      rij({ isoWeek: 30, weekStart: "2026-07-20", groupId: "g2", playerId: "p3", ernst: 38 }),
    ];
    const globaal = pickGlobalePias(rows);
    expect(globaal.map((r) => r.playerId).sort()).toEqual(["p1", "p3"]);
  });
});

describe("isoParts", () => {
  it("geeft de maandag van de ISO-week", () => {
    expect(isoParts(new Date("2026-07-08T18:00:00Z")).weekStart).toBe(
      "2026-07-06",
    );
  });
});
