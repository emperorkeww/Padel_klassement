import { describe, expect, it } from "vitest";
import {
  NIPT_MARGE,
  PECHMETER_DOEL,
  TROOST_MAX,
  isNipteNederlaag,
  isNipteUitslag,
  pechMeter,
} from "./pechvogel";
import type { Match, Team } from "@/types";

// Spiegel-tests: dezelfde gevallen als supabase/tests/pechvogel_test.sql, zodat
// de meter op het profiel en de demper die de databank uitkeert niet uit elkaar
// kunnen lopen.

// Vier spelers, twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  const dag = String(seq).padStart(2, "0");
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    played_at: `2026-08-${dag}T12:00:00Z`,
    created_by: null,
    created_at: `2026-08-${dag}T12:00:00Z`,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    format: "2v2",
    ...part,
  } as Match;
}

/** Nipt verlies voor team A (dus voor p1/p2). */
const nipt = (a = 6, b = 7) =>
  match({ winner_team_id: "tB", score_a: a, score_b: b });
/** Afdroging voor team A. */
const afdroging = () => match({ winner_team_id: "tB", score_a: 2, score_b: 7 });
/** Zege voor team A. */
const zege = () => match({ winner_team_id: "tA", score_a: 7, score_b: 5 });
/** Gelijkspel. */
const gelijk = () => match({ winner_team_id: null, score_a: 6, score_b: 6 });

describe("constanten", () => {
  it("spiegelen de databasewaarden", () => {
    expect(NIPT_MARGE).toBe(2);
    expect(PECHMETER_DOEL).toBe(3);
    expect(TROOST_MAX).toBe(4);
  });
});

describe("isNipteUitslag", () => {
  it("herkent één en twee punten verschil", () => {
    expect(isNipteUitslag(nipt(6, 7))).toBe(true);
    expect(isNipteUitslag(nipt(5, 7))).toBe(true);
  });

  it("noemt drie of meer verschil geen pech", () => {
    expect(isNipteUitslag(match({ score_a: 4, score_b: 7 }))).toBe(false);
    expect(isNipteUitslag(afdroging())).toBe(false);
  });

  it("telt een gelijkspel niet mee", () => {
    expect(isNipteUitslag(gelijk())).toBe(false);
  });

  it("kan zonder scores niets zeggen", () => {
    expect(isNipteUitslag(match({}))).toBe(false);
    expect(isNipteUitslag(match({ score_a: 6, score_b: null }))).toBe(false);
  });
});

describe("isNipteNederlaag", () => {
  it("geldt alleen voor de verliezer", () => {
    const m = nipt();
    expect(isNipteNederlaag(m, teams, "p1")).toBe(true);
    expect(isNipteNederlaag(m, teams, "p3")).toBe(false);
  });

  it("geldt niet voor wie niet meedeed", () => {
    expect(isNipteNederlaag(nipt(), teams, "vreemde")).toBe(false);
  });
});

describe("pechMeter", () => {
  it("staat leeg zonder matches", () => {
    expect(pechMeter([], teams, "p1")).toEqual({ reeks: 0, stand: 0, vol: false });
  });

  it("loopt vol bij de derde nipte nederlaag op rij", () => {
    const ms = [nipt(), nipt(5, 7), nipt()];
    expect(pechMeter(ms.slice(0, 1), teams, "p1").stand).toBe(1);
    expect(pechMeter(ms.slice(0, 2), teams, "p1").stand).toBe(2);
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 3, stand: 3, vol: true });
  });

  it("blijft na de uitbetaling op vol staan tot er weer gespeeld wordt", () => {
    // Vier op rij: de meter is één keer uitgekeerd en telt daarna opnieuw.
    const ms = [nipt(), nipt(), nipt(), nipt()];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 4, stand: 1, vol: false });
  });

  it("loopt bij de zesde opnieuw vol", () => {
    const ms = [nipt(), nipt(), nipt(), nipt(), nipt(), nipt()];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 6, stand: 3, vol: true });
  });

  it("breekt op een afdroging", () => {
    const ms = [nipt(), nipt(), afdroging()];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 0, stand: 0, vol: false });
  });

  it("breekt op een zege", () => {
    const ms = [nipt(), nipt(), zege()];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 0, stand: 0, vol: false });
  });

  it("breekt op een gelijkspel", () => {
    const ms = [nipt(), nipt(), gelijk()];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 0, stand: 0, vol: false });
  });

  it("breekt op een verlies zonder score", () => {
    const ms = [nipt(), nipt(), match({ winner_team_id: "tB" })];
    expect(pechMeter(ms, teams, "p1")).toEqual({ reeks: 0, stand: 0, vol: false });
  });

  it("telt vanaf de recentste match terug, niet vanaf de oudste", () => {
    // Oud: drie nipte nederlagen. Recent: een zege. De meter staat leeg.
    const ms = [nipt(), nipt(), nipt(), zege()];
    expect(pechMeter(ms, teams, "p1").vol).toBe(false);
  });

  it("laat matches van andere spelers de meter niet breken", () => {
    const anderen: Record<string, Team> = {
      ...teams,
      tC: { id: "tC", name: null, player1_id: "p5", player2_id: "p6", created_at: "" },
      tD: { id: "tD", name: null, player1_id: "p7", player2_id: "p8", created_at: "" },
    };
    const ms = [
      nipt(),
      nipt(),
      match({ team_a_id: "tC", team_b_id: "tD", winner_team_id: "tC", score_a: 7, score_b: 1 }),
      nipt(),
    ];
    expect(pechMeter(ms, anderen, "p1")).toEqual({ reeks: 3, stand: 3, vol: true });
  });

  it("negeert nog niet afgeronde matches", () => {
    const ms = [
      nipt(),
      nipt(),
      match({ status: "scheduled", winner_team_id: null }),
      nipt(),
    ];
    expect(pechMeter(ms, teams, "p1").vol).toBe(true);
  });

  it("ziet de meter van de tegenstander leeg blijven", () => {
    const ms = [nipt(), nipt(), nipt()];
    expect(pechMeter(ms, teams, "p3")).toEqual({ reeks: 0, stand: 0, vol: false });
  });
});
