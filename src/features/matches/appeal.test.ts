import { describe, it, expect } from "vitest";
import {
  TOELICHTING_MAX,
  VENSTER_UREN,
  appealBlokkade,
  appealFoutMelding,
  blokkadeUitleg,
  deelnemersVan,
  draaitWinnaarOm,
  kantVan,
  naCorrectie,
  stemStand,
  stemgerechtigden,
  tegoedOp,
  type PointAppeal,
  type PointAppealVote,
} from "@/features/matches/appeal";
import { playDay } from "@/features/matches/stakes";
import type { Match, Team } from "@/types";

const EEN_UUR_GELEDEN = new Date(Date.now() - 3600_000).toISOString();

function match(over: Partial<Match> = {}): Match {
  return {
    id: "m1",
    team_a_id: "t-ab",
    team_b_id: "t-cd",
    status: "completed",
    winner_team_id: "t-ab",
    score_a: 16,
    score_b: 15,
    played_at: EEN_UUR_GELEDEN,
    created_at: EEN_UUR_GELEDEN,
    created_by: "p1",
    group_id: "g1",
    round_number: null,
    format: "2v2",
    ...over,
  } as Match;
}

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", player1_id: "p1", player2_id: "p2" } as Team,
  "t-cd": { id: "t-cd", player1_id: "p3", player2_id: "p4" } as Team,
  "t-solo": { id: "t-solo", player1_id: "p1", player2_id: null } as Team,
  "t-gast": { id: "t-gast", player1_id: "g1", player2_id: null } as Team,
};

function appeal(over: Partial<PointAppeal> = {}): PointAppeal {
  return {
    id: "a1",
    match_id: "m1",
    claimant_id: "p3",
    set_number: null,
    reden: "ons-punt",
    toelichting: null,
    status: "open",
    snapshot_a: 16,
    snapshot_b: 15,
    play_date: playDay(EEN_UUR_GELEDEN),
    votes_close_at: new Date(Date.now() + 3600_000).toISOString(),
    resolved_at: null,
    created_at: EEN_UUR_GELEDEN,
    ...over,
  };
}

function stem(voter: string, akkoord: boolean): PointAppealVote {
  return {
    appeal_id: "a1",
    voter_id: voter,
    akkoord,
    created_at: EEN_UUR_GELEDEN,
  };
}

describe("kantVan / deelnemersVan", () => {
  it("vindt de kant van een speler", () => {
    expect(kantVan(match(), TEAMS, "p1")).toBe("a");
    expect(kantVan(match(), TEAMS, "p4")).toBe("b");
    expect(kantVan(match(), TEAMS, "p9")).toBeNull();
  });

  it("laat lege plekken van een singles weg", () => {
    const m = match({ team_a_id: "t-solo", team_b_id: "t-gast" });
    expect(deelnemersVan(m, TEAMS)).toEqual(["p1", "g1"]);
  });
});

describe("stemgerechtigden", () => {
  it("zijn de andere deelnemers, tegenpartij inbegrepen", () => {
    expect(
      stemgerechtigden({ match: match(), teams: TEAMS, claimantId: "p3" }),
    ).toEqual(["p1", "p2", "p4"]);
  });

  it("laat gasten weg: die stemmen nooit", () => {
    const m = match({ team_a_id: "t-solo", team_b_id: "t-gast" });
    expect(
      stemgerechtigden({
        match: m,
        teams: TEAMS,
        claimantId: "p1",
        isGast: (id) => id === "g1",
      }),
    ).toEqual([]);
  });
});

describe("appealBlokkade", () => {
  const basis = { match: match(), teams: TEAMS, claimantId: "p3" };

  it("laat een deelnemer binnen het venster betwisten", () => {
    expect(appealBlokkade(basis)).toBeNull();
  });

  it("weigert een niet-deelnemer", () => {
    expect(appealBlokkade({ ...basis, claimantId: "p9" })).toBe("geen-deelnemer");
  });

  it("weigert een match die nog niet afgerond is", () => {
    expect(
      appealBlokkade({ ...basis, match: match({ status: "scheduled" }) }),
    ).toBe("niet-afgerond");
  });

  it("weigert een match zonder ingevulde uitslag", () => {
    expect(
      appealBlokkade({
        ...basis,
        match: match({ score_a: null, score_b: null }),
      }),
    ).toBe("geen-uitslag");
  });

  it("sluit na 24 uur", () => {
    const oud = match({
      played_at: new Date(
        Date.now() - (VENSTER_UREN + 1) * 3600_000,
      ).toISOString(),
    });
    expect(appealBlokkade({ ...basis, match: oud })).toBe("venster-dicht");
  });

  it("weigert een punt te halen bij een team dat er geen heeft", () => {
    expect(
      appealBlokkade({ ...basis, match: match({ score_a: 0, score_b: 12 }) }),
    ).toBe("geen-punt-te-halen");
  });

  it("laat maar één beroep tegelijk toe", () => {
    expect(appealBlokkade({ ...basis, openAppeal: appeal() })).toBe(
      "beroep-loopt",
    );
  });

  it("negeert een afgehandeld beroep op dezelfde match", () => {
    expect(
      appealBlokkade({ ...basis, openAppeal: appeal({ status: "afgewezen" }) }),
    ).toBeNull();
  });

  it("weigert zodra het tegoed van de speeldag op is", () => {
    expect(
      appealBlokkade({
        ...basis,
        eigenAppeals: [appeal({ status: "toegekend", match_id: "m9" })],
      }),
    ).toBe("tegoed-op");
  });

  it("kost een afgewezen beroep geen tegoed", () => {
    expect(
      appealBlokkade({
        ...basis,
        eigenAppeals: [appeal({ status: "afgewezen", match_id: "m9" })],
      }),
    ).toBeNull();
  });

  it("weigert als er niemand is om te overtuigen", () => {
    const m = match({ team_a_id: "t-solo", team_b_id: "t-gast", score_b: 2 });
    expect(
      appealBlokkade({
        match: m,
        teams: TEAMS,
        claimantId: "p1",
        isGast: (id) => id === "g1",
      }),
    ).toBe("geen-stemmers");
  });
});

describe("tegoedOp", () => {
  it("kijkt alleen naar toekenningen van dezelfde speeldag", () => {
    const dag = playDay(EEN_UUR_GELEDEN);
    expect(tegoedOp([appeal({ status: "toegekend" })], dag)).toBe(true);
    expect(tegoedOp([appeal({ status: "toegekend" })], "2020-01-01")).toBe(
      false,
    );
    expect(tegoedOp([appeal({ status: "verlopen" })], dag)).toBe(false);
  });
});

describe("naCorrectie", () => {
  it("verschuift één punt naar de klager", () => {
    const na = naCorrectie({ match: match(), kant: "b" })!;
    expect([na.scoreA, na.scoreB]).toEqual([15, 16]);
  });

  it("draait de winnaar om als de kopscore kantelt", () => {
    const m = match();
    const na = naCorrectie({ match: m, kant: "b" })!;
    expect(na.winnerTeamId).toBe("t-cd");
    expect(draaitWinnaarOm(m, na)).toBe(true);
  });

  it("laat de winnaar staan bij een ruime voorsprong", () => {
    const m = match({ score_a: 20, score_b: 10 });
    const na = naCorrectie({ match: m, kant: "a" })!;
    expect([na.scoreA, na.scoreB]).toEqual([21, 9]);
    expect(na.winnerTeamId).toBe("t-ab");
    expect(draaitWinnaarOm(m, na)).toBe(false);
  });

  it("maakt van een gelijke stand een gelijkspel", () => {
    const m = match({ score_a: 6, score_b: 4 });
    const na = naCorrectie({ match: m, kant: "b" })!;
    expect([na.scoreA, na.scoreB]).toEqual([5, 5]);
    expect(na.winnerTeamId).toBeNull();
  });

  it("laat de gekozen set meebewegen en de rest ongemoeid", () => {
    const m = match({ score_a: 2, score_b: 1 });
    const na = naCorrectie({
      match: m,
      kant: "b",
      setNumber: 2,
      sets: [
        [6, 4],
        [3, 6],
        [7, 5],
      ],
    })!;
    expect(na.sets).toEqual([
      [6, 4],
      [2, 7],
      [7, 5],
    ]);
  });

  it("weigert een correctie die onder nul zou zakken", () => {
    expect(naCorrectie({ match: match({ score_a: 5, score_b: 0 }), kant: "a" }))
      .toBeNull();
    expect(
      naCorrectie({
        match: match({ score_a: 5, score_b: 3 }),
        kant: "a",
        setNumber: 1,
        sets: [[5, 0]],
      }),
    ).toBeNull();
  });

  it("geeft niets terug zonder uitslag", () => {
    expect(
      naCorrectie({ match: match({ score_a: null, score_b: null }), kant: "a" }),
    ).toBeNull();
  });
});

describe("stemStand", () => {
  const kiezers = ["p1", "p2", "p4"];

  it("beslist nog niets na één stem van de drie", () => {
    const s = stemStand([stem("p1", true)], kiezers);
    expect(s).toMatchObject({ voor: 1, tegen: 0, open: 2, beslist: null });
    expect(s.nogNodig).toBe(1);
  });

  it("kent toe bij een strikte meerderheid", () => {
    expect(
      stemStand([stem("p1", true), stem("p4", true)], kiezers).beslist,
    ).toBe("toegekend");
  });

  it("wijst af zodra de meerderheid niet meer haalbaar is", () => {
    expect(
      stemStand([stem("p1", false), stem("p2", false)], kiezers).beslist,
    ).toBe("afgewezen");
  });

  it("telt alleen de stemmen van stemgerechtigden", () => {
    expect(stemStand([stem("p9", true), stem("p3", true)], kiezers)).toMatchObject(
      { voor: 0, tegen: 0, open: 3, beslist: null },
    );
  });

  it("wijst af bij gelijkspel onder een even aantal kiezers", () => {
    expect(
      stemStand([stem("p1", true), stem("p2", false)], ["p1", "p2"]).beslist,
    ).toBe("afgewezen");
  });
});

describe("appealFoutMelding", () => {
  it("vertaalt de botsing op het open-beroep", () => {
    expect(
      appealFoutMelding({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "point_appeals_one_open_per_match_uidx"',
      }),
    ).toBe(blokkadeUitleg("beroep-loopt"));
  });

  it("vertaalt de botsing op het tegoed", () => {
    expect(
      appealFoutMelding({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "point_appeals_tegoed_uidx"',
      }),
    ).toBe(blokkadeUitleg("tegoed-op"));
  });

  it("laat een guard-melding ongemoeid", () => {
    expect(appealFoutMelding({ message: "de stemming is gesloten" })).toBe(
      "de stemming is gesloten",
    );
  });

  it("valt terug op een nette zin", () => {
    expect(appealFoutMelding(null)).toMatch(/niet door/);
  });
});

describe("constanten", () => {
  it("staan in de pas met de databank", () => {
    expect(VENSTER_UREN).toBe(24);
    expect(TOELICHTING_MAX).toBe(140);
  });
});
