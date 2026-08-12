import { describe, expect, it } from "vitest";
import type { Row } from "./leaderboardHelpers";
import {
  calculateDivisionAxis,
  calculateRacePosition,
  detectRatingPacks,
  divisionCheckpoints,
  findCurrentUser,
  getNextDivision,
  PACK_GAP_MAX,
  PACK_GAP_MIN,
  PACK_MAX_SPREAD,
  PACK_NEIGHBOR_GAP,
  packThresholds,
  raceGoal,
  raceSrSummary,
  rankShiftLabel,
} from "./raceUtils";

const row = (key: string, rating: number | null, options: Partial<Row> = {}): Row => ({
  key,
  rating,
  rank: Number(key.replace(/\D/g, "")) || 1,
  isMe: false,
  name: key,
  profile: null,
  played: 10,
  won: 5,
  drawn: 0,
  lost: 5,
  points: 15,
  goalDiff: 0,
  games: 10,
  history: [],
  form: [],
  ...options,
});

describe("race-as", () => {
  it("verankert de as aan divisiegrenzen, niet aan de toevallige min/max", () => {
    const axis = calculateDivisionAxis([940, 1010, 1080, 1150]);
    expect(axis).toMatchObject({ min: 900, max: 1200, step: 50, zoomBand: null });
    expect(axis.ticks[0]).toBe(900);
    expect(axis.ticks.at(-1)).toBe(1200);
    expect(divisionCheckpoints(axis).map((c) => c.naam)).toEqual([
      "Wannabe",
      "Glazenwasser",
    ]);
  });

  it("staat stil zolang het veld geen divisiegrens over gaat", () => {
    const veld = calculateDivisionAxis([1017, 1120]);
    expect(veld.min).toBe(1000);
    expect(veld.max).toBe(1200);
    // Andere ratings binnen dezelfde banden: exact dezelfde as.
    expect(calculateDivisionAxis([1099, 1101])).toEqual(veld);
  });

  it("knipt een verre, dunbezette uitschieterband van de as", () => {
    const veld = [950, 960, 970, 980, 990, 1010, 1020, 1030, 1040, 1620];
    const axis = calculateDivisionAxis(veld);
    expect(axis.min).toBe(900);
    expect(axis.max).toBe(1100);
    // De uitschieter blijft bestaan en klemt op de rand.
    expect(calculateRacePosition(1620, axis)).toBe(100);
  });

  it("knipt de band van de kijker nooit weg", () => {
    const veld = [950, 960, 970, 980, 990, 1010, 1020, 1030, 1040, 1620];
    const axis = calculateDivisionAxis(veld, 1620);
    expect(axis.max).toBe(1700);
    expect(calculateRacePosition(1620, axis)).toBeLessThan(100);
  });

  it("kent één totaalbudget: een gespreid veld knipt zich niet leeg", () => {
    // Twee losse enkelingen aan de onderkant; alleen de verste mag eraf.
    const veld = [500, 700, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 1080];
    const axis = calculateDivisionAxis(veld);
    expect(axis.min).toBe(700);
    expect(axis.max).toBe(1100);
  });

  it("zoomt in op sub-niveaus als het hele veld binnen één band valt", () => {
    const axis = calculateDivisionAxis([1010, 1040, 1090]);
    expect(axis).toMatchObject({ min: 1000, max: 1100, step: 25 });
    expect(axis.zoomBand?.naam).toBe("Wannabe");
    expect(divisionCheckpoints(axis)).toEqual([
      expect.objectContaining({ naam: "Wannabe II", min: 1034 }),
      expect.objectContaining({ naam: "Wannabe I", min: 1067 }),
    ]);
  });

  it("geeft gelijke ratings een leesbare as", () => {
    const axis = calculateDivisionAxis([1000, 1000]);
    expect(axis.max).toBeGreaterThan(axis.min);
    expect(calculateRacePosition(1000, axis)).toBe(0);
  });

  it("klemt ratings die buiten een aangeleverde as vallen", () => {
    expect(calculateRacePosition(800, { min: 900, max: 1100 })).toBe(0);
    expect(calculateRacePosition(1200, { min: 900, max: 1100 })).toBe(100);
  });
});

describe("adaptieve packs", () => {
  it("wordt strenger in een vlak veld en klemt op de ondergrens", () => {
    expect(packThresholds([1000, 995, 992, 988, 985])).toEqual({
      neighborGap: PACK_GAP_MIN,
      maxSpread: 2 * PACK_GAP_MIN,
    });
  });

  it("wordt ruimer in een gespreid veld en klemt op de bovengrens", () => {
    expect(packThresholds([1400, 1300, 1150, 1000, 900])).toEqual({
      neighborGap: PACK_GAP_MAX,
      maxSpread: 2 * PACK_GAP_MAX,
    });
  });

  it("schaalt met de mediaan van de buurmansgaten", () => {
    expect(packThresholds([1100, 1080, 1060, 1040, 1020])).toEqual({
      neighborGap: 30,
      maxSpread: 60,
    });
  });

  it("valt bij een miniveld terug op de vaste drempels", () => {
    expect(packThresholds([1000, 950])).toEqual({
      neighborGap: PACK_NEIGHBOR_GAP,
      maxSpread: PACK_MAX_SPREAD,
    });
  });
});

describe("doelkop", () => {
  const rated = (key: string, rating: number, isMe = false) =>
    row(key, rating, { isMe }) as Row & { rating: number };

  it("kiest de dichtstbijzijnde speler als die het kleinste doel is", () => {
    const rows = [rated("p1", 1040), rated("p2", 1030, true)];
    expect(raceGoal(rows[1], rows)).toEqual({
      kop: "10 rating achter p1",
      sub: "Nog 70 rating tot 🪟 Glazenwasser",
    });
  });

  it("kiest de divisiepoort als die dichterbij is dan de speler erboven", () => {
    const rows = [rated("p1", 1190), rated("p2", 1090, true)];
    expect(raceGoal(rows[1], rows)).toEqual({
      kop: "Nog 10 rating tot 🪟 Glazenwasser",
      sub: "100 rating achter p1",
    });
  });

  it("geeft de leider zijn volgende divisie als doel", () => {
    const rows = [rated("p1", 1050, true), rated("p2", 1000)];
    expect(raceGoal(rows[0], rows)).toEqual({
      kop: "Nog 50 rating tot 🪟 Glazenwasser",
      sub: "Je leidt het klassement",
    });
  });

  it("laat een leider zonder volgende divisie zijn voorsprong zien", () => {
    const rows = [rated("p1", 1650, true), rated("p2", 1400)];
    expect(raceGoal(rows[0], rows)).toEqual({
      kop: "Je leidt het klassement",
      sub: "250 rating voorsprong op p2",
    });
  });

  it("benoemt een gelijke stand expliciet", () => {
    const rows = [rated("p1", 1000), rated("p2", 1000, true)];
    expect(raceGoal(rows[1], rows)).toEqual({
      kop: "Gelijk met p1",
      sub: "Nog 100 rating tot 🪟 Glazenwasser",
    });
  });
});

describe("race-afleidingen", () => {
  it("detecteert een compact pack en laat losse spelers ongemoeid", () => {
    const rows = [row("p1", 1100), row("p2", 1045), row("p3", 1020), row("p4", 1017), row("p5", 1011)];
    const packs = detectRatingPacks(rows);
    expect(packs).toHaveLength(1);
    expect(packs[0].rows.map((r) => r.key)).toEqual(["p2", "p3", "p4", "p5"]);
    expect(packs[0].spread).toBe(34);
  });

  it("maakt geen pack van twee spelers of van een ratingketting", () => {
    expect(detectRatingPacks([row("p1", 1000), row("p2", 990)])).toEqual([]);
    const chain = [1000, 970, 940, 910, 880].map((rating, i) => row(`p${i + 1}`, rating));
    expect(detectRatingPacks(chain)[0].rows).toHaveLength(3);
  });

  it("vindt de huidige gebruiker zonder op naam te gokken", () => {
    expect(findCurrentUser([row("p1", 1000), row("p2", 990, { isMe: true })])?.key).toBe("p2");
  });

  it("berekent de volgende echte hoofddivisie", () => {
    const next = getNextDivision(988);
    expect(next?.volgende).toMatchObject({ naam: "Wannabe", vanaf: 1000 });
    expect(next?.puntenNodig).toBe(12);
    expect(getNextDivision(1600)?.volgende).toBeNull();
  });

  it("labelt rangwissels ook zonder shift-veld via de vorige rang", () => {
    expect(rankShiftLabel(row("p1", 1000, { shift: "nieuw" }), null)).toBe("nieuw");
    expect(rankShiftLabel(row("p1", 1000, { shift: 2 }), null)).toBe("▲2");
    expect(rankShiftLabel(row("p3", 1000), 5)).toBe("▲2");
    expect(rankShiftLabel(row("p3", 1000), 3)).toBeNull();
  });

  it("vat de baan samen voor schermlezers", () => {
    const rows = [row("p1", 1120), row("p2", 1045), row("p3", 1045)];
    const axis = calculateDivisionAxis(rows.map((r) => r.rating!));
    const tekst = raceSrSummary(rows, divisionCheckpoints(axis));
    expect(tekst).toContain("1. p1 (1120 rating)");
    expect(tekst).toContain("2. p2 (1045 rating, 75 achter)");
    expect(tekst).toContain("3. p3 (1045 rating, gelijk)");
    expect(tekst).toContain("Divisiepoorten op de baan: Glazenwasser vanaf 1100 rating");
    expect(raceSrSummary([], [])).toBe("");
  });
});

// De replay-reconstructie is opgegaan in de speeldag-tijdlijn (#1241):
// zie raceTimeline.test.ts.
