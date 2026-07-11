import { describe, it, expect } from "vitest";
import {
  KORT_DREMPEL,
  deriveWrapped,
  matchesInYear,
  toonWrappedBanner,
  wrappedJaar,
} from "./wrapped";
import type { WrappedCard } from "./wrapped";
import type { Match, Profile, RatingPoint, Team } from "../../lib/types";

const JAAR = 2025;

const teams: Record<string, Team> = {
  tA: { id: "tA", name: null, player1_id: "p1", player2_id: "p2", created_at: "" },
  tB: { id: "tB", name: null, player1_id: "p3", player2_id: "p4", created_at: "" },
  tC: { id: "tC", name: null, player1_id: "p1", player2_id: "p5", created_at: "" },
};

const profiles: Record<string, Profile> = Object.fromEntries(
  ["p1", "p2", "p3", "p4", "p5"].map((id, i) => [
    id,
    {
      id,
      username: `speler${i + 1}`,
      full_name: `Speler ${i + 1}`,
      avatar_url: null,
      created_at: "",
    },
  ]),
);

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

const kaart = <K extends WrappedCard["kind"]>(
  cards: WrappedCard[],
  kind: K,
): Extract<WrappedCard, { kind: K }> | undefined =>
  cards.find((c) => c.kind === kind) as Extract<WrappedCard, { kind: K }> | undefined;

function derive(matches: Match[], extra: Partial<Parameters<typeof deriveWrapped>[0]> = {}) {
  return deriveWrapped({
    jaar: JAAR,
    matches,
    teams,
    profiles,
    playerId: "p1",
    ...extra,
  });
}

describe("wrappedJaar & toonWrappedBanner", () => {
  it("wisselt van jaar op 15 december", () => {
    expect(wrappedJaar(new Date("2026-12-14T23:59:00"))).toBe(2025);
    expect(wrappedJaar(new Date("2026-12-15T00:00:00"))).toBe(2026);
    expect(wrappedJaar(new Date("2026-07-11T12:00:00"))).toBe(2025);
  });

  it("toont de banner van 15 december t/m 31 januari", () => {
    expect(toonWrappedBanner(new Date("2026-12-14T12:00:00"))).toBe(false);
    expect(toonWrappedBanner(new Date("2026-12-15T00:30:00"))).toBe(true);
    expect(toonWrappedBanner(new Date("2027-01-31T23:00:00"))).toBe(true);
    expect(toonWrappedBanner(new Date("2027-02-01T00:30:00"))).toBe(false);
  });
});

describe("matchesInYear", () => {
  it("filtert op lokaal kalenderjaar", () => {
    const binnen = op("2025-06-14T19:00:00");
    const randJan = op("2025-01-01T00:30:00");
    const buiten = op("2026-01-01T10:00:00");
    expect(matchesInYear([binnen, randJan, buiten], 2025)).toEqual([binnen, randJan]);
  });
});

describe("deriveWrapped — varianten", () => {
  it("geeft null zonder afgewerkte matches in het jaar", () => {
    expect(derive([])).toBeNull();
    expect(derive([op("2024-06-01T10:00:00")])).toBeNull();
    expect(derive([op("2025-06-01T10:00:00", { status: "scheduled", winner_team_id: null })])).toBeNull();
  });

  it(`kiest de korte variant onder ${KORT_DREMPEL} matches, met exact 3 kaarten`, () => {
    const w = derive([
      op("2025-03-01T10:00:00"),
      op("2025-03-08T10:00:00", { winner_team_id: "tB" }),
      op("2025-04-01T10:00:00"),
      op("2025-05-01T10:00:00"),
    ]);
    expect(w?.variant).toBe("kort");
    expect(w?.cards.map((c) => c.kind)).toEqual(["cover", "volume", "outro"]);
    const cover = kaart(w!.cards, "cover");
    expect(cover?.kort).toBe(true);
    expect(cover?.naam).toBe("Speler 1");
    expect(kaart(w!.cards, "volume")).toMatchObject({ gespeeld: 4, gewonnen: 3, winrate: 75 });
  });

  it("bouwt een volle variant met minstens 6 kaarten en de jaarstatistieken", () => {
    // Zes matches met verhaal: verlies-verlies-winst (comeback), ruime winst
    // 6-1, winstreeks van 4, vast maatje p2, rivalen p3/p4, drukste maand juni.
    const matches = [
      op("2025-05-03T10:00:00", { winner_team_id: "tB" }),
      op("2025-05-10T10:00:00", { winner_team_id: "tB" }),
      op("2025-06-07T10:00:00", { score_a: 6, score_b: 1 }),
      op("2025-06-14T10:00:00"),
      op("2025-06-14T19:00:00"),
      op("2025-06-21T10:00:00"),
    ];
    const historie: RatingPoint[] = [
      { match_id: "m1", rating_before: 1000, rating_after: 988, delta: -12, played_at: "2025-05-03T10:00:00" },
      { match_id: "m3", rating_before: 988, rating_after: 1040, delta: 52, played_at: "2025-06-07T10:00:00" },
      { match_id: "m6", rating_before: 1040, rating_after: 1025, delta: -15, played_at: "2025-06-21T10:00:00" },
    ];
    const w = derive(matches, { ratingHistory: historie, clubMatches: matches });
    expect(w?.variant).toBe("vol");
    expect(w!.cards.length).toBeGreaterThanOrEqual(6);
    expect(w!.cards[0].kind).toBe("cover");
    expect(w!.cards[w!.cards.length - 1].kind).toBe("outro");

    expect(kaart(w!.cards, "volume")).toMatchObject({ gespeeld: 6, gewonnen: 4, winrate: 67 });
    expect(kaart(w!.cards, "kalender")?.maand).toMatchObject({ label: "juni", aantal: 4 });
    expect(kaart(w!.cards, "kalender")?.topdag.aantal).toBe(2);
    expect(kaart(w!.cards, "kalender")?.topdag.label).toContain("14 juni");
    expect(kaart(w!.cards, "reeks")).toMatchObject({ type: "winst", lengte: 4 });
    expect(kaart(w!.cards, "maatje")).toMatchObject({ naam: "Speler 2", samen: 6, gewonnen: 4 });
    const rivalen = kaart(w!.cards, "rivalen");
    // p3/p4 zijn beiden 4-2 vanuit p1 → favoriete tegenstanders, geen nemesis.
    expect(rivalen?.favoriet).toMatchObject({ gewonnen: 4, verloren: 2, gespeeld: 6 });
    expect(rivalen?.nemesis).toBeNull();
    expect(kaart(w!.cards, "prestatie")).toMatchObject({
      zege: { score: "6–1", marge: 5 },
      comeback: { naVerliezen: 2 },
    });
    expect(kaart(w!.cards, "rating")).toMatchObject({ start: 1000, piek: 1040, eind: 1025 });
    expect(kaart(w!.cards, "badge")).toBeDefined();
  });
});

describe("deriveWrapped — kaartdetails", () => {
  it("telt een comeback over de jaargrens, maar de winst moet in het jaar vallen", () => {
    const overJaargrens = [
      op("2024-12-20T10:00:00", { winner_team_id: "tB" }),
      op("2024-12-27T10:00:00", { winner_team_id: "tB" }),
      op("2025-01-04T10:00:00"),
      op("2025-02-01T10:00:00"),
      op("2025-03-01T10:00:00"),
      op("2025-04-01T10:00:00"),
      op("2025-05-01T10:00:00"),
    ];
    const w = derive(overJaargrens);
    expect(kaart(w!.cards, "prestatie")?.comeback).toEqual({ naVerliezen: 2 });

    // Winst na één verlies is geen comeback; de comeback-winst van 2024 telt
    // niet voor Wrapped 2025.
    const geenComeback = [
      op("2024-11-01T10:00:00", { winner_team_id: "tB" }),
      op("2024-11-08T10:00:00", { winner_team_id: "tB" }),
      op("2024-11-15T10:00:00"), // comeback, maar in 2024
      op("2025-03-01T10:00:00", { winner_team_id: "tB" }),
      op("2025-03-08T10:00:00"),
      op("2025-04-01T10:00:00"),
      op("2025-05-01T10:00:00"),
      op("2025-06-01T10:00:00"),
    ];
    // Geen zege mét score en geen comeback → de hele prestatiekaart vervalt.
    const w2 = derive(geenComeback);
    expect(kaart(w2!.cards, "prestatie")).toBeUndefined();
  });

  it("laat de rating-kaart weg bij minder dan twee jaarpunten", () => {
    const matches = Array.from({ length: 6 }, (_, i) =>
      op(`2025-0${(i % 6) + 1}-10T10:00:00`),
    );
    const historie: RatingPoint[] = [
      { match_id: "x", rating_before: 1000, rating_after: 1012, delta: 12, played_at: "2025-01-10T10:00:00" },
    ];
    const w = derive(matches, { ratingHistory: historie });
    expect(kaart(w!.cards, "rating")).toBeUndefined();
  });

  it("valt bij een winstloos jaar terug op de taaiste verliesreeks", () => {
    const matches = Array.from({ length: 5 }, (_, i) =>
      op(`2025-03-0${i + 1}T10:00:00`, { winner_team_id: "tB" }),
    );
    const w = derive(matches);
    expect(w?.variant).toBe("vol");
    expect(kaart(w!.cards, "reeks")).toMatchObject({ type: "verlies", lengte: 5 });
    // Geen nemesis-verrassing: p3/p4 wonnen alles → zij zijn de nemesis.
    expect(kaart(w!.cards, "rivalen")?.nemesis).toMatchObject({ gewonnen: 0, gespeeld: 5 });
  });

  it("zeldzaamste badge: een badge die minder spelers haalden wint", () => {
    // Eén 6-0-monsterzege voor p1&p2; p3/p4 winnen alleen gewone matches.
    // Winst-gerelateerde zeldzaamheden delen p1 en p2 (2 spelers); de
    // 6-0-badge kan nooit door p3/p4 behaald zijn.
    const club = [
      op("2025-02-01T10:00:00", { score_a: 6, score_b: 0 }),
      op("2025-03-01T10:00:00", { winner_team_id: "tB" }),
      op("2025-04-01T10:00:00", { winner_team_id: "tB" }),
      op("2025-05-01T10:00:00"),
      op("2025-06-01T10:00:00"),
    ];
    const w = derive(club, { clubMatches: club });
    const badge = kaart(w!.cards, "badge");
    expect(badge).toBeDefined();
    expect(badge!.aantalSpelers).toBeLessThanOrEqual(2);
    expect(badge!.aantalSpelers).toBeGreaterThan(0);

    // Zonder clubMatches geen badge-kaart, de rest blijft overeind.
    const zonder = derive(club);
    expect(kaart(zonder!.cards, "badge")).toBeUndefined();
  });
});
