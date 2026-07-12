import { describe, it, expect } from "vitest";
import { deriveBadges, REUZENDODER_DREMPEL } from "./badges";
import type { Badge } from "./badges";
import type { Match, PlayerRating, Team } from "./types";

// Vier spelers, twee vaste teams: A = {p1,p2}, B = {p3,p4}.
const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
};

let seq = 0;
function match(part: Partial<Match>): Match {
  seq += 1;
  // Strikt oplopende tijdstempels: de volgorde in de array is de speelvolgorde.
  const ts = new Date(Date.UTC(2026, 0, 1) + seq * 60_000).toISOString();
  return {
    id: `m${seq}`,
    team_a_id: "tA",
    team_b_id: "tB",
    status: "completed",
    winner_team_id: null,
    played_at: ts,
    created_by: null,
    created_at: ts,
    group_id: null,
    round_number: null,
    score_a: null,
    score_b: null,
    ...part,
  };
}

const win = () => match({ winner_team_id: "tA" });
const loss = () => match({ winner_team_id: "tB" });

function ratingsFor(perPlayer: Record<string, number>): Record<string, PlayerRating> {
  return Object.fromEntries(
    Object.entries(perPlayer).map(([id, rating]) => [
      id,
      { player_id: id, rating, games: 1, updated_at: "" },
    ]),
  );
}

function badge(badges: Badge[], id: string): Badge {
  const b = badges.find((x) => x.id === id);
  if (!b) throw new Error(`badge ${id} ontbreekt`);
  return b;
}

describe("deriveBadges — lege input", () => {
  it("geeft de volledige set terug, niets behaald, voortgang 0", () => {
    const badges = deriveBadges([], teams, "p1");
    expect(badges).toHaveLength(86);
    expect(badges.every((b) => !b.behaald)).toBe(true);
    expect(badge(badges, "matches-10").voortgang).toEqual({ nu: 0, doel: 10 });
    expect(badge(badges, "reeks-3").voortgang).toEqual({ nu: 0, doel: 3 });
    expect(badge(badges, "perfecte-weken-10").voortgang).toEqual({ nu: 0, doel: 10 });
  });
});

describe("deriveBadges — perfecte weken (#118)", () => {
  it("kent 'Perfecte week' toe na één week met alle weekmissies gehaald", () => {
    // Vette week: dekt de volledige missiepool ongeacht het geseede trio —
    // zie missions.test.ts. Verlies vooraf voor de boemerang, ma-winst 6-1
    // met een verse partner (tC), tweede partner op di, weekendmatch op za.
    const tC: Team = { id: "tC", name: null, player1_id: "p1", player2_id: "p5", created_at: "" };
    const alleTeams = { ...teams, tC };
    const op = (iso: string, part: Partial<Match> = {}) =>
      match({ played_at: iso, created_at: iso, ...part });
    const vetteWeek = [
      op("2026-07-03T20:00:00", { winner_team_id: "tB" }),
      op("2026-07-06T10:00:00", { team_a_id: "tC", winner_team_id: "tC", score_a: 6, score_b: 1 }),
      op("2026-07-07T18:00:00", { winner_team_id: "tA" }),
      op("2026-07-11T10:00:00", { winner_team_id: "tA" }),
    ];
    const badges = deriveBadges(vetteWeek, alleTeams, "p1");
    expect(badge(badges, "perfecte-weken-1").behaald).toBe(true);
    expect(badge(badges, "perfecte-weken-10").behaald).toBe(false);
    expect(badge(badges, "perfecte-weken-10").voortgang).toEqual({ nu: 1, doel: 10 });
  });
});

describe("deriveBadges — mijlpalen", () => {
  it("telt alleen afgewerkte matches waarin de speler meedeed", () => {
    const gepland = match({ status: "scheduled", winner_team_id: null });
    const zonderMij = match({
      team_a_id: "tX",
      team_b_id: "tB",
      winner_team_id: "tB",
    });
    const badges = deriveBadges([loss(), gepland, zonderMij], teams, "p1");
    expect(badge(badges, "matches-10").voortgang).toEqual({ nu: 1, doel: 10 });
  });

  it("kent 'Vaste klant' toe bij precies 10 matches, de rest nog niet", () => {
    const tien = Array.from({ length: 10 }, loss);
    const badges = deriveBadges(tien, teams, "p1");
    expect(badge(badges, "matches-10").behaald).toBe(true);
    expect(badge(badges, "matches-25").behaald).toBe(false);
    expect(badge(badges, "matches-25").voortgang).toEqual({ nu: 10, doel: 25 });
  });

  it("blijft niet-behaald bij 9 matches", () => {
    const negen = Array.from({ length: 9 }, loss);
    expect(badge(deriveBadges(negen, teams, "p1"), "matches-10").behaald).toBe(false);
  });

  it("kent alle mijlpalen toe bij 100 matches", () => {
    const honderd = Array.from({ length: 100 }, win);
    const badges = deriveBadges(honderd, teams, "p1");
    for (const id of ["matches-10", "matches-25", "matches-50", "matches-100"])
      expect(badge(badges, id).behaald).toBe(true);
  });
});

describe("deriveBadges — winreeksen", () => {
  it("kent bij een reeks van exact 5 'Hattrick' en 'On fire' toe, 'Onstuitbaar' niet", () => {
    // Verlies errond: de reeks is exact 5 en niet de huidige reeks.
    const matches = [loss(), win(), win(), win(), win(), win(), loss()];
    const badges = deriveBadges(matches, teams, "p1");
    expect(badge(badges, "reeks-3").behaald).toBe(true);
    expect(badge(badges, "reeks-5").behaald).toBe(true);
    expect(badge(badges, "reeks-10").behaald).toBe(false);
    expect(badge(badges, "reeks-10").voortgang).toEqual({ nu: 5, doel: 10 });
  });

  it("kent geen reeksbadge toe bij 2 winsten op rij", () => {
    const badges = deriveBadges([win(), win(), loss()], teams, "p1");
    expect(badge(badges, "reeks-3").behaald).toBe(false);
    expect(badge(badges, "reeks-3").voortgang).toEqual({ nu: 2, doel: 3 });
  });
});

describe("deriveBadges — eerste overwinning", () => {
  it("wordt behaald na één winst en heeft geen telbare voortgang", () => {
    const met = deriveBadges([win()], teams, "p1");
    const zonder = deriveBadges([loss()], teams, "p1");
    expect(badge(met, "eerste-overwinning").behaald).toBe(true);
    expect(badge(met, "eerste-overwinning").voortgang).toBeUndefined();
    expect(badge(zonder, "eerste-overwinning").behaald).toBe(false);
  });
});

describe("deriveBadges — reuzendoder", () => {
  const winst = [win()];

  it("wordt behaald bij winst tegen een team dat gemiddeld exact de drempel hoger staat", () => {
    const ratings = ratingsFor({
      p1: 1000,
      p2: 1000,
      p3: 1000 + REUZENDODER_DREMPEL,
      p4: 1000 + REUZENDODER_DREMPEL,
    });
    expect(badge(deriveBadges(winst, teams, "p1", ratings), "reuzendoder").behaald).toBe(true);
  });

  it("blijft niet-behaald nét onder de drempel", () => {
    const ratings = ratingsFor({
      p1: 1000,
      p2: 1000,
      p3: 1000 + REUZENDODER_DREMPEL,
      p4: 1000 + REUZENDODER_DREMPEL - 1,
    });
    expect(badge(deriveBadges(winst, teams, "p1", ratings), "reuzendoder").behaald).toBe(false);
  });

  it("telt verliezen tegen reuzen niet mee", () => {
    const ratings = ratingsFor({ p1: 1000, p2: 1000, p3: 1200, p4: 1200 });
    expect(badge(deriveBadges([loss()], teams, "p1", ratings), "reuzendoder").behaald).toBe(false);
  });

  it("blijft niet-behaald zonder ratings of met een ontbrekende rating", () => {
    expect(badge(deriveBadges(winst, teams, "p1"), "reuzendoder").behaald).toBe(false);
    expect(badge(deriveBadges(winst, teams, "p1", {}), "reuzendoder").behaald).toBe(false);
    // p4 heeft geen rating → tegenteam-gemiddelde onbekend → telt niet.
    const deels = ratingsFor({ p1: 1000, p2: 1000, p3: 1300 });
    expect(badge(deriveBadges(winst, teams, "p1", deels), "reuzendoder").behaald).toBe(false);
  });
});

describe("deriveBadges — extra badges", () => {
  // Lokale Date → ISO, zodat getDay()/getHours() deterministisch zijn los van TZ.
  const at = (y: number, mo: number, d: number, h: number) =>
    new Date(y, mo, d, h, 0).toISOString();

  it("Diplomaat: behaald bij een gelijkspel (geen winnaar)", () => {
    const gelijk = match({ winner_team_id: null });
    expect(badge(deriveBadges([gelijk], teams, "p1"), "diplomaat").behaald).toBe(true);
    expect(badge(deriveBadges([win()], teams, "p1"), "diplomaat").behaald).toBe(false);
  });

  it("Weekendstrijder: behaald bij een match in het weekend", () => {
    // 2026-01-03 is een zaterdag; 2026-01-05 een maandag.
    const za = match({ played_at: at(2026, 0, 3, 12), winner_team_id: "tA" });
    const ma = match({ played_at: at(2026, 0, 5, 12), winner_team_id: "tA" });
    expect(badge(deriveBadges([za], teams, "p1"), "weekendstrijder").behaald).toBe(true);
    expect(badge(deriveBadges([ma], teams, "p1"), "weekendstrijder").behaald).toBe(false);
  });

  it("Vroege vogel en Nachtbraker: op uur van de dag", () => {
    const vroeg = match({ played_at: at(2026, 0, 5, 6), winner_team_id: "tA" });
    const nacht = match({ played_at: at(2026, 0, 5, 23), winner_team_id: "tA" });
    const overdag = match({ played_at: at(2026, 0, 5, 14), winner_team_id: "tA" });
    expect(badge(deriveBadges([vroeg], teams, "p1"), "vroege-vogel").behaald).toBe(true);
    expect(badge(deriveBadges([nacht], teams, "p1"), "nachtbraker").behaald).toBe(true);
    expect(badge(deriveBadges([overdag], teams, "p1"), "vroege-vogel").behaald).toBe(false);
    expect(badge(deriveBadges([overdag], teams, "p1"), "nachtbraker").behaald).toBe(false);
  });

  it("Marathonspeler: behaald bij drie matches op één dag, met voortgang", () => {
    const drie = [10, 12, 14].map((h) =>
      match({ played_at: at(2026, 0, 5, h), winner_team_id: "tA" }),
    );
    const m = badge(deriveBadges(drie, teams, "p1"), "marathonspeler");
    expect(m.behaald).toBe(true);
    expect(m.voortgang).toEqual({ nu: 3, doel: 3 });

    const twee = [10, 12].map((h) =>
      match({ played_at: at(2026, 0, 5, h), winner_team_id: "tA" }),
    );
    expect(badge(deriveBadges(twee, teams, "p1"), "marathonspeler").behaald).toBe(false);
  });

  it("Pechvogel: behaald bij vijf verliezen op rij", () => {
    const vijf = Array.from({ length: 5 }, loss);
    const p = badge(deriveBadges(vijf, teams, "p1"), "pechvogel");
    expect(p.behaald).toBe(true);
    expect(p.voortgang).toEqual({ nu: 5, doel: 5 });
    expect(badge(deriveBadges(Array.from({ length: 4 }, loss), teams, "p1"), "pechvogel").behaald).toBe(false);
  });

  it("Nagelbijter, 6-0 Droog en Monsterzege: op puntenverschil", () => {
    const nipt = match({ winner_team_id: "tA", score_a: 6, score_b: 5 });
    const bagel = match({ winner_team_id: "tA", score_a: 6, score_b: 0 });
    // 6-2 = verschil 4 → monsterzege, geen 6-0 droog, geen nagelbijter.
    const monster = match({ winner_team_id: "tA", score_a: 6, score_b: 2 });
    expect(badge(deriveBadges([nipt], teams, "p1"), "nagelbijter").behaald).toBe(true);
    expect(badge(deriveBadges([bagel], teams, "p1"), "broodje-bal").behaald).toBe(true);
    expect(badge(deriveBadges([monster], teams, "p1"), "monsterzege").behaald).toBe(true);
    expect(badge(deriveBadges([monster], teams, "p1"), "broodje-bal").behaald).toBe(false);
    expect(badge(deriveBadges([monster], teams, "p1"), "nagelbijter").behaald).toBe(false);
    // 6-3 = verschil 3 → net géén monsterzege (drempel is 4).
    const netNiet = match({ winner_team_id: "tA", score_a: 6, score_b: 3 });
    expect(badge(deriveBadges([netNiet], teams, "p1"), "monsterzege").behaald).toBe(false);
    // Score vanuit p3 (ander team) bekeken: 6-5 wordt een nagelbijter-verlies, geen winst.
    expect(badge(deriveBadges([nipt], teams, "p3"), "nagelbijter").behaald).toBe(false);
  });

  it("Sociale vlinder: behaald bij vijf verschillende partners", () => {
    const partnerTeams: Record<string, Team> = {
      ...teams,
      t2: { id: "t2", name: null, player1_id: "p1", player2_id: "p5", created_at: "" },
      t3: { id: "t3", name: null, player1_id: "p1", player2_id: "p6", created_at: "" },
      t4: { id: "t4", name: null, player1_id: "p1", player2_id: "p7", created_at: "" },
      t5: { id: "t5", name: null, player1_id: "p1", player2_id: "p8", created_at: "" },
    };
    // Partners: p2, p5, p6, p7, p8 → vijf verschillende.
    const ms = ["tA", "t2", "t3", "t4", "t5"].map((t) =>
      match({ team_a_id: t, team_b_id: "tB", winner_team_id: "tB" }),
    );
    const v = badge(deriveBadges(ms, partnerTeams, "p1"), "sociale-vlinder");
    expect(v.behaald).toBe(true);
    expect(v.voortgang).toEqual({ nu: 5, doel: 5 });
    // Zonder de laatste: vier partners.
    expect(badge(deriveBadges(ms.slice(0, 4), partnerTeams, "p1"), "sociale-vlinder").voortgang).toEqual({ nu: 4, doel: 5 });
  });

  it("Trouwe ziel: behaald bij tien matches met dezelfde partner", () => {
    const tien = Array.from({ length: 10 }, loss); // steeds team tA → partner p2
    const t = badge(deriveBadges(tien, teams, "p1"), "trouwe-ziel");
    expect(t.behaald).toBe(true);
    expect(t.voortgang).toEqual({ nu: 10, doel: 10 });
  });

  it("Comebackkoning: behaald bij een winst na drie verliezen op rij", () => {
    const comeback = [loss(), loss(), loss(), win()];
    expect(badge(deriveBadges(comeback, teams, "p1"), "comebackkoning").behaald).toBe(true);
    // Slechts twee verliezen vóór de winst → geen comeback.
    const teKort = [loss(), loss(), win()];
    expect(badge(deriveBadges(teKort, teams, "p1"), "comebackkoning").behaald).toBe(false);
  });
});

describe("deriveBadges — nieuwe ludieke/extreme badges", () => {
  const at = (y: number, mo: number, d: number, h: number) =>
    new Date(y, mo, d, h, 0).toISOString();

  it("Debutant: behaald zodra je één match speelde (winst of verlies)", () => {
    expect(badge(deriveBadges([loss()], teams, "p1"), "debutant").behaald).toBe(true);
    expect(badge(deriveBadges([], teams, "p1"), "debutant").behaald).toBe(false);
  });

  it("Perfectionist: 100% winst over minstens tien matches", () => {
    const tienW = Array.from({ length: 10 }, win);
    expect(badge(deriveBadges(tienW, teams, "p1"), "perfectionist").behaald).toBe(true);
    // Eén verlies erbij → niet meer vlekkeloos.
    expect(
      badge(deriveBadges([...tienW, loss()], teams, "p1"), "perfectionist").behaald,
    ).toBe(false);
    // Vlekkeloos maar te weinig matches.
    expect(
      badge(deriveBadges(Array.from({ length: 9 }, win), teams, "p1"), "perfectionist").behaald,
    ).toBe(false);
  });

  it("Zwarte reeks: tien verliezen op rij, met voortgang", () => {
    const z = badge(deriveBadges(Array.from({ length: 10 }, loss), teams, "p1"), "zwarte-reeks");
    expect(z.behaald).toBe(true);
    expect(z.voortgang).toEqual({ nu: 10, doel: 10 });
    expect(
      badge(deriveBadges(Array.from({ length: 9 }, loss), teams, "p1"), "zwarte-reeks").behaald,
    ).toBe(false);
  });

  it("Onaanraakbaar: winreeks van twintig", () => {
    const winst20 = Array.from({ length: 20 }, win);
    expect(badge(deriveBadges(winst20, teams, "p1"), "reeks-20").behaald).toBe(true);
    expect(
      badge(deriveBadges(Array.from({ length: 19 }, win), teams, "p1"), "reeks-20").behaald,
    ).toBe(false);
  });

  it("Perfecte dag en Rampdag: alle drie op één dag gewonnen resp. verloren", () => {
    const dag = (h: number, winnaar: string) =>
      match({ played_at: at(2026, 2, 10, h), winner_team_id: winnaar });
    const perfect = [dag(10, "tA"), dag(12, "tA"), dag(14, "tA")];
    const ramp = [dag(10, "tB"), dag(12, "tB"), dag(14, "tB")];
    expect(badge(deriveBadges(perfect, teams, "p1"), "perfecte-dag").behaald).toBe(true);
    expect(badge(deriveBadges(perfect, teams, "p1"), "rampdag").behaald).toBe(false);
    expect(badge(deriveBadges(ramp, teams, "p1"), "rampdag").behaald).toBe(true);
    expect(badge(deriveBadges(ramp, teams, "p1"), "perfecte-dag").behaald).toBe(false);
  });

  it("Hartverscheurend en Afgedroogd: op een verlies met de score bekeken", () => {
    const nipt = match({ winner_team_id: "tB", score_a: 5, score_b: 6 }); // p1 verliest met 1
    const bagel = match({ winner_team_id: "tB", score_a: 0, score_b: 6 }); // p1 pakt geen game
    expect(badge(deriveBadges([nipt], teams, "p1"), "hartverscheurend").behaald).toBe(true);
    expect(badge(deriveBadges([bagel], teams, "p1"), "afgedroogd").behaald).toBe(true);
    // Winnaar p3 verliest niets → geen van beide.
    expect(badge(deriveBadges([bagel], teams, "p1"), "hartverscheurend").behaald).toBe(false);
  });

  it("Tijd- en seizoensbadges: maandag, vrijdagavond, zomer, nacht en feestdagen", () => {
    // 2026-03-09 is een maandag; 2026-03-13 een vrijdag.
    const ma = match({ played_at: at(2026, 2, 9, 12), winner_team_id: "tA" });
    const vrij = match({ played_at: at(2026, 2, 13, 20), winner_team_id: "tA" });
    const zomer = match({ played_at: at(2026, 6, 1, 12), winner_team_id: "tA" });
    const nacht = match({ played_at: at(2026, 2, 9, 3), winner_team_id: "tA" });
    const nj = match({ played_at: at(2026, 0, 1, 12), winner_team_id: "tA" });
    const kerst = match({ played_at: at(2026, 11, 25, 12), winner_team_id: "tA" });
    expect(badge(deriveBadges([ma], teams, "p1"), "maandagmatch").behaald).toBe(true);
    expect(badge(deriveBadges([vrij], teams, "p1"), "vrijdagborrel").behaald).toBe(true);
    expect(badge(deriveBadges([zomer], teams, "p1"), "zomerkoning").behaald).toBe(true);
    expect(badge(deriveBadges([nacht], teams, "p1"), "nachtmens").behaald).toBe(true);
    expect(badge(deriveBadges([nj], teams, "p1"), "nieuwjaarsduik").behaald).toBe(true);
    expect(badge(deriveBadges([kerst], teams, "p1"), "kerstengel").behaald).toBe(true);
  });

  it("Baanbewoner: extreme mijlpaal van 200 matches met voortgang", () => {
    const badges = deriveBadges(Array.from({ length: 200 }, win), teams, "p1");
    expect(badge(badges, "matches-200").behaald).toBe(true);
    expect(badge(badges, "matches-365").behaald).toBe(false);
    expect(badge(badges, "matches-365").voortgang).toEqual({ nu: 200, doel: 365 });
  });

  it("Winst-mijlpalen: tellen alleen gewonnen matches", () => {
    const badges = deriveBadges(Array.from({ length: 25 }, win), teams, "p1");
    expect(badge(badges, "winsten-25").behaald).toBe(true);
    expect(badge(badges, "winsten-50").behaald).toBe(false);
    expect(badge(badges, "winsten-50").voortgang).toEqual({ nu: 25, doel: 50 });
    // Verliezen tellen niet mee voor winst-mijlpalen.
    expect(
      badge(deriveBadges(Array.from({ length: 25 }, loss), teams, "p1"), "winsten-25").behaald,
    ).toBe(false);
  });

  it("Rating-tiers: op de eigen huidige rating, met voortgang", () => {
    const ratings = ratingsFor({ p1: 1250, p2: 1000, p3: 1000, p4: 1000 });
    const badges = deriveBadges([win()], teams, "p1", ratings);
    expect(badge(badges, "rating-1100").behaald).toBe(true);
    expect(badge(badges, "rating-1200").behaald).toBe(true);
    expect(badge(badges, "rating-1300").behaald).toBe(false);
    expect(badge(badges, "rating-1300").voortgang).toEqual({ nu: 1250, doel: 1300 });
    // Zonder ratings blijft alles onbehaald en zonder voortgang.
    const zonder = deriveBadges([win()], teams, "p1");
    expect(badge(zonder, "rating-1200").behaald).toBe(false);
    expect(badge(zonder, "rating-1200").voortgang).toBeUndefined();
  });

  it("Allrounder: winst, verlies én gelijkspel elk minstens één keer", () => {
    const gelijk = match({ winner_team_id: null });
    expect(badge(deriveBadges([win(), loss(), gelijk], teams, "p1"), "allrounder").behaald).toBe(true);
    expect(badge(deriveBadges([win(), loss()], teams, "p1"), "allrounder").behaald).toBe(false);
  });

  it("Revanche: winst tegen een team waarvan je eerder verloor", () => {
    expect(badge(deriveBadges([loss(), win()], teams, "p1"), "revanche").behaald).toBe(true);
    // Eerst winnen, dan verliezen → (nog) geen revanche.
    expect(badge(deriveBadges([win(), loss()], teams, "p1"), "revanche").behaald).toBe(false);
  });

  it("Vaste rivaal: tien duels tegen hetzelfde team", () => {
    const v = badge(deriveBadges(Array.from({ length: 10 }, loss), teams, "p1"), "vaste-rivaal");
    expect(v.behaald).toBe(true);
    expect(v.voortgang).toEqual({ nu: 10, doel: 10 });
  });

  it("Ironman en Nachtwacht: tellen matches per dag resp. na 22u", () => {
    const vijfOpDag = [10, 12, 14, 16, 18].map((h) =>
      match({ played_at: at(2026, 3, 4, h), winner_team_id: "tA" }),
    );
    expect(badge(deriveBadges(vijfOpDag, teams, "p1"), "ironman").behaald).toBe(true);
    const drieNachten = [4, 5, 6].map((d) =>
      match({ played_at: at(2026, 3, d, 23), winner_team_id: "tA" }),
    );
    const nw = badge(deriveBadges(drieNachten, teams, "p1"), "nachtwacht");
    expect(nw.behaald).toBe(true);
    expect(nw.voortgang).toEqual({ nu: 3, doel: 3 });
  });

  it("Drooglegger: drie keer een 6-0-winst", () => {
    const bagel = () => match({ winner_team_id: "tA", score_a: 6, score_b: 0 });
    const b = badge(deriveBadges([bagel(), bagel(), bagel()], teams, "p1"), "bagelbakker");
    expect(b.behaald).toBe(true);
    expect(b.voortgang).toEqual({ nu: 3, doel: 3 });
    expect(
      badge(deriveBadges([bagel(), bagel()], teams, "p1"), "bagelbakker").behaald,
    ).toBe(false);
  });

  it("Feestdag- en tijdstipbadges: Halloween, sinterklaas, vrijdag 13, schrikkeldag, lunch, kantooruren", () => {
    const b = (m: Match, id: string) => badge(deriveBadges([m], teams, "p1"), id).behaald;
    // 2024-02-29 was een schrikkel-donderdag; 2026-11-13 een vrijdag de 13e.
    expect(b(match({ played_at: at(2026, 9, 31, 20), winner_team_id: "tA" }), "halloweenspook")).toBe(true);
    expect(b(match({ played_at: at(2026, 11, 5, 20), winner_team_id: "tA" }), "sinterklaas")).toBe(true);
    expect(b(match({ played_at: at(2026, 10, 13, 20), winner_team_id: "tA" }), "vrijdag-de-13e")).toBe(true);
    expect(b(match({ played_at: at(2024, 1, 29, 20), winner_team_id: "tA" }), "schrikkelspringer")).toBe(true);
    expect(b(match({ played_at: at(2026, 2, 10, 13), winner_team_id: "tA" }), "lunchmatch")).toBe(true);
    // Maandag (2026-03-09) om 10u = werkdag binnen kantooruren.
    expect(b(match({ played_at: at(2026, 2, 9, 10), winner_team_id: "tA" }), "spijbelaar")).toBe(true);
    // Zondag (2026-03-08) om 10u telt niet als kantooruren.
    expect(b(match({ played_at: at(2026, 2, 8, 10), winner_team_id: "tA" }), "spijbelaar")).toBe(false);
  });

  it("Fotofinish: drie winsten met exact één punt verschil", () => {
    const nipt = () => match({ winner_team_id: "tA", score_a: 6, score_b: 5 });
    const f = badge(deriveBadges([nipt(), nipt(), nipt()], teams, "p1"), "fotofinish");
    expect(f.behaald).toBe(true);
    expect(f.voortgang).toEqual({ nu: 3, doel: 3 });
    expect(badge(deriveBadges([nipt(), nipt()], teams, "p1"), "fotofinish").behaald).toBe(false);
  });

  it("Dubbele cijfers: winst waarin je 10+ games pakt", () => {
    expect(
      badge(deriveBadges([match({ winner_team_id: "tA", score_a: 11, score_b: 9 })], teams, "p1"), "dubbele-cijfers").behaald,
    ).toBe(true);
    expect(
      badge(deriveBadges([match({ winner_team_id: "tA", score_a: 6, score_b: 2 })], teams, "p1"), "dubbele-cijfers").behaald,
    ).toBe(false);
  });

  it("Yin-yang: exact evenveel winst als verlies over minstens tien matches", () => {
    const vijfVijf = [...Array.from({ length: 5 }, win), ...Array.from({ length: 5 }, loss)];
    expect(badge(deriveBadges(vijfVijf, teams, "p1"), "yin-yang").behaald).toBe(true);
    // Scheve balans → niet behaald.
    const scheef = [...Array.from({ length: 6 }, win), ...Array.from({ length: 4 }, loss)];
    expect(badge(deriveBadges(scheef, teams, "p1"), "yin-yang").behaald).toBe(false);
    // Balans maar te weinig matches (4-4).
    const teWeinig = [...Array.from({ length: 4 }, win), ...Array.from({ length: 4 }, loss)];
    expect(badge(deriveBadges(teWeinig, teams, "p1"), "yin-yang").behaald).toBe(false);
  });

  it("Kalenderslokker: speel in alle twaalf maanden, met voortgang", () => {
    const elf = Array.from({ length: 11 }, (_, i) =>
      match({ played_at: at(2026, i, 10, 12), winner_team_id: "tA" }),
    );
    const k11 = badge(deriveBadges(elf, teams, "p1"), "kalenderslokker");
    expect(k11.behaald).toBe(false);
    expect(k11.voortgang).toEqual({ nu: 11, doel: 12 });
    const twaalf = Array.from({ length: 12 }, (_, i) =>
      match({ played_at: at(2026, i, 10, 12), winner_team_id: "tA" }),
    );
    expect(badge(deriveBadges(twaalf, teams, "p1"), "kalenderslokker").behaald).toBe(true);
  });

  it("Feniks: win meteen na vijf verliezen op rij", () => {
    const uitDeAs = [...Array.from({ length: 5 }, loss), win()];
    expect(badge(deriveBadges(uitDeAs, teams, "p1"), "feniks").behaald).toBe(true);
    // Vier verliezen is te weinig voor de Feniks (maar wel al een comeback).
    const teKort = [...Array.from({ length: 4 }, loss), win()];
    expect(badge(deriveBadges(teKort, teams, "p1"), "feniks").behaald).toBe(false);
  });

  it("Struikelaar: verlies van een team dat gemiddeld minstens de drempel lager staat", () => {
    const ratings = ratingsFor({
      p1: 1000 + REUZENDODER_DREMPEL,
      p2: 1000 + REUZENDODER_DREMPEL,
      p3: 1000,
      p4: 1000,
    });
    // p1 (sterk team) verliest van het zwakkere team → struikelaar.
    expect(badge(deriveBadges([loss()], teams, "p1", ratings), "struikelaar").behaald).toBe(true);
    // Winnen tegen dat zwakkere team telt niet.
    expect(badge(deriveBadges([win()], teams, "p1", ratings), "struikelaar").behaald).toBe(false);
    // Zonder ratings onbepaald → niet behaald.
    expect(badge(deriveBadges([loss()], teams, "p1"), "struikelaar").behaald).toBe(false);
  });
});

describe("deriveBadges — nieuwe lading (#119)", () => {
  // Lokale Date → ISO, zodat getDay()/getHours() deterministisch zijn los van TZ.
  const at = (y: number, mo: number, d: number, h: number, min = 0) =>
    new Date(y, mo, d, h, min).toISOString();
  const winOp = (y: number, mo: number, d: number, h = 12, min = 0) =>
    match({ played_at: at(y, mo, d, h, min), winner_team_id: "tA" });
  const verliesOp = (y: number, mo: number, d: number, h = 12, min = 0) =>
    match({ played_at: at(y, mo, d, h, min), winner_team_id: "tB" });

  it("Nieuwe mijlpalen: Halve legende (500) en Onsterfelijk (1000) staan in de set", () => {
    const badges = deriveBadges([], teams, "p1");
    expect(badge(badges, "matches-500").naam).toBe("Halve legende");
    expect(badge(badges, "matches-500").voortgang).toEqual({ nu: 0, doel: 500 });
    expect(badge(badges, "matches-1000").naam).toBe("Onsterfelijk");
  });

  it("Diepzeeduiker: rating onder 900; zonder ratings-data niet behaald", () => {
    expect(
      badge(deriveBadges([win()], teams, "p1", ratingsFor({ p1: 899 })), "diepzeeduiker").behaald,
    ).toBe(true);
    // Exact op de drempel is nog niet "onder".
    expect(
      badge(deriveBadges([win()], teams, "p1", ratingsFor({ p1: 900 })), "diepzeeduiker").behaald,
    ).toBe(false);
    expect(badge(deriveBadges([win()], teams, "p1"), "diepzeeduiker").behaald).toBe(false);
  });

  it("De verloren zoon: minstens 60 dagen tussen twee matches", () => {
    // 1 januari → 2 maart 2026 = 60 dagen.
    const lang = [winOp(2026, 0, 1), winOp(2026, 2, 2)];
    expect(badge(deriveBadges(lang, teams, "p1"), "verloren-zoon").behaald).toBe(true);
    // 59 dagen is nét te kort.
    const kort = [winOp(2026, 0, 1), winOp(2026, 2, 1)];
    expect(badge(deriveBadges(kort, teams, "p1"), "verloren-zoon").behaald).toBe(false);
  });

  it("Roestvrij: win meteen na minstens 30 dagen pauze", () => {
    expect(
      badge(deriveBadges([verliesOp(2026, 0, 1), winOp(2026, 1, 1)], teams, "p1"), "roestvrij").behaald,
    ).toBe(true);
    // Verliezen na de pauze telt niet.
    expect(
      badge(deriveBadges([verliesOp(2026, 0, 1), verliesOp(2026, 1, 1)], teams, "p1"), "roestvrij").behaald,
    ).toBe(false);
    // Te korte pauze (29 dagen) telt niet.
    expect(
      badge(deriveBadges([verliesOp(2026, 0, 1), winOp(2026, 0, 30)], teams, "p1"), "roestvrij").behaald,
    ).toBe(false);
  });

  it("Achtbaan: win én verlies op dezelfde dag", () => {
    const dag = [winOp(2026, 2, 10, 10), verliesOp(2026, 2, 10, 14)];
    expect(badge(deriveBadges(dag, teams, "p1"), "achtbaan").behaald).toBe(true);
    const alleenWinst = [winOp(2026, 2, 10, 10), winOp(2026, 2, 10, 14)];
    expect(badge(deriveBadges(alleenWinst, teams, "p1"), "achtbaan").behaald).toBe(false);
    // Win en verlies op verschillende dagen telt niet.
    const tweeDagen = [winOp(2026, 2, 10, 10), verliesOp(2026, 2, 11, 14)];
    expect(badge(deriveBadges(tweeDagen, teams, "p1"), "achtbaan").behaald).toBe(false);
  });

  it("Jojo: zes matches lang winst en verlies afwisselen; gelijkspel breekt het ritme", () => {
    const zes = [win(), loss(), win(), loss(), win(), loss()];
    const j = badge(deriveBadges(zes, teams, "p1"), "jojo");
    expect(j.behaald).toBe(true);
    expect(j.voortgang).toEqual({ nu: 6, doel: 6 });
    const vijf = [win(), loss(), win(), loss(), win()];
    expect(badge(deriveBadges(vijf, teams, "p1"), "jojo").voortgang).toEqual({ nu: 5, doel: 6 });
    const gebroken = [win(), loss(), win(), match({ winner_team_id: null }), loss(), win(), loss()];
    expect(badge(deriveBadges(gebroken, teams, "p1"), "jojo").behaald).toBe(false);
  });

  it("Kalenderbadges: Valentijnsdate, Oudejaarsknaller, Geen grap en Palindroomdag", () => {
    const b = (m: Match, id: string) => badge(deriveBadges([m], teams, "p1"), id).behaald;
    expect(b(winOp(2026, 1, 14, 19), "valentijnsdate")).toBe(true);
    expect(b(winOp(2026, 11, 31, 19), "oudejaarsknaller")).toBe(true);
    // Geen grap vraagt een wínst op 1 april; verlies telt niet.
    expect(b(winOp(2026, 3, 1, 19), "geen-grap")).toBe(true);
    expect(b(verliesOp(2026, 3, 1, 19), "geen-grap")).toBe(false);
    // 22-02-2022 is een palindroom; 22-02-2026 niet.
    expect(b(winOp(2022, 1, 22, 19), "palindroomdag")).toBe(true);
    expect(b(winOp(2026, 1, 22, 19), "palindroomdag")).toBe(false);
  });

  it("Winterkoning: december, januari én februari nodig", () => {
    const drie = [winOp(2025, 11, 10), winOp(2026, 0, 10), winOp(2026, 1, 10)];
    expect(badge(deriveBadges(drie, teams, "p1"), "winterkoning").behaald).toBe(true);
    const twee = [winOp(2025, 11, 10), winOp(2026, 0, 10)];
    expect(badge(deriveBadges(twee, teams, "p1"), "winterkoning").behaald).toBe(false);
  });

  it("Vier seizoenen: minstens één match per seizoen", () => {
    const vier = [winOp(2026, 3, 10), winOp(2026, 6, 10), winOp(2026, 9, 10), winOp(2026, 0, 10)];
    expect(badge(deriveBadges(vier, teams, "p1"), "vier-seizoenen").behaald).toBe(true);
    // Zonder wintermaand geen vier seizoenen.
    const drie = [winOp(2026, 3, 10), winOp(2026, 6, 10), winOp(2026, 9, 10)];
    expect(badge(deriveBadges(drie, teams, "p1"), "vier-seizoenen").behaald).toBe(false);
  });

  it("Dubbele dienst: op één dag zowel vóór 12u als na 18u", () => {
    const dienst = [winOp(2026, 2, 10, 9), winOp(2026, 2, 10, 19)];
    expect(badge(deriveBadges(dienst, teams, "p1"), "dubbele-dienst").behaald).toBe(true);
    const overdag = [winOp(2026, 2, 10, 9), winOp(2026, 2, 10, 14)];
    expect(badge(deriveBadges(overdag, teams, "p1"), "dubbele-dienst").behaald).toBe(false);
  });

  it("Back-to-back: twee starts binnen 90 minuten; identieke tijdstippen tellen niet", () => {
    const vlak = [winOp(2026, 2, 10, 19, 0), winOp(2026, 2, 10, 20, 0)];
    expect(badge(deriveBadges(vlak, teams, "p1"), "back-to-back").behaald).toBe(true);
    const ver = [winOp(2026, 2, 10, 19, 0), winOp(2026, 2, 10, 21, 0)];
    expect(badge(deriveBadges(ver, teams, "p1"), "back-to-back").behaald).toBe(false);
    // Zelfde tijdstip = gedeeld aanmaakmoment van rondes, geen back-to-back.
    const zelfde = [winOp(2026, 2, 10, 19, 0), winOp(2026, 2, 10, 19, 0)];
    expect(badge(deriveBadges(zelfde, teams, "p1"), "back-to-back").behaald).toBe(false);
  });

  it("Klokvast: tien matches met exact dezelfde starttijd (uur + minuut)", () => {
    const tien = Array.from({ length: 10 }, (_, i) => winOp(2026, 2, i + 1, 20, 30));
    const k = badge(deriveBadges(tien, teams, "p1"), "klokvast");
    expect(k.behaald).toBe(true);
    expect(k.voortgang).toEqual({ nu: 10, doel: 10 });
    // Eén match op een andere minuut hoort niet bij de reeks.
    const negen = [...tien.slice(0, 9), winOp(2026, 2, 10, 20, 31)];
    expect(badge(deriveBadges(negen, teams, "p1"), "klokvast").voortgang).toEqual({ nu: 9, doel: 10 });
  });

  it("Weekritme: vijf opeenvolgende kalenderweken met minstens één match", () => {
    // Vijf woensdagen op rij (weken van 2 t/m 30 maart 2026).
    const vijf = [4, 11, 18, 25].map((d) => winOp(2026, 2, d)).concat(winOp(2026, 3, 1));
    const w = badge(deriveBadges(vijf, teams, "p1"), "weekritme");
    expect(w.behaald).toBe(true);
    expect(w.voortgang).toEqual({ nu: 5, doel: 5 });
    // Een overgeslagen week breekt de reeks.
    const gat = [4, 11, 25].map((d) => winOp(2026, 2, d)).concat([winOp(2026, 3, 1), winOp(2026, 3, 8)]);
    expect(badge(deriveBadges(gat, teams, "p1"), "weekritme").behaald).toBe(false);
  });

  it("Neutraal als Zwitserland: vijf gelijke spelen", () => {
    const remise = () => match({ winner_team_id: null });
    const vijf = Array.from({ length: 5 }, remise);
    const z = badge(deriveBadges(vijf, teams, "p1"), "neutraal-zwitserland");
    expect(z.behaald).toBe(true);
    expect(z.voortgang).toEqual({ nu: 5, doel: 5 });
    expect(badge(deriveBadges(vijf.slice(0, 4), teams, "p1"), "neutraal-zwitserland").behaald).toBe(false);
  });

  it("Déjà vu: drie matches op rij met dezelfde eindscore, vanuit eigen perspectief", () => {
    const zesDrie = () => match({ winner_team_id: "tA", score_a: 6, score_b: 3 });
    expect(badge(deriveBadges([zesDrie(), zesDrie(), zesDrie()], teams, "p1"), "deja-vu").behaald).toBe(true);
    // Dezelfde cijfers maar gespiegeld (3-6-verlies) breekt de reeks.
    const gespiegeld = [zesDrie(), match({ winner_team_id: "tB", score_a: 3, score_b: 6 }), zesDrie()];
    expect(badge(deriveBadges(gespiegeld, teams, "p1"), "deja-vu").behaald).toBe(false);
    // Een match zonder score breekt de reeks ook.
    const zonderScore = [zesDrie(), zesDrie(), win(), zesDrie()];
    expect(badge(deriveBadges(zonderScore, teams, "p1"), "deja-vu").behaald).toBe(false);
  });

  it("Sniper: vijf winsten met exact hetzelfde puntenverschil", () => {
    const met2 = (eigen: number) =>
      match({ winner_team_id: "tA", score_a: eigen, score_b: eigen - 2 });
    const vijf = [met2(6), met2(7), met2(6), met2(7), met2(6)];
    const s = badge(deriveBadges(vijf, teams, "p1"), "sniper");
    expect(s.behaald).toBe(true);
    expect(s.voortgang).toEqual({ nu: 5, doel: 5 });
    expect(badge(deriveBadges(vijf.slice(0, 4), teams, "p1"), "sniper").behaald).toBe(false);
  });

  it("Puntenmachine: vijfhonderd games in totaal", () => {
    const tienNul = () => match({ winner_team_id: "tA", score_a: 10, score_b: 0 });
    const vijftig = Array.from({ length: 50 }, tienNul);
    const p = badge(deriveBadges(vijftig, teams, "p1"), "puntenmachine");
    expect(p.behaald).toBe(true);
    expect(p.voortgang).toEqual({ nu: 500, doel: 500 });
    expect(badge(deriveBadges(vijftig.slice(0, 49), teams, "p1"), "puntenmachine").behaald).toBe(false);
  });

  it("Tweelingzielen: vijf winsten op rij met dezelfde partner", () => {
    const vijf = Array.from({ length: 5 }, win);
    const t = badge(deriveBadges(vijf, teams, "p1"), "tweelingzielen");
    expect(t.behaald).toBe(true);
    expect(t.voortgang).toEqual({ nu: 5, doel: 5 });
    // Een verlies onderbreekt de reeks.
    expect(
      badge(deriveBadges([win(), win(), win(), win(), loss(), win()], teams, "p1"), "tweelingzielen").behaald,
    ).toBe(false);
    // Een partnerwissel onderbreekt de reeks ook, al blijft het winst.
    const teamsMetWissel: Record<string, Team> = {
      ...teams,
      tC: { id: "tC", name: null, player1_id: "p1", player2_id: "p5", created_at: "" },
    };
    const wissel = [
      win(),
      win(),
      win(),
      match({ team_a_id: "tC", winner_team_id: "tC" }),
      match({ team_a_id: "tC", winner_team_id: "tC" }),
    ];
    expect(badge(deriveBadges(wissel, teamsMetWissel, "p1"), "tweelingzielen").behaald).toBe(false);
  });

  it("Angstgegner verslagen: win van een team na vijf verliezen op rij; een remise reset", () => {
    const vijfPlusWinst = [...Array.from({ length: 5 }, loss), win()];
    expect(badge(deriveBadges(vijfPlusWinst, teams, "p1"), "angstgegner").behaald).toBe(true);
    const vierPlusWinst = [...Array.from({ length: 4 }, loss), win()];
    expect(badge(deriveBadges(vierPlusWinst, teams, "p1"), "angstgegner").behaald).toBe(false);
    const metRemise = [...Array.from({ length: 5 }, loss), match({ winner_team_id: null }), win()];
    expect(badge(deriveBadges(metRemise, teams, "p1"), "angstgegner").behaald).toBe(false);
  });
});
