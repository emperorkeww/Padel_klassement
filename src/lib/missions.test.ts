import { describe, it, expect } from "vitest";
import {
  MISSIE_POOL,
  deriveMissions,
  evalueerMissie,
  perfecteWeken,
  weekIndex,
  weekStartOf,
} from "./missions";
import type { MissieDef } from "./missions";
import type { Match, Team } from "@/types";

// Vast anker: woensdag 8 juli 2026 → doelweek ma 6 t/m zo 12 juli.
const NOW = new Date("2026-07-08T12:00:00");

// p1 speelt in drie teams: vast met p2 (tA) en los met p5/p6 (tC/tD).
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tC: { id: "tC", name: null, player1_id: "p1", player2_id: "p5", created_at: "" },
  tD: { id: "tD", name: null, player1_id: "p1", player2_id: "p6", created_at: "" },
};

let seq = 0;
/** Afgewerkte match op een expliciet lokaal tijdstip; tA wint tenzij anders. */
function op(iso: string, part: Partial<Match> = {}): Match {
  seq += 1;
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: "tA",
    played_at: iso,
    created_by: null,
    created_at: iso,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

function pool(id: string): MissieDef {
  const def = MISSIE_POOL.find((d) => d.id === id);
  if (!def) throw new Error(`missie ${id} ontbreekt in de pool`);
  return def;
}

const meet = (id: string, matches: Match[], playerId = "p1") =>
  evalueerMissie(pool(id), matches, teams, playerId, NOW).voortgang.nu;

describe("weekhelpers", () => {
  it("weekIndex: opeenvolgende weken verschillen exact 1, binnen de week 0", () => {
    const ma = new Date("2026-07-06T00:30:00");
    const zo = new Date("2026-07-12T23:30:00");
    const volgendeMa = new Date("2026-07-13T08:00:00");
    expect(weekIndex(zo)).toBe(weekIndex(ma));
    expect(weekIndex(volgendeMa)).toBe(weekIndex(ma) + 1);
  });

  it("weekStartOf geeft de maandag van de week op 12:00", () => {
    const start = weekStartOf(NOW);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(6);
    expect(start.getMonth()).toBe(6);
    expect(start.getHours()).toBe(12);
  });
});

describe("deriveMissions — keuze per week", () => {
  it("is deterministisch en voor iedereen gelijk: 3 missies uit 3 categorieën", () => {
    const a = deriveMissions([], teams, "p1", NOW);
    const b = deriveMissions([], teams, "p1", NOW);
    const ander = deriveMissions([], teams, "p3", NOW);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(a.map((m) => m.id)).toEqual(ander.map((m) => m.id));
    expect(a).toHaveLength(3);
    const cats = a.map((m) => pool(m.id).categorie);
    expect(new Set(cats).size).toBe(3);
    // Zonder matches: niets behaald, voortgang aanwezig en op 0.
    for (const m of a) {
      expect(m.behaald).toBe(false);
      expect(m.voortgang.nu).toBe(0);
      expect(m.voortgang.doel).toBeGreaterThan(0);
    }
  });

  it("kiest in een andere week (mogelijk) een ander, maar geldig trio", () => {
    const volgendeWeek = new Date("2026-07-15T12:00:00");
    const m = deriveMissions([], teams, "p1", volgendeWeek);
    expect(m).toHaveLength(3);
    for (const missie of m) expect(() => pool(missie.id)).not.toThrow();
    expect(new Set(m.map((x) => pool(x.id).categorie)).size).toBe(3);
  });

  it("varieert de keuze over de weken heen (seed doet iets)", () => {
    // Over een half jaar aan weken verwachten we meer dan één uniek trio.
    const trios = new Set<string>();
    for (let w = 0; w < 26; w++) {
      const dag = new Date(2026, 0, 5 + w * 7, 12); // maandagen vanaf 5 jan
      trios.add(deriveMissions([], teams, "p1", dag).map((m) => m.id).join("|"));
    }
    expect(trios.size).toBeGreaterThan(1);
  });
});

describe("missiepool — meet() per missie", () => {
  it("volume: telt de matches van de week", () => {
    const matches = [
      op("2026-07-06T10:00:00"),
      op("2026-07-07T18:00:00"),
      op("2026-06-30T10:00:00"), // vorige week telt niet
    ];
    expect(meet("twee-matches", matches)).toBe(2);
    expect(meet("drie-matches", matches)).toBe(2);
  });

  it("nieuwe-tandem: alleen partners die vóór de week nog nooit meededen", () => {
    const bekendePartner = [
      op("2026-06-29T10:00:00"), // eerder met p2 (tA)
      op("2026-07-06T10:00:00"), // deze week weer met p2
    ];
    expect(meet("nieuwe-tandem", bekendePartner)).toBe(0);

    const nieuwePartner = [
      op("2026-06-29T10:00:00"),
      op("2026-07-06T10:00:00", { team_a_id: "tC", winner_team_id: "tC" }), // p5 is nieuw
    ];
    expect(meet("nieuwe-tandem", nieuwePartner)).toBe(1);
  });

  it("twee-partners: distinct partners binnen de week", () => {
    const matches = [
      op("2026-07-06T10:00:00"), // partner p2
      op("2026-07-07T10:00:00"), // partner p2 (zelfde)
      op("2026-07-08T10:00:00", { team_a_id: "tC", winner_team_id: "tC" }), // p5
    ];
    expect(meet("twee-partners", matches)).toBe(2);
  });

  it("ruime-winst: vereist winst én ingevulde scores met 3+ verschil", () => {
    expect(meet("ruime-winst", [op("2026-07-06T10:00:00", { score_a: 6, score_b: 1 })])).toBe(1);
    expect(meet("ruime-winst", [op("2026-07-06T10:00:00", { score_a: 6, score_b: 4 })])).toBe(0);
    expect(meet("ruime-winst", [op("2026-07-06T10:00:00")])).toBe(0); // geen scores
    expect(
      meet("ruime-winst", [
        op("2026-07-06T10:00:00", { winner_team_id: "tB", score_a: 1, score_b: 6 }),
      ]),
    ).toBe(0); // ruim verliezen telt niet
  });

  it("winst-na-verlies: het verlies mag vóór de week vallen, de winst niet", () => {
    const overDeWeekgrens = [
      op("2026-07-03T10:00:00", { winner_team_id: "tB" }), // vorige week: verlies
      op("2026-07-06T10:00:00"), // deze week: winst → telt
    ];
    expect(meet("winst-na-verlies", overDeWeekgrens)).toBe(1);

    const naWinst = [
      op("2026-07-03T10:00:00"), // vorige week: winst
      op("2026-07-06T10:00:00"), // deze week: winst → telt niet
    ];
    expect(meet("winst-na-verlies", naWinst)).toBe(0);

    const winstInVorigeWeek = [
      op("2026-07-02T10:00:00", { winner_team_id: "tB" }),
      op("2026-07-03T10:00:00"), // comeback viel vórige week → telt hier niet
    ];
    expect(meet("winst-na-verlies", winstInVorigeWeek)).toBe(0);
  });

  it("ludiek: dag- en uurgrenzen", () => {
    // Vroege shift: weekdag vóór 19u.
    expect(meet("voor-19u", [op("2026-07-06T18:59:00")])).toBe(1);
    expect(meet("voor-19u", [op("2026-07-06T19:00:00")])).toBe(0);
    expect(meet("voor-19u", [op("2026-07-11T10:00:00")])).toBe(0); // zaterdag

    // Vliegende start: ma/di/wo.
    expect(meet("voor-donderdag", [op("2026-07-08T20:00:00")])).toBe(1); // woensdag
    expect(meet("voor-donderdag", [op("2026-07-09T10:00:00")])).toBe(0); // donderdag

    // Weekendrondje: za/zo.
    expect(meet("weekend-match", [op("2026-07-12T10:00:00")])).toBe(1); // zondag
    expect(meet("weekend-match", [op("2026-07-10T10:00:00")])).toBe(0); // vrijdag
  });
});

describe("perfecteWeken", () => {
  // Een "vette week" dekt alle negen missies tegelijk, zodat de telling
  // niet afhangt van welk trio de seed voor die week trekt.
  // Vereist: een verlies vlak vóór de maandagwinst (boemerang) en een
  // partner die nog nooit eerder meedeed (verse tandem).
  const vetteWeek = (maandagIso: string, nieuwTeam: string): Match[] => {
    const ma = new Date(maandagIso);
    const dag = (offset: number, tijd: string) => {
      const d = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + offset);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd}T${tijd}`;
    };
    return [
      // ma 10u: ruime winst met de nieuwe partner, meteen na het verlies.
      op(dag(0, "10:00:00"), {
        team_a_id: nieuwTeam,
        winner_team_id: nieuwTeam,
        score_a: 6,
        score_b: 1,
      }),
      // di 18u: tweede partner (vaste team tA).
      op(dag(1, "18:00:00")),
      // za: weekendmatch, verlies zodat de vólgende vette week ook een
      // boemerang-aanloop heeft.
      op(dag(5, "10:00:00"), { winner_team_id: "tB" }),
    ];
  };

  // Aanloopverlies in de week vóór de eerste vette week.
  const aanloop = op("2026-07-03T20:00:00", { winner_team_id: "tB" });

  it("een vette week dekt de volledige pool en telt als perfect", () => {
    const matches = [aanloop, ...vetteWeek("2026-07-06T12:00:00", "tC")];
    for (const def of MISSIE_POOL) {
      expect(
        evalueerMissie(def, matches, teams, "p1", NOW).behaald,
        `missie ${def.id} hoort behaald te zijn`,
      ).toBe(true);
    }
    // De aanloopweek (één verliesmatch) is nooit perfect: er is altijd een
    // volume- of prestatiemissie in het trio en die vraagt spelen/winnen.
    expect(perfecteWeken(matches, teams, "p1")).toBe(1);
  });

  it("telt meerdere perfecte weken op, magere weken niet", () => {
    const matches = [
      aanloop,
      ...vetteWeek("2026-07-06T12:00:00", "tC"), // week 1: p5 nieuw
      ...vetteWeek("2026-07-13T12:00:00", "tD"), // week 2: p6 nieuw
    ];
    expect(perfecteWeken(matches, teams, "p1")).toBe(2);
  });

  it("geeft 0 zonder matches en voor een week met alleen een verlies", () => {
    expect(perfecteWeken([], teams, "p1")).toBe(0);
    // Elk trio bevat volume óf prestatie (hoogstens één categorie valt af),
    // dus één enkel verlies kan nooit een perfecte week opleveren — welk
    // trio de seed ook trekt.
    const magereWeek = [op("2026-06-28T20:00:00", { winner_team_id: "tB" })];
    expect(perfecteWeken(magereWeek, teams, "p1")).toBe(0);
  });
});
