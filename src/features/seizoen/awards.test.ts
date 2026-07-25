import { describe, it, expect } from "vitest";
import { seizoenAwards, type AwardId } from "@/features/seizoen/awards";
import type { Match, Profile, RatingPoint, Team } from "@/types";

const TEAMS: Record<string, Team> = {
  "t-ab": { id: "t-ab", name: null, player1_id: "a", player2_id: "b", created_at: "x" },
  "t-cd": { id: "t-cd", name: null, player1_id: "c", player2_id: "d", created_at: "x" },
};

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  id,
  username: id,
  full_name: id.toUpperCase(),
  avatar_url: null,
  created_at: "2026-01-01T00:00:00",
  ...over,
});

const PROFILES: Record<string, Profile> = {
  a: profile("a"),
  b: profile("b"),
  c: profile("c"),
  d: profile("d"),
};

let seq = 0;
const match = (over: Partial<Match> = {}): Match => ({
  id: `m${++seq}`,
  team_a_id: "t-ab",
  team_b_id: "t-cd",
  status: "completed",
  winner_team_id: "t-ab",
  score_a: 6,
  score_b: 3,
  played_at: `2026-07-${String((seq % 28) + 1).padStart(2, "0")}T19:00:00`,
  created_at: "2026-07-01T18:00:00",
  created_by: null,
  group_id: "g1",
  round_number: null,
  format: "2v2",
  ...over,
});

const awards = (matches: Match[], extra = {}) =>
  seizoenAwards({ matches, teams: TEAMS, profiles: PROFILES, ...extra });

const vind = (matches: Match[], id: AwardId, extra = {}) =>
  awards(matches, extra).find((a) => a.id === id);

/** Vier ruime winsten voor t-ab: genoeg voor scherpschutter en reeks. */
const VIER_WINSTEN = [match(), match(), match(), match()];

describe("seizoenAwards", () => {
  it("geeft niets zonder afgeronde matches", () => {
    expect(awards([])).toEqual([]);
    expect(awards([match({ status: "scheduled", winner_team_id: null })])).toEqual([]);
  });

  it("reikt de scherpschutter uit op gemiddelde games per match", () => {
    const a = vind(VIER_WINSTEN, "scherpschutter")!;
    expect(a.playerId).toBe("a"); // tie-break op playerId binnen t-ab
    expect(a.detail).toBe("6.0 games per match");
  });

  it("laat de scherpschutter weg onder het minimum aantal matches", () => {
    expect(vind([match(), match()], "scherpschutter")).toBeUndefined();
  });

  it("telt bagels alleen voor de uitdelende kant", () => {
    const ms = [
      match({ score_a: 6, score_b: 0 }),
      match({ score_a: 6, score_b: 0 }),
      match({ winner_team_id: "t-cd", score_a: 0, score_b: 6 }),
    ];
    const a = vind(ms, "bagelbakker")!;
    expect(a.playerId).toBe("a");
    expect(a.detail).toBe("2 bagels uitgedeeld");
  });

  it("rekent 0-0 niet als bagel", () => {
    expect(
      vind([match({ winner_team_id: null, score_a: 0, score_b: 0 })], "bagelbakker"),
    ).toBeUndefined();
  });

  it("kroont de koning van de kraker op winsten met één game verschil", () => {
    const ms = [
      match({ score_a: 6, score_b: 5 }),
      match({ score_a: 7, score_b: 6 }),
      match({ score_a: 6, score_b: 2 }),
    ];
    const a = vind(ms, "kraker")!;
    expect(a.waarde).toBe(2);
    expect(a.detail).toBe("2 keer met één game verschil gewonnen");
  });

  it("vraagt minstens twee krakers", () => {
    expect(vind([match({ score_a: 6, score_b: 5 })], "kraker")).toBeUndefined();
  });

  it("reikt de langste reeks uit vanaf drie op rij", () => {
    expect(vind([match(), match()], "reeks")).toBeUndefined();
    const a = vind([match(), match(), match()], "reeks")!;
    expect(a.detail).toBe("3 overwinningen op rij");
  });

  it("vindt de comebackkoning na een verliesreeks", () => {
    // c/d verliezen twee keer, winnen dan: comeback na 2.
    const ms = [
      match({ played_at: "2026-07-01T19:00:00" }),
      match({ played_at: "2026-07-02T19:00:00" }),
      match({
        played_at: "2026-07-03T19:00:00",
        winner_team_id: "t-cd",
        score_a: 3,
        score_b: 6,
      }),
    ];
    const a = vind(ms, "comebackkoning")!;
    expect(["c", "d"]).toContain(a.playerId);
    expect(a.detail).toBe("stond op na 2 verliezen op rij");
  });

  it("leest de comeback chronologisch, ook bij een omgekeerde lijst", () => {
    const ms = [
      match({ played_at: "2026-07-01T19:00:00" }),
      match({ played_at: "2026-07-02T19:00:00" }),
      match({
        played_at: "2026-07-03T19:00:00",
        winner_team_id: "t-cd",
        score_a: 3,
        score_b: 6,
      }),
    ];
    // getGroupMatches levert op rondenummer aflopend: omgekeerde volgorde mag
    // de uitkomst niet veranderen.
    expect(vind([...ms].reverse(), "comebackkoning")?.detail).toBe(
      "stond op na 2 verliezen op rij",
    );
  });

  it("reikt de grootste stijger uit op rating-winst binnen het kwartaal", () => {
    const ms = VIER_WINSTEN;
    const punt = (matchId: string, delta: number): RatingPoint => ({
      match_id: matchId,
      rating_before: 1000,
      rating_after: 1000 + delta,
      delta,
      played_at: "2026-07-05T19:00:00",
    });
    const histories = {
      a: ms.map((m) => punt(m.id, 6)), // +24
      b: ms.map((m) => punt(m.id, 3)), // +12
      c: [punt("buiten-het-kwartaal", 99)], // telt niet mee
    };
    const stijger = vind(ms, "stijger", { histories })!;
    expect(stijger.playerId).toBe("a");
    expect(stijger.detail).toBe("+24 rating dit seizoen");
  });

  it("laat de stijger weg zonder rating-historie", () => {
    expect(vind(VIER_WINSTEN, "stijger")).toBeUndefined();
  });

  it("reikt de gigantendoder uit aan de winnaar met de kleinste winkans", () => {
    const upset = match({ winner_team_id: "t-cd", score_a: 3, score_b: 6 });
    const punt = (rating: number): RatingPoint => ({
      match_id: upset.id,
      rating_before: rating,
      rating_after: rating,
      delta: 0,
      played_at: upset.played_at!,
    });
    // a/b staan ~400 punten hoger: c/d winnen met een lage winkans.
    const histories = {
      a: [punt(1400)],
      b: [punt(1400)],
      c: [punt(1000)],
      d: [punt(1000)],
    };
    const a = vind([upset], "gigantendoder", { histories })!;
    expect(a.playerId).toBe("c");
    expect(a.detail).toMatch(/won met \d+% winkans vooraf/);
  });

  it("zwijgt over upsets zonder rating-historie", () => {
    expect(vind(VIER_WINSTEN, "gigantendoder")).toBeUndefined();
  });

  it("zet de pias achteraan als hij meegegeven wordt", () => {
    const lijst = awards(VIER_WINSTEN, {
      pias: { playerId: "c", reden: "afdroging", detail: "x", ernst: 9, waarde: 6 },
    });
    expect(lijst[lijst.length - 1]).toMatchObject({
      id: "pias",
      playerId: "c",
      titel: "Pias van het seizoen",
    });
    expect(lijst[lijst.length - 1].detail).toContain("6 games");
  });

  it("laat gasten buiten de uitreiking", () => {
    const metGast = { a: profile("a", { is_guest: true }), b: PROFILES.b, c: PROFILES.c, d: PROFILES.d };
    const lijst = seizoenAwards({
      matches: VIER_WINSTEN,
      teams: TEAMS,
      profiles: metGast,
    });
    expect(lijst.length).toBeGreaterThan(0);
    for (const a of lijst) expect(a.playerId).not.toBe("a");
  });

  it("houdt de eer vóór de schande in de volgorde", () => {
    const lijst = awards(
      [
        match({ score_a: 6, score_b: 0 }),
        match({ score_a: 6, score_b: 0 }),
        match({ score_a: 6, score_b: 5 }),
        match({ score_a: 6, score_b: 5 }),
      ],
      { pias: { playerId: "c", reden: "bagel", detail: "x", ernst: 9, waarde: 2 } },
    );
    expect(lijst.map((a) => a.id)).toEqual([
      "scherpschutter",
      "bagelbakker",
      "kraker",
      "reeks",
      "pias",
    ]);
  });
});
