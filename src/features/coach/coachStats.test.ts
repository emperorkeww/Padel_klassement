import { describe, it, expect } from "vitest";
import {
  bagelNrDezeMaand,
  isVerliesRecord,
  isWinreeksRecord,
  nederlaagNrDezeMaand,
  piasNrDezeMaand,
  verliesFeiten,
  verliesreeksTegen,
} from "@/features/coach/coachStats";
import type { Match, Team } from "@/types";

// Teams: A = {p1,p2}, B = {p3,p4}, C = {p5,p6}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tC: { id: "tC", name: null, player1_id: "p5", player2_id: "p6", created_at: "" },
};

function match(part: Partial<Match> & { id: string; played_at: string }): Match {
  return {
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    created_by: null,
    created_at: part.played_at,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

// p1 (team A) verliest van B: L(6 jul), L(13 jul), en een winst ertussen zou de
// maandtelling niet raken maar wel de rivaal-reeks.
const verlies1 = match({ id: "l1", played_at: "2026-07-06T12:00:00Z", winner_team_id: "tB", score_a: 2, score_b: 6 });
const verlies2 = match({ id: "l2", played_at: "2026-07-13T12:00:00Z", winner_team_id: "tB", score_a: 4, score_b: 6 });
const verliesVorigeMaand = match({ id: "l0", played_at: "2026-06-28T12:00:00Z", winner_team_id: "tB", score_a: 1, score_b: 6 });

describe("nederlaagNrDezeMaand", () => {
  it("telt de nederlagen van de maand tot en met deze match", () => {
    const all = [verliesVorigeMaand, verlies1, verlies2];
    expect(nederlaagNrDezeMaand(all, teams, "p1", verlies1)).toBe(1);
    expect(nederlaagNrDezeMaand(all, teams, "p1", verlies2)).toBe(2);
  });

  it("laat de vorige maand buiten beschouwing", () => {
    const all = [verliesVorigeMaand, verlies1, verlies2];
    expect(nederlaagNrDezeMaand(all, teams, "p1", verliesVorigeMaand)).toBe(1);
  });

  it("is null als de speler deze match niet verloor", () => {
    expect(nederlaagNrDezeMaand([verlies1], teams, "p3", verlies1)).toBeNull();
  });
});

describe("bagelNrDezeMaand", () => {
  const bagel1 = match({ id: "b1", played_at: "2026-07-03T12:00:00Z", winner_team_id: "tB", score_a: 0, score_b: 6 });
  const bagel2 = match({ id: "b2", played_at: "2026-07-20T12:00:00Z", winner_team_id: "tB", score_a: 0, score_b: 6 });

  it("telt enkel bagel-nederlagen", () => {
    const all = [bagel1, verlies1, bagel2]; // verlies1 is 2-6, geen bagel
    expect(bagelNrDezeMaand(all, teams, "p1", bagel1)).toBe(1);
    expect(bagelNrDezeMaand(all, teams, "p1", bagel2)).toBe(2);
  });

  it("is null bij een niet-bagel nederlaag", () => {
    expect(bagelNrDezeMaand([verlies1], teams, "p1", verlies1)).toBeNull();
  });
});

describe("verliesreeksTegen", () => {
  it("telt opeenvolgende onderlinge nederlagen tot en met de match", () => {
    const all = [verlies1, verlies2];
    expect(verliesreeksTegen(all, teams, "p1", "p3", verlies2)).toBe(2);
    expect(verliesreeksTegen(all, teams, "p1", "p3", verlies1)).toBe(1);
  });

  it("breekt de reeks bij een tussentijdse winst", () => {
    const winst = match({ id: "w", played_at: "2026-07-10T12:00:00Z", winner_team_id: "tA", score_a: 6, score_b: 1 });
    const all = [verlies1, winst, verlies2];
    // p1 vs p3: L(6), W(10), L(13) → trailing vanaf 13 = 1.
    expect(verliesreeksTegen(all, teams, "p1", "p3", verlies2)).toBe(1);
  });

  it("negeert matches tegen een andere tegenstander", () => {
    const tegenC = match({ id: "c", played_at: "2026-07-14T12:00:00Z", team_b_id: "tC", winner_team_id: "tC", score_a: 3, score_b: 6 });
    const all = [verlies1, verlies2, tegenC];
    // De reeks tegen p3 blijft 2, ondanks de nederlaag tegen p5 erna.
    expect(verliesreeksTegen(all, teams, "p1", "p3", verlies2)).toBe(2);
  });
});

describe("isVerliesRecord", () => {
  it("herkent de grootste afgang ooit", () => {
    const all = [verlies1, verlies2, verliesVorigeMaand]; // marges 4, 2, 5
    expect(isVerliesRecord(all, teams, "p1", verliesVorigeMaand)).toBe(true); // 5 = grootste
    expect(isVerliesRecord(all, teams, "p1", verlies1)).toBe(false); // 4 < 5
  });

  it("is false zonder scores", () => {
    const geenScore = match({ id: "x", played_at: "2026-07-15T12:00:00Z", winner_team_id: "tB" });
    expect(isVerliesRecord([geenScore], teams, "p1", geenScore)).toBe(false);
  });
});

describe("isWinreeksRecord", () => {
  const w1 = match({ id: "w1", played_at: "2026-07-01T12:00:00Z", winner_team_id: "tA", score_a: 6, score_b: 1 });
  const w2 = match({ id: "w2", played_at: "2026-07-02T12:00:00Z", winner_team_id: "tA", score_a: 6, score_b: 2 });

  it("is waar als de reeks de langste ooit evenaart", () => {
    expect(isWinreeksRecord([w1, w2], teams, "p1", 2)).toBe(true);
  });

  it("is onwaar bij een langere reeks in het verleden", () => {
    // Historisch een reeks van 2, huidige reeks doorgegeven als 1.
    expect(isWinreeksRecord([w1, w2], teams, "p1", 1)).toBe(false);
  });
});

describe("piasNrDezeMaand", () => {
  const piasWeeks = [
    { playerId: "p1", weekStart: "2026-06-29" }, // andere maand
    { playerId: "p1", weekStart: "2026-07-06" },
    { playerId: "p1", weekStart: "2026-07-13" },
    { playerId: "p2", weekStart: "2026-07-06" }, // andere speler
  ];

  it("telt de piassen van de maand tot en met deze week", () => {
    expect(piasNrDezeMaand(piasWeeks, "p1", "2026-07-06")).toBe(1);
    expect(piasNrDezeMaand(piasWeeks, "p1", "2026-07-13")).toBe(2);
  });

  it("negeert andere maanden en andere spelers", () => {
    expect(piasNrDezeMaand(piasWeeks, "p1", "2026-06-29")).toBe(1);
    expect(piasNrDezeMaand(piasWeeks, "p2", "2026-07-06")).toBe(1);
  });
});

describe("verliesFeiten", () => {
  it("bundelt marge, herhaling, record en rivaal", () => {
    const all = [verliesVorigeMaand, verlies1, verlies2];
    const f = verliesFeiten(verlies2, all, teams, (id) => (id === "p3" ? "Rick" : id));
    expect(f).not.toBeNull();
    expect(f!.marge).toBe(2);
    expect(f!.nederlaagNr).toBe(2); // 2e nederlaag in juli
    expect(f!.record).toBe(false); // verlies2 (marge 2) is niet de grootste afgang
    expect(f!.rivaal).toEqual({ count: 3, naam: "Rick" }); // reeks telt door over maanden heen
  });

  it("meldt een rivaal pas vanaf twee nederlagen op rij", () => {
    const f = verliesFeiten(verlies1, [verlies1], teams);
    expect(f!.rivaal).toBeNull(); // één onderlinge nederlaag telt nog niet
  });

  it("is null zonder verliezers (geen afgeronde match)", () => {
    const gepland = match({ id: "p", played_at: "2026-07-15T12:00:00Z", status: "scheduled", winner_team_id: null });
    expect(verliesFeiten(gepland, [gepland], teams)).toBeNull();
  });
});
