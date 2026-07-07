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
    expect(badges).toHaveLength(21);
    expect(badges.every((b) => !b.behaald)).toBe(true);
    expect(badge(badges, "matches-10").voortgang).toEqual({ nu: 0, doel: 10 });
    expect(badge(badges, "reeks-3").voortgang).toEqual({ nu: 0, doel: 3 });
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

  it("Nagelbijter, Broodje bal en Monsterzege: op puntenverschil", () => {
    const nipt = match({ winner_team_id: "tA", score_a: 6, score_b: 5 });
    const bagel = match({ winner_team_id: "tA", score_a: 6, score_b: 0 });
    // 6-2 = verschil 4 → monsterzege, geen broodje, geen nagelbijter.
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
